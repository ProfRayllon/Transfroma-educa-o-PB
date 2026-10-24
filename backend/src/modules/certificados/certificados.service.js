'use strict'

const crypto = require('node:crypto')
const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf, maskCpf, formatCpf } = require('../../shared/cpf')
const { lerPlanilha, criarPlanilha } = require('../../shared/xlsx')
const { textoDoArquivo, descobrirSeparador, lerCsvComCabecalho } = require('../../shared/csvLeitura')
const { registrar, ACOES } = require('../../shared/audit')
const { gerarPdf, TEXTO_PADRAO } = require('./certificados.pdf')
const { inscreverPelaBase } = require('./certificados.inscricoes')

/**
 * Certificados: configuracao por curso, base de quem tem direito, emissao do
 * PDF e validacao publica pelo codigo.
 */

const MAX_LINHAS = 60000
const TIPOS_DE_ARTE = ['image/jpeg', 'image/png']
const MAX_ARTE = 6 * 1024 * 1024

function erro(statusCode, message, payload) {
  return Object.assign(new Error(message), { statusCode, payload })
}

const texto = (valor, limite) => String(valor ?? '').trim().replace(/\s+/g, ' ').slice(0, limite)

function urlDeValidacao() {
  const site = String(process.env.SITE_URL || 'https://transformaeducacaopb.com.br').replace(/\/+$/, '')
  return `${site}/validar`
}

/**
 * Dois formatos de codigo convivem:
 *  - o do sistema, com o prefixo do curso: LEG-A7K9-X2M4;
 *  - o numerico dos certificados emitidos antes (Google): 9999-9999-9999.
 * Aceita digitado de qualquer jeito (minusculas, sem hifen, com espacos) e
 * devolve na forma canonica; o que nao for nenhum dos dois, null.
 */
function normalizarCodigo(valor) {
  const limpo = String(valor ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^\d{12}$/.test(limpo)) return `${limpo.slice(0, 4)}-${limpo.slice(4, 8)}-${limpo.slice(8)}`
  const m = /^([A-Z]{2,4})([A-Z0-9]{4})([A-Z0-9]{4})$/.exec(limpo)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// Sem 0/O, 1/I/L: quem digita o codigo do papel nao confunde.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const PALAVRAS_VAZIAS = new Set(['A', 'O', 'AS', 'OS', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NA', 'NO', 'NAS', 'NOS', 'PARA', 'COM', 'POR', 'AO', 'AOS', 'UM', 'UMA', 'FOR', 'THE', 'OF'])

/**
 * Prefixo sugerido a partir do nome do curso: as iniciais das palavras que
 * importam (Analise de Dados e Gestao -> ADG). Com menos de tres palavras,
 * completa com as letras da primeira (Legislacao Educacional -> LEG).
 */
function prefixoSugerido(nome) {
  const palavras = String(nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .split(/[^A-Z]+/).filter((p) => p && !PALAVRAS_VAZIAS.has(p))
  if (!palavras.length) return 'CRT'
  if (palavras.length >= 3) return palavras.slice(0, 3).map((p) => p[0]).join('')
  return palavras[0].slice(0, 3).padEnd(3, 'X')
}

const normalizarPrefixo = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)

function novoCodigo(prefixo) {
  let corpo = ''
  for (let i = 0; i < 8; i += 1) corpo += ALFABETO[crypto.randomInt(0, ALFABETO.length)]
  return `${prefixo}-${corpo.slice(0, 4)}-${corpo.slice(4)}`
}

async function cursoExiste(courseId) {
  const [[curso]] = await getPool().execute('SELECT id, name, workload_hours FROM courses WHERE id = ?', [courseId])
  if (!curso) throw erro(404, 'Curso nao encontrado.')
  return curso
}

// ---------------------------------------------------------------------------
// Configuracao
// ---------------------------------------------------------------------------

/** Cursos com o resumo do certificado de cada um, para a lista da tela. */
async function listarCursos() {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT c.id, c.name, c.workload_hours,
            cfg.liberado, cfg.arte_tamanho IS NOT NULL AS tem_arte,
            COALESCE(t.validos, 0) AS validos, COALESCE(t.baixados, 0) AS baixados
       FROM courses c
       LEFT JOIN certificado_config cfg ON cfg.course_id = c.id
       LEFT JOIN (SELECT course_id, SUM(status = 'valido') AS validos,
                         SUM(status = 'valido' AND downloads > 0) AS baixados
                    FROM certificados GROUP BY course_id) t ON t.course_id = c.id
      ORDER BY c.name`
  )
  return linhas.map((l) => ({
    id: l.id,
    nome: l.name,
    cargaHoraria: l.workload_hours ?? null,
    liberado: Boolean(Number(l.liberado)),
    temArte: Boolean(Number(l.tem_arte)),
    validos: Number(l.validos),
    baixados: Number(l.baixados),
  }))
}

/** A configuracao de um curso, sem a arte (que vem por rota propria). */
async function obterConfig(courseId) {
  requireMysql()
  const curso = await cursoExiste(courseId)
  const [[cfg]] = await getPool().execute(
    `SELECT liberado, nome_curso, periodo, carga_horaria, texto, prefixo_codigo, arte_tipo, arte_nome, arte_tamanho,
            atualizado_por, atualizado_em
       FROM certificado_config WHERE course_id = ?`,
    [courseId]
  )
  const [[totais]] = await getPool().execute(
    `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'valido'), 0) AS validos,
            COALESCE(SUM(status = 'revogado'), 0) AS revogados,
            COALESCE(SUM(status = 'valido' AND downloads > 0), 0) AS baixados
       FROM certificados WHERE course_id = ?`,
    [courseId]
  )
  return {
    courseId,
    cursoNoSistema: curso.name,
    liberado: Boolean(cfg?.liberado),
    nomeCurso: cfg?.nome_curso ?? curso.name,
    periodo: cfg?.periodo ?? '',
    cargaHoraria: cfg?.carga_horaria ?? curso.workload_hours ?? 30,
    texto: cfg?.texto ?? TEXTO_PADRAO,
    textoPadrao: TEXTO_PADRAO,
    prefixoCodigo: cfg?.prefixo_codigo || prefixoSugerido(cfg?.nome_curso || curso.name),
    arte: cfg?.arte_tamanho ? { nome: cfg.arte_nome, tipo: cfg.arte_tipo, tamanho: cfg.arte_tamanho } : null,
    atualizadoPor: cfg?.atualizado_por ?? null,
    atualizadoEm: cfg?.atualizado_em ?? null,
    totais: {
      total: Number(totais.total),
      validos: Number(totais.validos),
      revogados: Number(totais.revogados),
      baixados: Number(totais.baixados),
    },
  }
}

function lerCamposDaConfig(corpo = {}) {
  const carga = Number(corpo.cargaHoraria)
  if (!Number.isInteger(carga) || carga < 1 || carga > 999) throw erro(400, 'Informe a carga horaria em horas (1 a 999).')
  const nomeCurso = texto(corpo.nomeCurso, 255)
  if (!nomeCurso) throw erro(400, 'Informe o nome do curso como deve sair no certificado.')
  const conteudo = String(corpo.texto ?? '').trim().slice(0, 2000)
  if (!conteudo) throw erro(400, 'O texto do certificado nao pode ficar vazio.')
  const prefixoCodigo = normalizarPrefixo(corpo.prefixoCodigo) || prefixoSugerido(nomeCurso)
  if (prefixoCodigo.length < 2) throw erro(400, 'O prefixo do codigo precisa de 2 a 4 letras.')
  return { nomeCurso, periodo: texto(corpo.periodo, 150), cargaHoraria: carga, texto: conteudo, prefixoCodigo }
}

async function salvarConfig({ courseId, corpo, actor, req }) {
  requireMysql()
  await cursoExiste(courseId)
  const campos = lerCamposDaConfig(corpo)
  const liberado = corpo.liberado ? 1 : 0

  if (liberado) {
    const [[cfg]] = await getPool().execute('SELECT arte_tamanho FROM certificado_config WHERE course_id = ?', [courseId])
    if (!cfg?.arte_tamanho) throw erro(400, 'Envie a arte do certificado antes de liberar o download.')
  }

  await getPool().execute(
    `INSERT INTO certificado_config (course_id, liberado, nome_curso, periodo, carga_horaria, texto, prefixo_codigo, atualizado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE liberado = VALUES(liberado), nome_curso = VALUES(nome_curso), periodo = VALUES(periodo),
       carga_horaria = VALUES(carga_horaria), texto = VALUES(texto), prefixo_codigo = VALUES(prefixo_codigo),
       atualizado_por = VALUES(atualizado_por)`,
    [courseId, liberado, campos.nomeCurso, campos.periodo, campos.cargaHoraria, campos.texto, campos.prefixoCodigo, actor?.name || null]
  )
  await registrar({
    actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
    action: ACOES.CERTIFICADO_CONFIG_ALTERADA, req, details: { courseId, liberado: Boolean(liberado) },
  })
  return obterConfig(courseId)
}

/** Os bytes dizem o tipo -- o cabecalho Content-Type do navegador nao e confiavel. */
function tipoDaImagem(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  return null
}

async function salvarArte({ courseId, arquivo, nome, actor, req }) {
  requireMysql()
  const curso = await cursoExiste(courseId)
  if (!Buffer.isBuffer(arquivo) || !arquivo.length) throw erro(400, 'Envie a imagem da arte.')
  if (arquivo.length > MAX_ARTE) throw erro(400, 'A imagem passa de 6 MB. Exporte em JPEG para ficar menor.')
  const tipo = tipoDaImagem(arquivo)
  if (!TIPOS_DE_ARTE.includes(tipo)) throw erro(400, 'A arte precisa ser JPEG ou PNG.')

  await getPool().execute(
    `INSERT INTO certificado_config (course_id, nome_curso, carga_horaria, texto, arte, arte_tipo, arte_nome, arte_tamanho, atualizado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE arte = VALUES(arte), arte_tipo = VALUES(arte_tipo), arte_nome = VALUES(arte_nome),
       arte_tamanho = VALUES(arte_tamanho), atualizado_por = VALUES(atualizado_por)`,
    [courseId, curso.name, curso.workload_hours ?? 30, TEXTO_PADRAO, arquivo, tipo,
      texto(nome, 255) || 'arte', arquivo.length, actor?.name || null]
  )
  cacheDeArte.delete(courseId)
  await registrar({
    actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
    action: ACOES.CERTIFICADO_CONFIG_ALTERADA, req, details: { courseId, arte: true, tamanho: arquivo.length },
  })
  return obterConfig(courseId)
}

/**
 * A arte guardada, para a miniatura da tela e para gerar o PDF. Fica na memoria
 * do processo depois da primeira leitura: sao 1-2 MB por curso, e reler do
 * banco a cada download, num dia de liberacao com milhares, seria o gargalo.
 */
const cacheDeArte = new Map()
async function arteDoCurso(courseId) {
  const [[versao]] = await getPool().execute(
    'SELECT UNIX_TIMESTAMP(atualizado_em) AS v, arte_tamanho FROM certificado_config WHERE course_id = ?', [courseId]
  )
  if (!versao?.arte_tamanho) return null
  const emCache = cacheDeArte.get(courseId)
  if (emCache && emCache.versao === Number(versao.v)) return emCache
  const [[linha]] = await getPool().execute('SELECT arte, arte_tipo FROM certificado_config WHERE course_id = ?', [courseId])
  const arte = { versao: Number(versao.v), bytes: linha.arte, tipo: linha.arte_tipo }
  cacheDeArte.set(courseId, arte)
  return arte
}

// ---------------------------------------------------------------------------
// Geracao do PDF
// ---------------------------------------------------------------------------

/**
 * No maximo duas geracoes ao mesmo tempo por processo. Cada uma e rapida
 * (~0,1 s, poucos MB), mas no dia da liberacao milhares clicam juntos, e a
 * VPS tem menos de 1 GB: os demais esperam a vez em vez de disputar memoria.
 */
const MAX_SIMULTANEAS = 2
let emAndamento = 0
const fila = []
async function naVez(tarefa) {
  if (emAndamento >= MAX_SIMULTANEAS) await new Promise((resolve) => fila.push(resolve))
  emAndamento += 1
  try {
    return await tarefa()
  } finally {
    emAndamento -= 1
    const proximo = fila.shift()
    if (proximo) proximo()
  }
}

async function montarPdf({ courseId, nome, cpf, codigo, config }) {
  const arte = await arteDoCurso(courseId)
  if (!arte) throw erro(409, 'Este curso ainda nao tem a arte do certificado.')
  return naVez(() => gerarPdf({
    arte: arte.bytes,
    tipoArte: arte.tipo,
    nome,
    cpf,
    codigo,
    curso: config.nomeCurso,
    periodo: config.periodo,
    cargaHoraria: config.cargaHoraria,
    texto: config.texto,
    urlValidacao: urlDeValidacao(),
  }))
}

/** Previa com dados de exemplo, usando os campos do formulario (mesmo sem salvar). */
async function previa({ courseId, corpo }) {
  requireMysql()
  await cursoExiste(courseId)
  const config = lerCamposDaConfig(corpo)
  return montarPdf({
    courseId,
    nome: 'Maria José da Silva Exemplo',
    cpf: '12345678909',
    codigo: `${config.prefixoCodigo}-0000-0000`,
    config,
  })
}

async function configParaEmissao(courseId) {
  const [[cfg]] = await getPool().execute(
    `SELECT cfg.nome_curso, cfg.periodo, cfg.carga_horaria, cfg.texto, cfg.liberado, c.name, c.workload_hours
       FROM courses c LEFT JOIN certificado_config cfg ON cfg.course_id = c.id
      WHERE c.id = ?`,
    [courseId]
  )
  if (!cfg) throw erro(404, 'Curso nao encontrado.')
  return {
    liberado: Boolean(Number(cfg.liberado)),
    nomeCurso: cfg.nome_curso || cfg.name,
    periodo: cfg.periodo || '',
    cargaHoraria: cfg.carga_horaria || cfg.workload_hours || 30,
    texto: cfg.texto || TEXTO_PADRAO,
  }
}

async function pdfDoCertificado(certificado) {
  const config = await configParaEmissao(certificado.course_id)
  const pdf = await montarPdf({
    courseId: certificado.course_id,
    nome: certificado.nome,
    cpf: certificado.cpf,
    codigo: certificado.codigo,
    config,
  })
  return { pdf, config }
}

const nomeDoArquivo = (codigo) => `certificado-${codigo}.pdf`

// ---------------------------------------------------------------------------
// Base de quem tem direito
// ---------------------------------------------------------------------------

/** "Nome completo" -> "NOME_COMPLETO", sem acento: o cabecalho vem de qualquer jeito. */
const chaveDaColuna = (c) => String(c ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

const COLUNAS = {
  cpf: ['CPF'],
  nome: ['NOME_COMPLETO', 'NOME', 'NOME_DO_CURSISTA', 'CURSISTA', 'DOCENTE'],
  codigo: ['CODIGO_VALIDACAO', 'CODIGO_DE_VALIDACAO', 'CODIGO'],
}

function lerRegistrosDaBase(arquivo) {
  if (!Buffer.isBuffer(arquivo) || !arquivo.length) throw erro(400, 'Envie a planilha da base (.xlsx ou .csv).')

  let tabelas
  if (arquivo[0] === 0x50 && arquivo[1] === 0x4b) {
    tabelas = [...lerPlanilha(arquivo).values()].map((a) => ({ cabecalho: a.cabecalho, registros: a.registros }))
  } else {
    const conteudo = textoDoArquivo(arquivo)
    const { colunas, registros } = lerCsvComCabecalho(conteudo, descobrirSeparador(conteudo))
    tabelas = [{ cabecalho: colunas, registros }]
  }

  // A primeira aba que tenha CPF e nome.
  for (const tabela of tabelas) {
    const mapa = {}
    for (const original of tabela.cabecalho) {
      const chave = chaveDaColuna(original)
      for (const [campo, aceitas] of Object.entries(COLUNAS)) {
        if (!mapa[campo] && aceitas.includes(chave)) mapa[campo] = original
      }
    }
    if (mapa.cpf) {
      if (tabela.registros.length > MAX_LINHAS) throw erro(400, `A planilha tem ${tabela.registros.length} linhas; o limite e ${MAX_LINHAS}.`)
      return {
        temCodigo: Boolean(mapa.codigo),
        registros: tabela.registros.map((r, i) => ({
          linha: i + 2,
          cpfBruto: r[mapa.cpf],
          nome: mapa.nome ? r[mapa.nome] : '',
          codigo: mapa.codigo ? r[mapa.codigo] : '',
        })),
      }
    }
  }
  throw erro(400, 'A planilha precisa da coluna CPF (NOME_COMPLETO e opcional: sem ela, vale o nome do cadastro).')
}

const MODOS = ['adicionar', 'completa']

/**
 * O coracao da base: aplica uma lista de registros (da planilha ou do
 * formulario manual) ao curso.
 *
 *  - 'adicionar': so entra quem e novo. Quem ja esta na base nao e tocado --
 *    nem o nome --, para nao mexer no que ja esta certo. Quem estava revogado
 *    e veio de novo volta a valer.
 *  - 'completa': a planilha e a lista inteira. Atualiza nomes, reativa, e
 *    revoga quem ficou de fora.
 */
async function processar({ courseId, curso, registros, temCodigo, modo, gravar, actor, req, acao, origem }) {
  const pool = getPool()
  const [[cfgCodigo]] = await pool.execute('SELECT prefixo_codigo, nome_curso FROM certificado_config WHERE course_id = ?', [courseId])
  const prefixo = cfgCodigo?.prefixo_codigo || prefixoSugerido(cfgCodigo?.nome_curso || curso.name)
  const [cadastros] = await pool.query('SELECT cpf, name FROM cursistas')
  const nomeNoCadastro = new Map(cadastros.map((c) => [c.cpf, c.name]))
  const [existentes] = await pool.execute('SELECT id, cpf, nome, codigo, status FROM certificados WHERE course_id = ?', [courseId])
  const porCpf = new Map(existentes.map((e) => [e.cpf, e]))
  const [todosOsCodigos] = await pool.query('SELECT codigo, course_id, cpf FROM certificados')
  const donoDoCodigo = new Map(todosOsCodigos.map((c) => [c.codigo, `${c.course_id}:${c.cpf}`]))
  const completa = modo === 'completa'

  const problemas = []
  const vistos = new Set()
  const gravacoes = []
  const resumo = { linhas: registros.length, novos: 0, atualizados: 0, reativados: 0, inalterados: 0, revogados: 0, ignorados: 0, codigoMantido: 0, nomeDoCadastro: 0 }

  for (const r of registros) {
    const cpf = normalizeCpf(r.cpfBruto)
    const nomeDaPlanilha = texto(r.nome, 200)
    let nome = nomeDaPlanilha
    if (!nome && nomeNoCadastro.has(cpf)) { nome = texto(nomeNoCadastro.get(cpf), 200); resumo.nomeDoCadastro += 1 }
    const recusar = (motivo) => {
      resumo.ignorados += 1
      // CPF como veio na planilha, inteiro: e o que a pessoa precisa para
      // achar a linha e corrigir. A tela e so do administrador.
      problemas.push({ linha: r.linha, cpf: String(r.cpfBruto ?? '').trim().slice(0, 30), nome: nomeDaPlanilha, motivo })
    }

    if (!String(r.cpfBruto ?? '').trim()) { recusar('CPF vazio'); continue }
    if (!isValidCpf(cpf)) { recusar('CPF invalido (digitos verificadores nao conferem)'); continue }
    // Quem ja esta na base e veio sem nome continua com o nome que tem.
    if (!nome && porCpf.has(cpf)) nome = porCpf.get(cpf).nome
    if (!nome) { recusar('CPF sem cadastro no sistema e sem nome na planilha'); continue }
    if (vistos.has(cpf)) { recusar('CPF repetido na planilha (vale a primeira linha)'); continue }
    vistos.add(cpf)

    const atual = porCpf.get(cpf)
    let codigo = atual?.codigo || null
    const codigoInformado = temCodigo && String(r.codigo ?? '').trim() ? normalizarCodigo(r.codigo) : null

    if (!atual) {
      if (temCodigo && String(r.codigo ?? '').trim() && !codigoInformado) { recusar('Codigo de validacao em formato desconhecido'); continue }
      if (codigoInformado) {
        const dono = donoDoCodigo.get(codigoInformado)
        if (dono && dono !== `${courseId}:${cpf}`) { recusar('Codigo de validacao ja usado por outro certificado'); continue }
        codigo = codigoInformado
      } else {
        do { codigo = novoCodigo(prefixo) } while (donoDoCodigo.has(codigo))
      }
      donoDoCodigo.set(codigo, `${courseId}:${cpf}`)
      resumo.novos += 1
      gravacoes.push({ cpf, nome, codigo })
      continue
    }

    if (codigoInformado && codigoInformado !== atual.codigo) resumo.codigoMantido += 1
    if (atual.status === 'revogado') {
      resumo.reativados += 1
      gravacoes.push({ cpf, nome: completa ? nome : atual.nome, codigo })
    } else if (completa && atual.nome !== nome) {
      resumo.atualizados += 1
      gravacoes.push({ cpf, nome, codigo })
    } else {
      resumo.inalterados += 1
    }
  }

  const aRevogar = completa ? existentes.filter((e) => e.status === 'valido' && !vistos.has(e.cpf)).map((e) => e.id) : []
  resumo.revogados = aRevogar.length

  if (gravar) {
    const conexao = await pool.getConnection()
    try {
      await conexao.beginTransaction()
      for (let i = 0; i < gravacoes.length; i += 500) {
        const lote = gravacoes.slice(i, i + 500)
        await conexao.query(
          `INSERT INTO certificados (course_id, cpf, nome, codigo) VALUES ?
           ON DUPLICATE KEY UPDATE nome = VALUES(nome), status = 'valido'`,
          [lote.map((g) => [courseId, g.cpf, g.nome, g.codigo])]
        )
      }
      for (let i = 0; i < aRevogar.length; i += 1000) {
        await conexao.query("UPDATE certificados SET status = 'revogado' WHERE id IN (?)", [aRevogar.slice(i, i + 1000)])
      }
      // Na mesma transacao: quem ganhou certificado aparece inscrito no curso.
      resumo.inscritos = await inscreverPelaBase({ courseId, conexao })
      await conexao.commit()
    } catch (e) {
      await conexao.rollback()
      throw e
    } finally {
      conexao.release()
    }
    await registrar({
      actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
      action: acao, req, details: { courseId, modo, origem, ...resumo },
    })
  }

  return { gravado: Boolean(gravar), modo, resumo, problemas, totalProblemas: problemas.length }
}

/** Planilha enviada pela tela (conferir ou gravar). */
async function importarBase({ courseId, arquivo, modo = 'adicionar', gravar = false, actor, req }) {
  requireMysql()
  if (!MODOS.includes(modo)) throw erro(400, 'Modo de envio invalido.')
  const curso = await cursoExiste(courseId)
  const { registros, temCodigo } = lerRegistrosDaBase(arquivo)
  const resultado = await processar({
    courseId, curso, registros, temCodigo, modo, gravar, actor, req,
    acao: ACOES.CERTIFICADO_BASE_ENVIADA, origem: 'planilha',
  })
  // A tela mostra ate 200 linhas; a lista inteira sai pela planilha de ignorados.
  return { ...resultado, problemas: resultado.problemas.slice(0, 200) }
}

/** As linhas ignoradas de uma planilha, como .xlsx, para corrigir e reenviar. */
async function planilhaDeIgnorados({ courseId, arquivo, modo = 'adicionar' }) {
  requireMysql()
  const curso = await cursoExiste(courseId)
  const { registros, temCodigo } = lerRegistrosDaBase(arquivo)
  const { problemas } = await processar({ courseId, curso, registros, temCodigo, modo: MODOS.includes(modo) ? modo : 'adicionar', gravar: false })
  return criarPlanilha({
    nomeAba: 'Ignorados',
    colunas: [
      { titulo: 'LINHA', valor: (p) => p.linha, numerica: true },
      { titulo: 'CPF', valor: (p) => p.cpf },
      { titulo: 'NOME_COMPLETO', valor: (p) => p.nome },
      { titulo: 'MOTIVO', valor: (p) => p.motivo },
    ],
    linhas: problemas,
  })
}

/** Uma pessoa so, pelo formulario: entra sem mexer em mais ninguem. */
async function adicionarManual({ courseId, cpf, nome, actor, req }) {
  requireMysql()
  const curso = await cursoExiste(courseId)
  const resultado = await processar({
    courseId, curso,
    registros: [{ linha: 1, cpfBruto: cpf, nome, codigo: '' }],
    temCodigo: false, modo: 'adicionar', gravar: true, actor, req,
    acao: ACOES.CERTIFICADO_ADICIONADO_MANUAL, origem: 'manual',
  })
  if (resultado.problemas.length) throw erro(400, resultado.problemas[0].motivo.replace(' na planilha', ''))
  if (resultado.resumo.inalterados) throw erro(409, 'Este CPF ja tem certificado valido neste curso.')
  const [[linha]] = await getPool().execute('SELECT nome, codigo FROM certificados WHERE course_id = ? AND cpf = ?', [courseId, normalizeCpf(cpf)])
  return { reativado: resultado.resumo.reativados > 0, nome: linha?.nome, codigo: linha?.codigo }
}

// ---------------------------------------------------------------------------
// Lista de emitidos (administracao)
// ---------------------------------------------------------------------------

async function listarEmitidos({ courseId, busca = '', status = '', pagina = 1, porPagina = 25 }) {
  requireMysql()
  const onde = ['course_id = ?']
  const params = [courseId]
  const termo = texto(busca, 100)
  if (termo) {
    const digitos = termo.replace(/\D/g, '')
    if (digitos.length === 11 && /^[\d.\-\s]+$/.test(termo)) { onde.push('cpf = ?'); params.push(normalizeCpf(digitos)) } else if (normalizarCodigo(termo)) { onde.push('codigo = ?'); params.push(normalizarCodigo(termo)) } else { onde.push('nome LIKE ?'); params.push(`%${termo}%`) }
  }
  if (status === 'valido' || status === 'revogado') { onde.push('status = ?'); params.push(status) }
  const tamanho = Math.min(100, Math.max(1, Number(porPagina) || 25))
  const atual = Math.max(1, Number(pagina) || 1)
  const where = onde.join(' AND ')
  const [[{ total }]] = await getPool().query(`SELECT COUNT(*) AS total FROM certificados WHERE ${where}`, params)
  const [linhas] = await getPool().query(
    `SELECT id, cpf, nome, codigo, status, downloads, primeiro_download_em, emitido_em
       FROM certificados WHERE ${where} ORDER BY nome LIMIT ? OFFSET ?`,
    [...params, tamanho, (atual - 1) * tamanho]
  )
  return {
    total: Number(total),
    pagina: atual,
    porPagina: tamanho,
    itens: linhas.map((l) => ({
      id: l.id,
      cpf: maskCpf(l.cpf),
      nome: l.nome,
      codigo: l.codigo,
      status: l.status,
      downloads: l.downloads,
      primeiroDownloadEm: l.primeiro_download_em,
      emitidoEm: l.emitido_em,
    })),
  }
}

async function buscarPorId(id) {
  const [[linha]] = await getPool().execute('SELECT * FROM certificados WHERE id = ?', [id])
  if (!linha) throw erro(404, 'Certificado nao encontrado.')
  return linha
}

async function pdfParaAdmin(id) {
  requireMysql()
  const certificado = await buscarPorId(id)
  const { pdf } = await pdfDoCertificado(certificado)
  return { pdf, nomeArquivo: nomeDoArquivo(certificado.codigo) }
}

async function alterarStatus({ id, status, actor, req }) {
  requireMysql()
  if (!['valido', 'revogado'].includes(status)) throw erro(400, 'Situacao invalida.')
  const certificado = await buscarPorId(id)
  await getPool().execute('UPDATE certificados SET status = ? WHERE id = ?', [status, id])
  if (status === 'valido') await inscreverPelaBase({ courseId: certificado.course_id })
  await registrar({
    actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
    action: status === 'revogado' ? ACOES.CERTIFICADO_REVOGADO : ACOES.CERTIFICADO_REATIVADO,
    req, details: { certificadoId: id, courseId: certificado.course_id, codigo: certificado.codigo },
  })
  return { id, status }
}

/** A lista de emitidos (com o filtro da tela) em .xlsx, CPF inteiro. */
async function exportarEmitidos({ courseId, status = '' }) {
  requireMysql()
  const curso = await cursoExiste(courseId)
  const filtro = status === 'valido' || status === 'revogado' ? ' AND status = ?' : ''
  const [linhas] = await getPool().query(
    `SELECT cpf, nome, codigo, status, downloads, primeiro_download_em, emitido_em
       FROM certificados WHERE course_id = ?${filtro} ORDER BY nome`,
    filtro ? [courseId, status] : [courseId]
  )
  const data = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '')
  return {
    nomeArquivo: `certificados-${String(curso.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/-+/g, '-').slice(0, 50)}${status ? `-${status}s` : ''}.xlsx`,
    arquivo: criarPlanilha({
      nomeAba: 'Certificados',
      colunas: [
        { titulo: 'CPF', valor: (l) => formatCpf(l.cpf) },
        { titulo: 'NOME_COMPLETO', valor: (l) => l.nome },
        { titulo: 'CODIGO_VALIDACAO', valor: (l) => l.codigo },
        { titulo: 'SITUACAO', valor: (l) => (l.status === 'valido' ? 'Valido' : 'Revogado') },
        { titulo: 'DOWNLOADS', valor: (l) => Number(l.downloads), numerica: true },
        { titulo: 'PRIMEIRO_DOWNLOAD', valor: (l) => data(l.primeiro_download_em) },
        { titulo: 'EMITIDO_EM', valor: (l) => data(l.emitido_em) },
      ],
      linhas,
    }),
  }
}

/**
 * Apaga o certificado de vez. Diferente de revogar: o codigo deixa de existir
 * e a validacao passa a responder "nao encontrado". Para lancamento errado;
 * certificado que ja circulou deve ser revogado, nao excluido.
 */
async function excluir({ id, actor, req }) {
  requireMysql()
  const certificado = await buscarPorId(id)
  await getPool().execute('DELETE FROM certificados WHERE id = ?', [id])
  await registrar({
    actorType: 'admin', actorId: actor?.id || null, actorLabel: actor?.name || null,
    action: ACOES.CERTIFICADO_EXCLUIDO, req,
    details: { certificadoId: id, courseId: certificado.course_id, codigo: certificado.codigo, cpf: maskCpf(certificado.cpf), downloads: certificado.downloads },
  })
  return { id, excluido: true }
}

// ---------------------------------------------------------------------------
// Area do cursista
// ---------------------------------------------------------------------------

/** O que o cursista pode baixar: certificado valido, de curso liberado e com arte. */
const CONDICAO_DO_CURSISTA = `ce.cpf = ? AND ce.status = 'valido' AND cfg.liberado = 1 AND cfg.arte_tamanho IS NOT NULL`

async function meusCertificados(cpf) {
  requireMysql()
  const [linhas] = await getPool().execute(
    `SELECT ce.id, ce.codigo, ce.emitido_em, ce.course_id,
            COALESCE(cfg.nome_curso, c.name) AS curso, c.name AS curso_no_sistema,
            COALESCE(cfg.carga_horaria, c.workload_hours) AS carga_horaria, cfg.periodo,
            c.secondary_trail, (c.image LIKE 'data:image/%') AS tem_imagem, UNIX_TIMESTAMP(c.updated_at) AS versao_capa
       FROM certificados ce
       JOIN certificado_config cfg ON cfg.course_id = ce.course_id
       JOIN courses c ON c.id = ce.course_id
      WHERE ${CONDICAO_DO_CURSISTA}
      ORDER BY c.name`,
    [cpf]
  )
  return linhas.map((l) => ({
    id: l.id,
    courseId: l.course_id,
    curso: l.curso,
    cursoNoSistema: l.curso_no_sistema,
    cargaHoraria: l.carga_horaria,
    periodo: l.periodo,
    codigo: l.codigo,
    emitidoEm: l.emitido_em,
    trail: l.secondary_trail,
    hasImage: Boolean(Number(l.tem_imagem)),
    imageVersion: Number(l.versao_capa || 0),
  }))
}

async function pdfDoCursista({ id, cpf }) {
  requireMysql()
  const [[certificado]] = await getPool().execute(
    `SELECT ce.* FROM certificados ce JOIN certificado_config cfg ON cfg.course_id = ce.course_id
      WHERE ce.id = ? AND ${CONDICAO_DO_CURSISTA}`,
    [id, cpf]
  )
  // 404 tambem para o certificado de outra pessoa: nao confirma que o id existe.
  if (!certificado) throw erro(404, 'Certificado nao encontrado.')
  const { pdf } = await pdfDoCertificado(certificado)
  await getPool().execute(
    'UPDATE certificados SET downloads = downloads + 1, primeiro_download_em = COALESCE(primeiro_download_em, NOW()) WHERE id = ?',
    [id]
  )
  return { pdf, nomeArquivo: nomeDoArquivo(certificado.codigo) }
}

// ---------------------------------------------------------------------------
// Validacao publica
// ---------------------------------------------------------------------------

/**
 * O que o certificado diz, conferido pelo codigo. CPF mascarado: quem tem o
 * codigo tem o certificado na mao e ja ve o CPF la; a pagina so confirma.
 * Curso ainda nao liberado responde como inexistente.
 */
async function validar(codigoBruto) {
  requireMysql()
  const codigo = normalizarCodigo(codigoBruto)
  if (!codigo) return { encontrado: false }
  const [[linha]] = await getPool().execute(
    `SELECT ce.nome, ce.cpf, ce.status, ce.emitido_em, ce.codigo,
            COALESCE(cfg.nome_curso, c.name) AS curso, COALESCE(cfg.carga_horaria, c.workload_hours) AS carga_horaria,
            cfg.periodo
       FROM certificados ce
       JOIN certificado_config cfg ON cfg.course_id = ce.course_id AND cfg.liberado = 1
       JOIN courses c ON c.id = ce.course_id
      WHERE ce.codigo = ?`,
    [codigo]
  )
  if (!linha) return { encontrado: false, codigo }
  return {
    encontrado: true,
    codigo: linha.codigo,
    valido: linha.status === 'valido',
    status: linha.status,
    nome: linha.nome,
    cpf: maskCpf(linha.cpf),
    curso: linha.curso,
    cargaHoraria: linha.carga_horaria,
    periodo: linha.periodo,
    emitidoEm: linha.emitido_em,
  }
}

module.exports = {
  listarCursos,
  obterConfig,
  salvarConfig,
  salvarArte,
  arteDoCurso,
  previa,
  importarBase,
  planilhaDeIgnorados,
  adicionarManual,
  listarEmitidos,
  exportarEmitidos,
  excluir,
  pdfParaAdmin,
  alterarStatus,
  meusCertificados,
  pdfDoCursista,
  validar,
  normalizarCodigo,
}
