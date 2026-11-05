'use strict'

const repo = require('./cursistas.repo')
const obrigatorios = require('./cursistas.obrigatorios')
const { padronizarGre } = require('../../shared/gre')
const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf, formatCpf } = require('../../shared/cpf')
const { lerPlanilha, criarPlanilha } = require('../../shared/xlsx')
const { registrar, ACOES } = require('../../shared/audit')

/**
 * Diretores escolares: uma base propria, ligada aos cursistas pelo CPF.
 *
 * A planilha vem das GREs, uma por regional (a aba ou o arquivo se chama
 * "15ª GRE"), com matricula, CPF, nome, INEP e escola. A importacao:
 *  - grava/atualiza o diretor na tabela `diretores` (chave: CPF);
 *  - quem ainda nao e cursista ganha a conta, com a funcao "Diretor(a)
 *    escolar" e o vinculo da escola -- para entrar e se inscrever;
 *  - quem ja e cursista so e ligado: os dados dele nao mudam.
 *
 * A diferenciacao (selo "Diretor(a)" na lista, filtro, resumo por GRE) vem
 * desta tabela, e nao da funcao do cadastro: um professor que vira diretor
 * continua com o cadastro dele.
 */

const FUNCAO_DIRETOR = 'Diretor(a) escolar'
const MAX_LINHAS = 5000

function erro(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

const texto = (valor, limite) => String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite)

async function garantirEsquema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS diretores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cpf CHAR(11) NOT NULL,
      nome VARCHAR(150) NOT NULL,
      matricula VARCHAR(30) DEFAULT NULL,
      inep VARCHAR(12) DEFAULT NULL,
      escola VARCHAR(200) DEFAULT NULL,
      gre VARCHAR(60) DEFAULT NULL,
      cursista_id INT DEFAULT NULL,
      importado_por VARCHAR(150) DEFAULT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_diretores_cpf (cpf),
      KEY ix_diretores_gre (gre),
      KEY ix_diretores_inep (inep),
      CONSTRAINT fk_diretores_cursista
        FOREIGN KEY (cursista_id) REFERENCES cursistas(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

/** "NOME DO(A) DIRETOR(A)" -> "NOME_DO_A_DIRETOR_A", sem acento. */
const chaveDaColuna = (c) => String(c ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

const COLUNAS = {
  matricula: ['MATRICULA', 'MATRICULA_SEE'],
  cpf: ['CPF'],
  nome: ['NOME_DO_A_DIRETOR_A', 'NOME_DO_DIRETOR', 'NOME_DA_DIRETORA', 'NOME_DIRETOR', 'NOME_COMPLETO', 'NOME', 'DIRETOR', 'DIRETOR_A'],
  inep: ['CODIGO_INEP', 'COD_INEP', 'INEP'],
  escola: ['ESCOLA', 'NOME_DA_ESCOLA', 'UNIDADE_ESCOLAR'],
  gre: ['GRE', 'REGIONAL'],
}

/** "15ª GRE" num nome de aba ou de arquivo; null se nao houver regional. */
function greDoTexto(valor) {
  const m = String(valor || '').match(/(\d{1,2})\s*(?:ª|º|°|a|o)?\s*GRE/i) || String(valor || '').match(/GRE\s*[-_ ]?\s*(\d{1,2})/i)
  if (!m) return null
  const gre = padronizarGre(`${Number(m[1])}ª GRE`)
  return /^\d{1,2}ª GRE$/.test(gre || '') ? gre : null
}

/**
 * Le todas as abas que tenham CPF e nome. A GRE de cada linha vem, nesta
 * ordem: da coluna GRE, do nome da aba, do nome do arquivo.
 */
function lerRegistros(arquivo, nomeDoArquivo) {
  if (!Buffer.isBuffer(arquivo) || !arquivo.length) throw erro(400, 'Envie a planilha de diretores (.xlsx).')
  if (!(arquivo[0] === 0x50 && arquivo[1] === 0x4b)) throw erro(400, 'A planilha precisa estar em .xlsx.')

  const greDoArquivo = greDoTexto(nomeDoArquivo)
  const registros = []
  const totais = []
  let abasLidas = 0

  for (const [nomeDaAba, aba] of lerPlanilha(arquivo)) {
    const mapa = {}
    for (const original of aba.cabecalho) {
      const chave = chaveDaColuna(original)
      for (const [campo, aceitas] of Object.entries(COLUNAS)) {
        if (!mapa[campo] && aceitas.includes(chave)) mapa[campo] = original
      }
    }
    if (!mapa.cpf || !mapa.nome) continue
    abasLidas += 1
    const greDaAba = greDoTexto(nomeDaAba)

    aba.registros.forEach((r, i) => {
      const cpfBruto = String(r[mapa.cpf] ?? '').trim()
      const linha = { aba: nomeDaAba, linha: i + 2 }
      // Linha de total no fim ("22 DIRETORES", "22 ESCOLAS"): letras no lugar
      // do CPF. Nao e erro de preenchimento -- so nao e diretor.
      if (/[a-z]/i.test(cpfBruto)) { totais.push(linha); return }
      registros.push({
        ...linha,
        cpfBruto,
        nome: texto(r[mapa.nome], 150),
        matricula: mapa.matricula ? texto(r[mapa.matricula], 30) : '',
        inep: mapa.inep ? texto(r[mapa.inep], 12).replace(/\D/g, '') : '',
        escola: mapa.escola ? texto(r[mapa.escola], 200) : '',
        gre: (mapa.gre && padronizarGre(texto(r[mapa.gre], 60))) || greDaAba || greDoArquivo,
      })
    })
  }

  if (!abasLidas) throw erro(400, 'Nenhuma aba com as colunas CPF e NOME DO(A) DIRETOR(A). Use o modelo de diretores.')
  if (registros.length > MAX_LINHAS) throw erro(400, `A planilha tem ${registros.length} linhas; o limite e ${MAX_LINHAS}.`)
  return { registros, linhasDeTotal: totais.length }
}

/** Separa validos e problemas, sem tocar no banco. */
function classificar(registros) {
  const validos = []
  const problemas = []
  const vistos = new Map()
  for (const r of registros) {
    const cpf = normalizeCpf(r.cpfBruto)
    const recusar = (motivo) => problemas.push({ aba: r.aba, linha: r.linha, cpf: r.cpfBruto, nome: r.nome, motivo })
    if (!r.cpfBruto) { recusar('CPF vazio'); continue }
    if (!isValidCpf(cpf)) { recusar('CPF invalido (digitos verificadores nao conferem)'); continue }
    if (!r.nome) { recusar('Nome vazio'); continue }
    if (!r.gre) { recusar('GRE nao identificada: inclua a coluna GRE ou nomeie a aba como "15ª GRE"'); continue }
    if (vistos.has(cpf)) { recusar(`CPF repetido (ja aparece em ${vistos.get(cpf)})`); continue }
    vistos.set(cpf, `${r.aba}, linha ${r.linha}`)
    validos.push({ ...r, cpf })
  }
  return { validos, problemas }
}

/**
 * Confere (gravar: false) ou importa a planilha.
 * @returns resumo com novos, atualizados, contas criadas e os problemas.
 */
async function importar({ arquivo, nomeDoArquivo, gravar = false, actor, req }) {
  requireMysql()
  const { registros, linhasDeTotal } = lerRegistros(arquivo, nomeDoArquivo)
  return aplicar({ registros, linhasDeTotal, gravar, actor, req, origem: texto(nomeDoArquivo, 120) })
}

/**
 * Um diretor por vez, pelo formulario. Mesmo caminho da planilha: quem ja e
 * cursista so e marcado; quem nao e ganha a conta.
 *
 * Para poupar digitacao: sem nome, vale o do cadastro do cursista; com o INEP
 * e sem escola/GRE, elas vem dos vinculos que ja existem para aquela escola.
 */
async function adicionarManual({ dados = {}, actor, req }) {
  requireMysql()
  const pool = getPool()
  const cpf = normalizeCpf(dados.cpf)
  let nome = texto(dados.nome, 150)
  const inep = texto(dados.inep, 12).replace(/\D/g, '')
  let escola = texto(dados.escola, 200)
  let gre = padronizarGre(texto(dados.gre, 60))

  if (!nome && isValidCpf(cpf)) {
    const [[cad]] = await pool.query('SELECT name FROM cursistas WHERE cpf = ?', [cpf])
    if (cad) nome = texto(cad.name, 150)
  }
  if (inep && (!escola || !gre)) {
    const [[esc]] = await pool.query(
      `SELECT MAX(escola) AS escola, MAX(gre) AS gre FROM cursista_vinculos WHERE inep = ?`, [inep]
    )
    if (!escola && esc?.escola) escola = texto(esc.escola, 200)
    if (!gre && esc?.gre) gre = padronizarGre(esc.gre)
  }

  const resultado = await aplicar({
    registros: [{ aba: 'Formulario', linha: 1, cpfBruto: String(dados.cpf ?? '').trim(), nome, matricula: texto(dados.matricula, 30), inep, escola, gre }],
    linhasDeTotal: 0, gravar: true, actor, req, origem: 'manual',
  })
  if (resultado.problemas.length) {
    const motivo = resultado.problemas[0].motivo
    throw erro(400, motivo === 'Nome vazio' ? 'Informe o nome: este CPF ainda nao e cursista.' : motivo.replace(': inclua a coluna GRE ou nomeie a aba como "15ª GRE"', ': escolha a GRE.'))
  }
  const r = resultado.resumo
  return { nome, gre, escola, novo: r.novos > 0, contaCriada: r.contasCriadas > 0 }
}

async function aplicar({ registros, linhasDeTotal, gravar, actor, req, origem }) {
  const { validos, problemas } = classificar(registros)
  const pool = getPool()

  const cpfs = validos.map((v) => v.cpf)
  const diretoresAtuais = new Map()
  const cursistasAtuais = new Map()
  if (cpfs.length) {
    const [d] = await pool.query('SELECT cpf, nome, matricula, inep, escola, gre FROM diretores WHERE cpf IN (?)', [cpfs])
    d.forEach((l) => diretoresAtuais.set(l.cpf, l))
    const [c] = await pool.query('SELECT id, cpf FROM cursistas WHERE cpf IN (?)', [cpfs])
    c.forEach((l) => cursistasAtuais.set(l.cpf, l.id))
  }

  const resumo = { linhas: registros.length, linhasDeTotal, novos: 0, atualizados: 0, inalterados: 0, jaEramCursistas: 0, contasCriadas: 0, ignorados: problemas.length }
  const porGre = {}
  for (const v of validos) {
    porGre[v.gre] = (porGre[v.gre] || 0) + 1
    const atual = diretoresAtuais.get(v.cpf)
    if (!atual) resumo.novos += 1
    else if (['nome', 'matricula', 'inep', 'escola', 'gre'].some((k) => String(atual[k] || '') !== String(v[k] || ''))) resumo.atualizados += 1
    else resumo.inalterados += 1
    if (cursistasAtuais.has(v.cpf)) resumo.jaEramCursistas += 1
    else resumo.contasCriadas += 1
  }

  if (gravar && validos.length) {
    const conexao = await pool.getConnection()
    try {
      await conexao.beginTransaction()

      // Contas novas: mesmo caminho da importacao da base de cursistas.
      const novosCursistas = validos.filter((v) => !cursistasAtuais.has(v.cpf)).map((v) => ({
        cpf: v.cpf,
        name: v.nome,
        usuarioId: null,
        funcao: FUNCAO_DIRETOR,
        qtdeVinculos: 1,
        status: 'ativo',
        vinculos: [{ ordem: 1, inep: v.inep || null, gre: v.gre, escola: v.escola || null }],
      }))
      for (let i = 0; i < novosCursistas.length; i += 500) {
        const lote = novosCursistas.slice(i, i + 500)
        await repo.inserirLoteImportacao(lote, conexao)
        await repo.substituirVinculos(lote, conexao)
      }

      const [ids] = await conexao.query('SELECT id, cpf FROM cursistas WHERE cpf IN (?)', [cpfs])
      const idPorCpf = new Map(ids.map((l) => [l.cpf, l.id]))
      for (let i = 0; i < validos.length; i += 500) {
        const lote = validos.slice(i, i + 500)
        await conexao.query(
          `INSERT INTO diretores (cpf, nome, matricula, inep, escola, gre, cursista_id, importado_por) VALUES ?
           ON DUPLICATE KEY UPDATE nome = VALUES(nome), matricula = VALUES(matricula), inep = VALUES(inep),
             escola = VALUES(escola), gre = VALUES(gre), cursista_id = VALUES(cursista_id), importado_por = VALUES(importado_por)`,
          [lote.map((v) => [v.cpf, v.nome, v.matricula || null, v.inep || null, v.escola || null, v.gre, idPorCpf.get(v.cpf) || null, actor?.name || null])]
        )
      }

      // Contas novas entram nos cursos obrigatorios (e nos certificados que ja tiverem).
      if (novosCursistas.length) await obrigatorios.sincronizar({ conexao })
      await conexao.commit()
    } catch (e) {
      await conexao.rollback()
      throw e
    } finally {
      conexao.release()
    }

    await registrar({
      actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
      action: ACOES.DIRETORES_IMPORTADOS, req, details: { origem, ...resumo, porGre },
    })
  }

  return { gravado: Boolean(gravar), resumo, porGre, problemas: problemas.slice(0, 300), totalProblemas: problemas.length }
}

/** Ordem natural das regionais: 1ª, 2ª ... 16ª, e o resto depois. */
const ordemDaGre = (gre) => {
  const n = Number(String(gre || '').match(/^(\d+)/)?.[1])
  return Number.isFinite(n) ? n : 99
}

/**
 * O cruzamento por GRE: quantos diretores, de quantas escolas, quantos ja
 * entraram na plataforma e quantos estao inscritos em algum curso. So numeros.
 */
async function resumoPorGre() {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT d.gre,
            COUNT(*) AS diretores,
            COUNT(DISTINCT NULLIF(d.inep, '')) AS escolas,
            SUM(cu.password_hash IS NOT NULL) AS acessaram,
            SUM(EXISTS (SELECT 1 FROM inscricoes i WHERE i.cursista_id = cu.id AND i.status = 'inscrito')) AS inscritos
       FROM diretores d
       LEFT JOIN cursistas cu ON cu.id = d.cursista_id
      GROUP BY d.gre`
  )
  const gres = linhas.map((l) => ({
    gre: l.gre || 'Sem GRE',
    diretores: Number(l.diretores),
    escolas: Number(l.escolas),
    acessaram: Number(l.acessaram || 0),
    inscritos: Number(l.inscritos || 0),
  })).sort((a, b) => ordemDaGre(a.gre) - ordemDaGre(b.gre))
  const total = gres.reduce((t, g) => ({
    diretores: t.diretores + g.diretores, escolas: t.escolas + g.escolas,
    acessaram: t.acessaram + g.acessaram, inscritos: t.inscritos + g.inscritos,
  }), { diretores: 0, escolas: 0, acessaram: 0, inscritos: 0 })
  return { gres, total }
}

/** A base de diretores em .xlsx (filtrada por GRE, se pedir). */
async function exportar({ gre = '' } = {}) {
  requireMysql()
  const filtro = gre ? 'WHERE d.gre = ?' : ''
  const [linhas] = await getPool().query(
    `SELECT d.*, cu.password_hash IS NOT NULL AS acessou,
            (SELECT COUNT(*) FROM inscricoes i WHERE i.cursista_id = cu.id AND i.status = 'inscrito') AS cursos
       FROM diretores d LEFT JOIN cursistas cu ON cu.id = d.cursista_id
       ${filtro}`,
    gre ? [gre] : []
  )
  linhas.sort((a, b) => ordemDaGre(a.gre) - ordemDaGre(b.gre) || String(a.escola || '').localeCompare(String(b.escola || ''), 'pt-BR'))
  return criarPlanilha({
    nomeAba: 'Diretores',
    colunas: [
      { titulo: 'GRE', valor: (l) => l.gre || '' },
      { titulo: 'CODIGO INEP', valor: (l) => l.inep || '' },
      { titulo: 'ESCOLA', valor: (l) => l.escola || '' },
      { titulo: 'MATRICULA', valor: (l) => l.matricula || '' },
      { titulo: 'CPF', valor: (l) => formatCpf(l.cpf) },
      { titulo: 'NOME DO(A) DIRETOR(A)', valor: (l) => l.nome },
      { titulo: 'JA ACESSOU', valor: (l) => (Number(l.acessou) ? 'Sim' : 'Nao') },
      { titulo: 'CURSOS INSCRITOS', valor: (l) => Number(l.cursos || 0), numerica: true },
    ],
    linhas,
  })
}

module.exports = { garantirEsquema, importar, adicionarManual, resumoPorGre, exportar, FUNCAO_DIRETOR }
