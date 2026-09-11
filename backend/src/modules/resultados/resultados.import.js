'use strict'

const { lerPlanilha } = require('../../shared/xlsx')
const { textoDoArquivo, lerCsvComCabecalho } = require('../../shared/csvLeitura')

/**
 * Importacao das planilhas de resultado de curso.
 *
 * Tres tipos, cada um com o seu destino:
 *   consolidado -- quem concluiu, por vinculo escolar       (por curso)
 *   avaliacao   -- o formulario de satisfacao, anonimo      (por curso)
 *   municipios  -- o de-para INEP -> municipio do Censo      (rede inteira)
 *
 * Tem dois clientes: a tela de envio do dashboard e o script de linha de
 * comando. Os dois chamam `executar()`, e nenhum tem copia propria das regras --
 * duas versoes de "o que conta como concluido" divergiriam na primeira correcao.
 *
 * "Enviar de novo atualiza por cima": a mesma planilha do mesmo curso na mesma
 * data de referencia substitui a anterior. Consolidado de outra data vira uma
 * fotografia nova -- o detalhe e trocado, e a evolucao ganha um ponto.
 */

const erro = (mensagem) => Object.assign(new Error(mensagem), { statusCode: 400 })

/* ─────────────────────────── leitura do arquivo ─────────────────────────── */

/**
 * Uma celula do .xlsx como texto, do jeito que o importador espera.
 *
 * O leitor de .xlsx devolve o valor GRAVADO, nao o exibido. Duas diferencas
 * morderiam em silencio:
 *   - numero inteiro vem com casa decimal: a nota "5" chega como "5.0". A escala
 *     de 1 a 5 nao seria reconhecida e a nota media sairia zerada;
 *   - datas vem como numero serial -- tratadas em `carimboSql`, que sabe que
 *     aquela coluna e data.
 *
 * O ".0" so e cortado quando nao ha mais nada depois dele: -6.1882324 continua
 * sendo coordenada.
 */
function normalizarCelula(valor) {
  const texto = String(valor ?? '').trim()
  return /^-?\d+\.0+$/.test(texto) ? texto.replace(/\.0+$/, '') : texto
}

/**
 * O arquivo enviado, aberto em abas.
 *
 * .xlsx e reconhecido pelos bytes, e nao pela extensao: ZIP comeca com "PK", e
 * um arquivo renomeado a mao continua sendo o que ele e. Qualquer outra coisa e
 * lida como CSV, que tem uma aba so.
 */
function abrirArquivo(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw erro('O arquivo chegou vazio.')

  const ehXlsx = buffer[0] === 0x50 && buffer[1] === 0x4b
  if (ehXlsx) {
    const abas = []
    for (const [nome, { cabecalho, registros }] of lerPlanilha(buffer)) {
      const colunas = cabecalho.filter(Boolean)
      abas.push({
        nome,
        colunas,
        registros: registros.map((r) => {
          const limpo = {}
          colunas.forEach((c) => { limpo[c] = normalizarCelula(r[c]) })
          return limpo
        }),
      })
    }
    return abas
  }

  const { colunas, registros } = lerCsvComCabecalho(textoDoArquivo(buffer))
  return [{ nome: 'CSV', colunas, registros }]
}

/* ─────────────────────────── normalizacoes ─────────────────────────── */

/**
 * O CPF chega da planilha formatado ("000.000.000-00") e o sistema guarda os 11
 * digitos. O padStart importa: o Excel come o zero a esquerda ao tratar CPF como
 * numero, e 07712345678 volta como 7712345678 -- que nao casa com ninguem.
 */
const soDigitos = (v) => String(v || '').replace(/\D/g, '').padStart(11, '0')

const semAcento = (v) => String(v || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()

/**
 * A GRE, no formato que o sistema ja usa.
 *
 * A base oficial gravou "1ª GRE" e a planilha de resultado traz "01ª GRE" -- as
 * mesmas dezesseis regionais, com rotulos diferentes. Sem esta conversao o
 * filtro por regional devolveria zero sem erro nenhum.
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
const SEP = ''

/** Acha a coluna cujo nome contem todos os pedacos dados. */
function acharColuna(colunas, ...pedacos) {
  const alvo = pedacos.map(semAcento)
  return colunas.find((c) => alvo.every((p) => semAcento(c).includes(p))) || null
}

/** DATE do MySQL como texto AAAA-MM-DD, sem passar por UTC. */
function dia(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * O carimbo do formulario para DATETIME.
 *
 * Chega de tres jeitos, conforme quem gerou o arquivo:
 *   - "13/07/2026 18:24:07", do CSV do Google Forms -- dia primeiro. `new Date`
 *     disso falha ou le como mes primeiro;
 *   - "2026-07-13 18:24:07", de exportacao de outra ferramenta;
 *   - 46216.7667, o numero serial que o .xlsx grava por baixo da data exibida.
 *
 * O serial conta dias desde 30/12/1899 e NAO tem fuso: 46216.7667 e 18:24 no
 * relogio de quem preencheu, ponto. Por isso a conversao usa os campos UTC do
 * Date -- os locais somariam o fuso do servidor e empurrariam a noite para o
 * dia seguinte.
 */
function carimboSql(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return null

  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})[ ,]*(\d{2}:\d{2}(:\d{2})?)?/)
  if (br) return `${br[3]}-${br[2]}-${br[1]} ${br[4] || '00:00:00'}`

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T ]*(\d{2}:\d{2}(:\d{2})?)?/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]} ${iso[4] || '00:00:00'}`

  // Serial do Excel. O piso de 20000 (ano de 1954) separa data de um numero
  // qualquer que tenha ido parar na coluna por engano.
  if (/^\d+(\.\d+)?$/.test(texto) && Number(texto) > 20000) {
    const ms = Math.round((Number(texto) - 25569) * 86400) * 1000
    const d = new Date(ms)
    const dois = (n) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())} `
      + `${dois(d.getUTCHours())}:${dois(d.getUTCMinutes())}:${dois(d.getUTCSeconds())}`
  }

  return null
}

/* ─────────────────────────── escolha da aba ─────────────────────────── */

/**
 * Qual aba do arquivo tem os dados de cada tipo.
 *
 * Pelo CONTEUDO, e nao pelo nome: a planilha do consolidado tem tres abas e so
 * uma delas tem CPF e STATUS; a base enriquecida tem cinco, e tres delas trazem
 * alguma coluna de INEP e de municipio. A regra de cada tipo diz o que a aba
 * precisa ter, e o criterio de desempate escolhe a mais enxuta -- a de
 * referencia, e nao a que repete o municipio a cada vinculo de professor.
 *
 * A aba escolhida volta na conferencia. Se o arquivo tiver uma aba parecida que
 * nao e a certa, quem esta enviando ve o nome dela antes de gravar.
 */
const REGRAS_DE_ABA = {
  consolidado: (c) => acharColuna(c, 'CPF') && acharColuna(c, 'STATUS'),
  avaliacao: (c) => acharColuna(c, 'COMPONENTE') && (acharColuna(c, 'CARIMBO') || acharColuna(c, 'TURMA')),
  municipios: (c) => acharColuna(c, 'INEP') && (acharColuna(c, 'MUNICIPIO') || acharColuna(c, 'CIDADE')),
}

const EXIGENCIA = {
  consolidado: 'as colunas CPF e STATUS',
  avaliacao: 'a coluna de componente curricular e a de carimbo de data/hora',
  municipios: 'as colunas INEP e MUNICIPIO',
}

function escolherAba(abas, tipo) {
  const candidatas = abas
    .filter((a) => a.registros.length && REGRAS_DE_ABA[tipo](a.colunas))
    .sort((a, b) => a.colunas.length - b.colunas.length)

  if (!candidatas.length) {
    throw erro(
      `Nenhuma aba deste arquivo tem ${EXIGENCIA[tipo]}. `
      + `Abas encontradas: ${abas.map((a) => `"${a.nome}"`).join(', ') || 'nenhuma'}. `
      + 'Confira se o tipo de planilha escolhido é o deste arquivo.'
    )
  }
  return candidatas[0]
}

/* ─────────────────────────── consolidado ─────────────────────────── */

async function importarConsolidado(conn, { registros, colunas }, ctx) {
  const cCpf = acharColuna(colunas, 'CPF')
  const cStatus = acharColuna(colunas, 'STATUS')
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
      inep: cInep ? String(r[cInep] || '').replace(/\D/g, '') || null : null,
      escola: cEscola ? r[cEscola] : null,
      status,
    }
  })

  if (desconhecidos.size) {
    throw erro(
      `Situação não reconhecida na coluna "${cStatus}": `
      + `${[...desconhecidos].slice(0, 5).map((v) => `"${v}"`).join(', ')}. `
      + 'Aceitos hoje: CONCLUÍDO, NÃO CONCLUÍDO e EM ANDAMENTO.'
    )
  }

  // A foto atual so e substituida por uma igual ou mais nova. Sem esta trava,
  // reenviar por engano a planilha do mes passado apagaria o resultado de hoje,
  // e nada na tela denunciaria a troca.
  const [[anterior]] = await conn.query(
    `SELECT MAX(referencia) AS ultima
       FROM resultado_importacoes
      WHERE course_id = ? AND tipo = 'consolidado'`, [ctx.cursoId]
  )
  const ultima = dia(anterior.ultima)
  if (ultima && ctx.referencia < ultima) {
    throw erro(
      `Este curso já tem consolidado de ${ultima.split('-').reverse().join('/')}, mais novo que a `
      + `data escolhida (${ctx.referencia.split('-').reverse().join('/')}). Confira a data de referência.`
    )
  }

  const importacaoId = await registrarImportacao(conn, ctx, linhas.length)

  // Detalhe guarda so a fotografia mais recente (ver resultados.schema.js).
  await conn.query('DELETE FROM consolidado_vinculos WHERE course_id = ?', [ctx.cursoId])

  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    await conn.query(
      `INSERT INTO consolidado_vinculos
         (importacao_id, course_id, cpf, docente, gre, inep, escola, status)
       VALUES ?`,
      [linhas.slice(i, i + LOTE).map((l) => [
        importacaoId, ctx.cursoId, l.cpf, l.docente, l.gre, l.inep, l.escola, l.status,
      ])]
    )
  }

  // O vinculo com o cadastro e feito em SQL, num passe so: doze mil consultas
  // uma a uma levariam minutos para produzir o mesmo resultado.
  await conn.query(
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
    `SELECT COUNT(*) AS vinculos,
            COUNT(DISTINCT cpf) AS pessoas,
            COUNT(DISTINCT CASE WHEN status = 'concluido' THEN cpf END) AS concluintes,
            SUM(status = 'em_andamento') AS emAndamento,
            COUNT(DISTINCT CASE WHEN cursista_id IS NULL THEN cpf END) AS semCadastro,
            COUNT(DISTINCT inep) AS escolas,
            COUNT(DISTINCT gre) AS gres
       FROM consolidado_vinculos WHERE course_id = ?`, [ctx.cursoId]
  )

  const n = (v) => Number(v || 0)
  const taxa = n(r.pessoas) ? Math.round((n(r.concluintes) / n(r.pessoas)) * 1000) / 10 : 0

  const avisos = []
  if (n(r.semCadastro)) {
    avisos.push(
      `${n(r.semCadastro).toLocaleString('pt-BR')} docentes da planilha não foram encontrados na base `
      + 'de cursistas pelo CPF. Eles contam na conclusão, mas ficam fora dos gráficos por componente e por função.'
    )
  }
  if (!cGre) avisos.push('A planilha não tem coluna de GRE: o filtro e o gráfico por regional ficarão vazios.')
  if (!cInep) avisos.push('A planilha não tem coluna de INEP: o gráfico por município ficará vazio.')

  return {
    resumo: [
      { rotulo: 'Linhas (vínculos com escola)', valor: n(r.vinculos) },
      { rotulo: 'Docentes', valor: n(r.pessoas) },
      { rotulo: 'Concluíram', valor: n(r.concluintes) },
      { rotulo: 'Taxa de conclusão', valor: `${taxa.toFixed(1).replace('.', ',')}%` },
      ...(n(r.emAndamento) ? [{ rotulo: 'Em andamento (vínculos)', valor: n(r.emAndamento) }] : []),
      { rotulo: 'Escolas', valor: n(r.escolas) },
      { rotulo: 'GREs', valor: n(r.gres) },
    ],
    avisos,
  }
}

/* ─────────────────────────── avaliacao ─────────────────────────── */

/**
 * Em que banda cada resposta cai.
 *
 * E o que torna as onze perguntas comparaveis entre si: acertar o topo de uma
 * escala de tres opcoes e mais facil do que o de uma de cinco, e o mesmo
 * entusiasmo produzia percentuais diferentes so por causa do tamanho da regua.
 *
 * A opcao e classificada pelo SIGNIFICADO. 'Relevante' e positivo mesmo nao
 * sendo o topo; 'Parcialmente' e neutro em qualquer escala onde apareca. O
 * indicador da tela e a fatia positiva sobre quem respondeu.
 *
 * Chave sem acento e em maiuscula, como tudo que passa por `semAcento`.
 */
const BANDAS = {
  'MUITO RELEVANTE': 'positiva', 'RELEVANTE': 'positiva',
  'POUCO RELEVANTE': 'negativa', 'IRRELEVANTE': 'negativa',

  'TOTALMENTE': 'positiva', 'PARCIALMENTE': 'neutra',
  'POUCO': 'negativa', 'NADA': 'negativa',

  'SIM': 'positiva', 'NAO': 'negativa',

  '5': 'positiva', '4': 'positiva', '3': 'neutra', '2': 'negativa', '1': 'negativa',
}

const bandaDe = (resposta) => BANDAS[semAcento(resposta)] || 'indefinida'

/**
 * Deduz a escala pelo conjunto de respostas dadas.
 *
 * O formulario mistura quatro vocabularios e nao anuncia qual e qual. Deduzir
 * pelo conteudo -- em vez de fixar por posicao da coluna -- e o que faz o
 * importador sobreviver a uma pergunta inserida no meio do formulario.
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
  if (!perguntas.length) throw erro('Nenhuma coluna de pergunta encontrada na planilha de avaliação.')

  const importacaoId = await registrarImportacao(conn, ctx, registros.length)
  await conn.query('DELETE FROM avaliacao_respostas WHERE course_id = ?', [ctx.cursoId])

  const linhas = []
  const semEscala = []
  const semBanda = new Set()
  const escalas = perguntas.map((pergunta) => classificarEscala(
    // Em branco nao e resposta. Contar o vazio inflaria o denominador e
    // rebaixaria a pergunta que teve gente pulando, sem que ninguem a tenha
    // avaliado mal.
    registros.map((r) => r[pergunta]).filter((v) => v !== '')
  ))

  perguntas.forEach((pergunta, indice) => {
    const { escala, topo } = escalas[indice]
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
      const banda = bandaDe(resposta)
      // Resposta que nao cai em banda nenhuma some do indicador. Avisar e o que
      // impede uma opcao nova no formulario de baixar o percentual em silencio.
      if (banda === 'indefinida') semBanda.add(resposta)
      linhas.push([
        importacaoId, ctx.cursoId, indice + 1, pergunta.trim().slice(0, 255),
        escala, resposta.slice(0, 60),
        topo && semAcento(resposta) === topo ? 1 : 0,
        banda,
        turma || null, componente || null, total,
      ])
    }
  })

  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    await conn.query(
      `INSERT INTO avaliacao_respostas
         (importacao_id, course_id, ordem, pergunta, escala, resposta, topo, banda,
          turma, componente, total)
       VALUES ?`, [linhas.slice(i, i + LOTE)]
    )
  }

  /**
   * Uma linha por respondente, para a evolucao no tempo e o detalhamento.
   *
   * Nenhuma coluna identifica quem respondeu: o formulario e anonimo e nao traz
   * CPF, nome nem e-mail.
   */
  await conn.query('DELETE FROM avaliacao_respondentes WHERE course_id = ?', [ctx.cursoId])

  const iNota = escalas.findIndex((e) => e.escala === 'nota5')

  const pessoas = registros.map((r) => {
    const respostas = {}
    let positivas = 0
    let respondidas = 0

    perguntas.forEach((q, i) => {
      const v = r[q]
      if (v === '') return
      respostas[i + 1] = v
      respondidas += 1
      if (bandaDe(v) === 'positiva') positivas += 1
    })

    const nota = iNota >= 0 ? Number(r[perguntas[iNota]]) : null

    return [
      importacaoId, ctx.cursoId,
      carimboSql(r[cCarimbo]),
      r[cTurma] || null,
      r[cComponente] || null,
      Number.isFinite(nota) && nota > 0 ? nota : null,
      positivas, respondidas,
      JSON.stringify(respostas),
    ]
  })

  for (let i = 0; i < pessoas.length; i += LOTE) {
    await conn.query(
      `INSERT INTO avaliacao_respondentes
         (importacao_id, course_id, respondido_em, turma, componente,
          nota, positivas, respondidas, respostas)
       VALUES ?`, [pessoas.slice(i, i + LOTE)]
    )
  }

  const [[r]] = await conn.query(
    `SELECT MIN(respondido_em) AS de, MAX(respondido_em) AS ate,
            AVG(nota) AS media, COUNT(DISTINCT componente) AS componentes,
            SUM(respondido_em IS NULL) AS semData
       FROM avaliacao_respondentes WHERE course_id = ?`, [ctx.cursoId]
  )

  const n = (v) => Number(v || 0)
  const dataBr = (v) => (v ? dia(v).split('-').reverse().join('/') : '—')
  const cursosNaPlanilha = cCurso ? [...new Set(registros.map((x) => x[cCurso]).filter(Boolean))] : []

  const avisos = []
  if (cursosNaPlanilha.length) {
    // A planilha diz de que curso ela e -- as vezes com erro de grafia. Mostrar o
    // texto dela ao lado do curso escolhido e o que pega o envio no curso errado.
    avisos.push(`A planilha diz que avalia: ${cursosNaPlanilha.slice(0, 3).map((c) => `"${c}"`).join(', ')}. Confira se é o curso escolhido.`)
  }
  if (n(r.semData)) avisos.push(`${n(r.semData).toLocaleString('pt-BR')} respostas sem data reconhecida ficam fora do gráfico de evolução.`)
  if (iNota < 0) avisos.push('Não encontrei a pergunta de nota de 1 a 5: a nota média e a distribuição ficarão vazias.')
  if (semEscala.length) avisos.push(`Perguntas com escala não reconhecida: ${semEscala.map((q) => `"${q.slice(0, 50)}"`).join(', ')}.`)
  if (semBanda.size) avisos.push(`Respostas que não contam como positivas nem negativas: ${[...semBanda].slice(0, 5).map((q) => `"${q}"`).join(', ')}.`)

  return {
    resumo: [
      { rotulo: 'Respostas', valor: registros.length },
      { rotulo: 'Perguntas', valor: perguntas.length },
      { rotulo: 'Período', valor: `${dataBr(r.de)} a ${dataBr(r.ate)}` },
      { rotulo: 'Nota média', valor: r.media === null ? '—' : `${Number(r.media).toFixed(2).replace('.', ',')} / 5` },
      { rotulo: 'Componentes curriculares', valor: n(r.componentes) },
    ],
    avisos,
  }
}

/* ─────────────────────────── municipios ─────────────────────────── */

/**
 * O de-para INEP -> municipio.
 *
 * Nao e uma entrega semanal como as outras duas: e uma lista de referencia que
 * muda quando a rede abre ou fecha escola. Por isso nao passa por
 * `resultado_importacoes` -- nao ha fotografia a guardar -- e o INSERT e um
 * upsert: reenviar a lista inteira corrige o que mudou sem apagar o resto.
 */
async function importarMunicipios(conn, { registros, colunas }) {
  const cInep = acharColuna(colunas, 'INEP')
  const cMunicipio = acharColuna(colunas, 'MUNICIPIO') || acharColuna(colunas, 'CIDADE')
  const cUf = acharColuna(colunas, 'UF')
  const cLocal = acharColuna(colunas, 'LOCALIZACAO')
  const cPorte = acharColuna(colunas, 'PORTE')
  const cLat = acharColuna(colunas, 'LATITUDE')
  const cLon = acharColuna(colunas, 'LONGITUDE')

  // Coordenada com virgula decimal, como o Excel escreve em portugues:
  // Number('-7,1195') e NaN, sem erro, e a escola entraria sem posicao.
  const decimal = (v) => {
    const x = Number(String(v || '').trim().replace(',', '.'))
    return Number.isFinite(x) && x !== 0 ? x : null
  }

  // Fora da Paraiba nao ha coordenada valida para este programa; um valor
  // absurdo entrando aqui poria uma escola no meio do oceano.
  const naPb = (lat, lon) => (
    lat !== null && lon !== null && lat > -9 && lat < -5 && lon > -39 && lon < -34
  )

  const linhas = registros
    .map((r) => {
      const lat = cLat ? decimal(r[cLat]) : null
      const lon = cLon ? decimal(r[cLon]) : null
      const local = cLocal ? String(r[cLocal] || '').trim() : ''
      return [
        String(r[cInep] || '').replace(/\D/g, '').padStart(8, '0'),
        String(r[cMunicipio] || '').trim(),
        (cUf ? String(r[cUf] || '').trim().toUpperCase() : 'PB') || 'PB',
        ['Urbana', 'Rural'].includes(local) ? local : null,
        cPorte ? (String(r[cPorte] || '').trim() || null) : null,
        naPb(lat, lon) ? lat : null,
        naPb(lat, lon) ? lon : null,
      ]
    })
    .filter(([inep, municipio]) => inep && inep !== '00000000' && municipio)

  if (!linhas.length) throw erro('Nenhuma escola com INEP e município preenchidos.')

  const LOTE = 1000
  for (let i = 0; i < linhas.length; i += LOTE) {
    await conn.query(
      `INSERT INTO escola_municipio
         (inep, municipio, uf, localizacao, porte, latitude, longitude)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         municipio = VALUES(municipio), uf = VALUES(uf),
         localizacao = VALUES(localizacao), porte = VALUES(porte),
         latitude = VALUES(latitude), longitude = VALUES(longitude)`,
      [linhas.slice(i, i + LOTE)]
    )
  }

  // O que importa saber nao e quantas linhas entraram, e sim quantas escolas do
  // consolidado passaram a ter municipio -- as que ficaram sem somem do grafico.
  const [[cob]] = await conn.query(
    `SELECT COUNT(DISTINCT v.inep) AS escolas,
            COUNT(DISTINCT CASE WHEN em.inep IS NOT NULL THEN v.inep END) AS comMunicipio
       FROM consolidado_vinculos v
       LEFT JOIN escola_municipio em ON em.inep = v.inep`
  )
  const [[qtd]] = await conn.query(
    `SELECT COUNT(*) AS escolas, COUNT(DISTINCT municipio) AS municipios,
            SUM(latitude IS NOT NULL) AS comCoordenada
       FROM escola_municipio`
  )

  const n = (v) => Number(v || 0)
  const avisos = []
  const semPar = n(cob.escolas) - n(cob.comMunicipio)
  if (n(cob.escolas) && semPar) {
    avisos.push(`${semPar} das ${n(cob.escolas)} escolas dos consolidados já enviados não estão nesta lista e ficam fora do gráfico por município.`)
  }

  return {
    resumo: [
      { rotulo: 'Escolas na planilha', valor: linhas.length },
      { rotulo: 'Escolas cadastradas no total', valor: n(qtd.escolas) },
      { rotulo: 'Municípios', valor: n(qtd.municipios) },
      { rotulo: 'Com coordenadas', valor: n(qtd.comCoordenada) },
      ...(n(cob.escolas) ? [{ rotulo: 'Escolas dos consolidados com município', valor: `${n(cob.comMunicipio)} de ${n(cob.escolas)}` }] : []),
    ],
    avisos,
  }
}

/* ─────────────────────────── comum ─────────────────────────── */

async function registrarImportacao(conn, ctx, linhas) {
  // Mesma planilha, mesmo curso, mesma data: a anterior sai. E o "atualiza por
  // cima" -- e o ON DELETE CASCADE leva junto as linhas que ela gravou.
  await conn.query(
    'DELETE FROM resultado_importacoes WHERE course_id = ? AND tipo = ? AND referencia = ?',
    [ctx.cursoId, ctx.tipo, ctx.referencia]
  )
  const [res] = await conn.query(
    `INSERT INTO resultado_importacoes (course_id, tipo, referencia, arquivo, linhas, importado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ctx.cursoId, ctx.tipo, ctx.referencia, String(ctx.arquivo || 'planilha').slice(0, 255),
      linhas, String(ctx.por || 'importador').slice(0, 150)]
  )
  return res.insertId
}

const TIPOS = ['consolidado', 'avaliacao', 'municipios']

/**
 * Le o arquivo, escolhe a aba e grava -- ou so simula.
 *
 * `simular` roda a importacao inteira dentro da transacao e desfaz no fim. A
 * conferencia mostra, entao, exatamente o que a gravacao faria: os mesmos
 * numeros, os mesmos avisos, e o mesmo erro se houver um. Uma conferencia que
 * calculasse por outro caminho poderia aprovar um arquivo que a gravacao
 * recusaria.
 */
async function executar({
  conexao, tipo, cursoId = null, referencia, buffer, arquivo, por, simular = false,
}) {
  if (!TIPOS.includes(tipo)) throw erro('Tipo de planilha inválido.')
  if (tipo !== 'municipios' && !cursoId) throw erro('Escolha o curso desta planilha.')
  if (tipo !== 'municipios' && !/^\d{4}-\d{2}-\d{2}$/.test(String(referencia || ''))) {
    throw erro('Informe a data de referência da planilha.')
  }

  let curso = null
  if (tipo !== 'municipios') {
    const [[achado]] = await conexao.query('SELECT id, name FROM courses WHERE id = ?', [cursoId])
    if (!achado) throw erro('Curso não encontrado.')
    curso = { id: achado.id, nome: achado.name }
  }

  const aba = escolherAba(abrirArquivo(buffer), tipo)
  const ctx = { cursoId, tipo, referencia, arquivo, por }

  // Tudo ou nada: a importacao apaga o detalhe antes de gravar o novo. Uma falha
  // no meio, sem transacao, deixaria o curso sem resultado nenhum.
  await conexao.beginTransaction()
  try {
    const resultado = tipo === 'consolidado' ? await importarConsolidado(conexao, aba, ctx)
      : tipo === 'avaliacao' ? await importarAvaliacao(conexao, aba, ctx)
        : await importarMunicipios(conexao, aba, ctx)

    if (simular) await conexao.rollback()
    else await conexao.commit()

    return {
      tipo,
      curso,
      referencia: tipo === 'municipios' ? null : referencia,
      arquivo,
      aba: aba.nome,
      linhasLidas: aba.registros.length,
      gravado: !simular,
      ...resultado,
    }
  } catch (e) {
    await conexao.rollback().catch(() => {})
    throw e
  }
}

module.exports = {
  executar,
  TIPOS,
  // expostos para teste
  abrirArquivo, escolherAba, carimboSql, normalizarCelula, normalizarGre,
}
