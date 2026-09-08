'use strict'

/**
 * Importador das planilhas de resultado de curso.
 *
 *   node scripts/importar-resultados.js --tipo consolidado --curso 3 \
 *        --arquivo ../../base-cursistas/2-processado/consolidado.csv
 *
 * O curso e informado a mao, de proposito. A planilha do Google traz
 * "Google for Educacion" na coluna de curso -- com erro de grafia -- e nenhum
 * casamento por nome sobreviveria a isso. Adivinhar acertaria a maior parte das
 * vezes e erraria em silencio nas outras, gravando resultado no curso errado.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { lerCsvComCabecalho } = require('./csv')

/* ─────────────────────────── argumentos ─────────────────────────── */

function lerArgumentos(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`Argumento inesperado: ${argv[i]}`)
    args[argv[i].slice(2)] = argv[i + 1]
  }
  return args
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * DATE do MySQL como texto AAAA-MM-DD.
 *
 * O driver devolve um objeto Date, e String(date) da "Mon Sep 07 2026". Esse
 * texto ainda se compara sem erro nenhum com "2026-09-07" -- e compara errado,
 * porque digito vem antes de letra. Era o que fazia a trava de reimportacao
 * recusar uma planilha mais nova alegando que ela era mais velha.
 */
function dia(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ─────────────────────────── normalizacoes ─────────────────────────── */

/**
 * O CPF chega da planilha formatado ("000.000.000-00") e o sistema guarda os 11
 * digitos. O padStart importa: o Excel come o zero a esquerda ao tratar CPF como
 * numero, e 07712345678 volta como 7712345678 -- que nao casa com ninguem.
 */
const soDigitos = (v) => String(v || '').replace(/\D/g, '').padStart(11, '0')

const semAcento = (v) => String(v || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

/**
 * A GRE, no formato que o sistema ja usa.
 *
 * A base oficial gravou "1ª GRE" e a planilha de resultado traz "01ª GRE" -- as
 * mesmas dezesseis regionais, com rotulos diferentes. Sem esta conversao o
 * filtro por regional devolveria zero sem erro nenhum: o SQL compararia duas
 * strings que nunca sao iguais, e a tela mostraria um curso sem ninguem em vez
 * de um curso que nao casa.
 *
 * O que nao for reconhecido passa intacto -- "Sem GRE" nao deve virar "NaNª GRE".
 */
function normalizarGre(valor) {
  const texto = String(valor || '').trim()
  const m = texto.match(/^0*(\d{1,2})\s*ª?\s*GRE$/i)
  return m ? `${Number(m[1])}ª GRE` : (texto || null)
}

const STATUS = {
  'CONCLUIDO': 'concluido',
  'CONCLUIU': 'concluido',
  'SIM': 'concluido',
  'NAO CONCLUIDO': 'nao_concluido',
  'NAO CONCLUIU': 'nao_concluido',
  'NAO': 'nao_concluido',
  'EM ANDAMENTO': 'em_andamento',
  'ANDAMENTO': 'em_andamento',
  'CURSANDO': 'em_andamento',
}

/**
 * Separador das chaves de agrupamento.
 *
 * Nao pode ser espaco nem virgula: "Lingua Portuguesa" e "Muito relevante" tem
 * espaco, e quebrar a chave no meio de um componente misturaria contagens de
 * disciplinas diferentes. O caractere U+0001 nao aparece em texto digitado.
 */
const SEP = '\u0001'

/** Acha a coluna cujo nome contem todos os pedacos dados. */
function acharColuna(colunas, ...pedacos) {
  const alvo = pedacos.map(semAcento)
  return colunas.find((c) => alvo.every((p) => semAcento(c).includes(p))) || null
}

/* ─────────────────────────── consolidado ─────────────────────────── */

async function importarConsolidado(conn, { registros, colunas }, ctx) {
  const cCpf = acharColuna(colunas, 'CPF')
  const cStatus = acharColuna(colunas, 'STATUS')
  if (!cCpf || !cStatus) throw new Error('A planilha precisa ter as colunas CPF e STATUS.')

  const cGre = acharColuna(colunas, 'GRE')
  const cInep = acharColuna(colunas, 'INEP')
  const cEscola = acharColuna(colunas, 'ESCOLA')
  const cNome = acharColuna(colunas, 'DOCENTE') || acharColuna(colunas, 'NOME')

  /**
   * Status desconhecido interrompe a importacao em vez de virar linha
   * descartada. Um "Concluido(a)" novo na proxima exportacao baixaria a taxa de
   * conclusao sem nenhum aviso -- e numero errado no painel e pior que
   * importacao que falhou.
   */
  const desconhecidos = new Set()
  const linhas = registros.map((r) => {
    const status = STATUS[semAcento(r[cStatus])]
    if (!status) desconhecidos.add(r[cStatus])
    return {
      cpf: soDigitos(r[cCpf]),
      docente: cNome ? r[cNome] : null,
      gre: cGre ? normalizarGre(r[cGre]) : null,
      inep: cInep ? r[cInep] : null,
      escola: cEscola ? r[cEscola] : null,
      status,
    }
  })

  if (desconhecidos.size) {
    throw new Error(
      `Status nao reconhecido na coluna "${cStatus}": ${[...desconhecidos].map((v) => JSON.stringify(v)).join(', ')}.\n` +
      `Aceitos hoje: ${Object.keys(STATUS).join(', ')}.`
    )
  }

  // A foto atual so e substituida por uma igual ou mais nova. Sem esta trava,
  // reimportar por engano a planilha do mes passado apagaria o resultado de
  // hoje, e nada na tela denunciaria a troca.
  const [[anterior]] = await conn.query(
    `SELECT MAX(referencia) AS ultima
       FROM resultado_importacoes
      WHERE course_id = ? AND tipo = 'consolidado'`, [ctx.cursoId]
  )
  const ultima = dia(anterior.ultima)
  if (ultima && ctx.referencia < ultima) {
    throw new Error(
      `Ja existe consolidado de ${ultima} para este curso, mais novo que ` +
      `${ctx.referencia}. Confira a data antes de sobrescrever.`
    )
  }

  const importacaoId = await registrarImportacao(conn, ctx, linhas.length)

  // Detalhe guarda so a fotografia mais recente (ver resultados.schema.js).
  await conn.query('DELETE FROM consolidado_vinculos WHERE course_id = ?', [ctx.cursoId])

  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE)
    await conn.query(
      `INSERT INTO consolidado_vinculos
         (importacao_id, course_id, cpf, docente, gre, inep, escola, status)
       VALUES ?`,
      [fatia.map((l) => [importacaoId, ctx.cursoId, l.cpf, l.docente, l.gre, l.inep, l.escola, l.status])]
    )
  }

  // O vinculo com o cadastro e feito em SQL, num passe so: 12 mil consultas
  // uma a uma levariam minutos para produzir o mesmo resultado.
  const [ligou] = await conn.query(
    `UPDATE consolidado_vinculos v
       JOIN cursistas c ON c.cpf = v.cpf
        SET v.cursista_id = c.id
      WHERE v.course_id = ?`, [ctx.cursoId]
  )

  /**
   * Historico somado por GRE.
   *
   * `pessoas` conta CPF distinto DENTRO da GRE: quem leciona em duas regionais
   * entra nas duas, entao somar a coluna entre GREs nao devolve o total de
   * pessoas do curso. O total distinto sai do detalhe, nunca desta soma.
   */
  await conn.query(
    `INSERT INTO consolidado_historico (course_id, referencia, gre, vinculos, pessoas, concluidos)
     SELECT course_id, ?, COALESCE(gre, 'Sem GRE'),
            COUNT(*), COUNT(DISTINCT cpf),
            SUM(status = 'concluido')
       FROM consolidado_vinculos
      WHERE course_id = ?
      GROUP BY course_id, COALESCE(gre, 'Sem GRE')
     ON DUPLICATE KEY UPDATE
       vinculos = VALUES(vinculos), pessoas = VALUES(pessoas), concluidos = VALUES(concluidos)`,
    [ctx.referencia, ctx.cursoId]
  )

  const [[r]] = await conn.query(
    `SELECT COUNT(*) vinculos, COUNT(DISTINCT cpf) pessoas,
            SUM(status = 'concluido') concluidos,
            COUNT(DISTINCT CASE WHEN cursista_id IS NULL THEN cpf END) sem_cadastro
       FROM consolidado_vinculos WHERE course_id = ?`, [ctx.cursoId]
  )
  return { ...r, ligados: ligou.affectedRows }
}

/* ─────────────────────────── avaliacao ─────────────────────────── */

/**
 * Deduz a escala pelo conjunto de respostas dadas.
 *
 * O formulario mistura quatro vocabularios e nao anuncia qual e qual. Deduzir
 * pelo conteudo -- em vez de fixar por posicao da coluna -- e o que faz o
 * importador sobreviver a uma pergunta inserida no meio do formulario na
 * proxima edicao.
 */
function classificarEscala(respostas) {
  const conjunto = new Set(respostas.map(semAcento))
  if (conjunto.has('MUITO RELEVANTE')) return { escala: 'relevancia4', topo: 'MUITO RELEVANTE' }
  if (conjunto.has('TOTALMENTE')) return { escala: 'clareza4', topo: 'TOTALMENTE' }
  if (conjunto.has('SIM')) return { escala: 'sim3', topo: 'SIM' }
  if (conjunto.size && [...conjunto].every((v) => /^[1-5]$/.test(v))) return { escala: 'nota5', topo: '5' }
  return { escala: 'outra', topo: null }
}

async function importarAvaliacao(conn, { registros, colunas }, ctx) {
  const cTurma = acharColuna(colunas, 'TURMA')
  const cComponente = acharColuna(colunas, 'COMPONENTE')
  const cCurso = acharColuna(colunas, 'CURSO', 'AVALIANDO')
  const cCarimbo = acharColuna(colunas, 'CARIMBO') || colunas[0]

  const perguntas = colunas.filter((c) => ![cTurma, cComponente, cCurso, cCarimbo].includes(c))
  if (!perguntas.length) throw new Error('Nenhuma coluna de pergunta encontrada.')

  const importacaoId = await registrarImportacao(conn, ctx, registros.length)
  await conn.query('DELETE FROM avaliacao_respostas WHERE course_id = ?', [ctx.cursoId])

  const linhas = []
  const semEscala = []

  perguntas.forEach((pergunta, indice) => {
    // Em branco nao e resposta. Contar o vazio inflaria o denominador e
    // rebaixaria a pergunta que teve gente pulando, sem que ninguem a tenha
    // avaliado mal.
    const dadas = registros.map((r) => r[pergunta]).filter((v) => v !== '')
    const { escala, topo } = classificarEscala(dadas)
    if (escala === 'outra') semEscala.push(pergunta)

    const contagem = new Map()
    registros.forEach((r) => {
      const resposta = r[pergunta]
      if (resposta === '') return
      const chave = [resposta, r[cTurma] || '', r[cComponente] || ''].join(SEP)
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    })

    for (const [chave, total] of contagem) {
      const [resposta, turma, componente] = chave.split(SEP)
      linhas.push([
        importacaoId, ctx.cursoId, indice + 1, pergunta.trim().slice(0, 255),
        escala, resposta.slice(0, 60),
        topo && semAcento(resposta) === topo ? 1 : 0,
        turma || null, componente || null, total,
      ])
    }
  })

  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    await conn.query(
      `INSERT INTO avaliacao_respostas
         (importacao_id, course_id, ordem, pergunta, escala, resposta, topo, turma, componente, total)
       VALUES ?`, [linhas.slice(i, i + LOTE)]
    )
  }

  return {
    respostas: registros.length,
    perguntas: perguntas.length,
    linhasGravadas: linhas.length,
    // Pergunta sem escala reconhecida entra como 'outra' e nao ganha resposta de
    // topo -- ela conta, mas fica fora da comparacao entre perguntas. Avisar
    // aqui evita que ela desapareca do painel sem ninguem notar.
    semEscalaReconhecida: semEscala.length ? semEscala.join(' | ') : 'nenhuma',
    cursosNaPlanilha: cCurso ? [...new Set(registros.map((r) => r[cCurso]))].join(' | ') : '(coluna ausente)',
  }
}

/* ─────────────────────────── comum ─────────────────────────── */

async function registrarImportacao(conn, ctx, linhas) {
  await conn.query(
    'DELETE FROM resultado_importacoes WHERE course_id = ? AND tipo = ? AND referencia = ?',
    [ctx.cursoId, ctx.tipo, ctx.referencia]
  )
  const [res] = await conn.query(
    `INSERT INTO resultado_importacoes (course_id, tipo, referencia, arquivo, linhas, importado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ctx.cursoId, ctx.tipo, ctx.referencia, path.basename(ctx.arquivo).slice(0, 255), linhas, ctx.por || 'importador']
  )
  return res.insertId
}

/* ─────────────────────────── principal ─────────────────────────── */

async function principal() {
  const args = lerArgumentos(process.argv)
  const tipo = args.tipo
  const cursoId = Number(args.curso)
  const arquivo = args.arquivo
  const referencia = args.referencia || hoje()

  if (!['consolidado', 'avaliacao'].includes(tipo)) throw new Error('--tipo deve ser consolidado ou avaliacao')
  if (!cursoId) throw new Error('--curso e obrigatorio (o id do curso no sistema)')
  if (!arquivo || !fs.existsSync(arquivo)) throw new Error(`Arquivo nao encontrado: ${arquivo}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(referencia)) throw new Error('--referencia deve ser AAAA-MM-DD')

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  try {
    const [[curso]] = await conn.query('SELECT id, name FROM courses WHERE id = ?', [cursoId])
    if (!curso) throw new Error(`Curso ${cursoId} nao existe.`)

    const dados = lerCsvComCabecalho(fs.readFileSync(arquivo, 'utf8'))
    console.log(`\nArquivo:    ${path.basename(arquivo)}`)
    console.log(`Curso:      ${curso.id} - ${curso.name}`)
    console.log(`Referencia: ${referencia}`)
    console.log(`Linhas:     ${dados.registros.length}\n`)

    const ctx = { cursoId, tipo, referencia, arquivo }

    // Tudo ou nada: a importacao apaga o detalhe antes de gravar o novo. Uma
    // falha no meio, sem transacao, deixaria o curso sem resultado nenhum.
    await conn.beginTransaction()
    const resumo = tipo === 'consolidado'
      ? await importarConsolidado(conn, dados, ctx)
      : await importarAvaliacao(conn, dados, ctx)
    await conn.commit()

    console.log('Importado:')
    Object.entries(resumo).forEach(([k, v]) => {
      console.log(`  ${String(k).padEnd(22)} ${v}`)
    })
    console.log('')
  } catch (erro) {
    await conn.rollback().catch(() => {})
    throw erro
  } finally {
    await conn.end()
  }
}

principal().catch((erro) => {
  console.error(`\nFALHOU: ${erro.message}\n`)
  process.exit(1)
})
