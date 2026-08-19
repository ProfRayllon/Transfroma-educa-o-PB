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
 * Cursos abertos para inscricao agora.
 * As duas datas nulas significam curso fechado: o padrao e nao aceitar inscricao,
 * para nenhum curso abrir por descuido de cadastro.
 */
async function listarCursosAbertos(cursistaId) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT c.id, c.name, c.primary_trail, c.secondary_trail, c.total_sessions,
            c.image, c.enrollment_opens_at, c.enrollment_closes_at,
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
    image: row.image,
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
            c.name AS course_name, c.primary_trail, c.secondary_trail, c.total_sessions
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
 * Atualizacao dos dados pelo proprio cursista.
 * So contato: nome, CPF, matricula e lotacao vem da base oficial e alimentam o
 * certificado, entao nao podem ser alterados por aqui.
 */
async function atualizarMeusDados({ cursistaId, email, phone, req }) {
  const emailLimpo = String(email || '').trim().toLowerCase()
  if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
    throw erro(400, 'Informe um e-mail valido.')
  }

  const telefoneLimpo = String(phone || '').replace(/\D/g, '')
  if (telefoneLimpo && (telefoneLimpo.length < 10 || telefoneLimpo.length > 11)) {
    throw erro(400, 'Informe um telefone com DDD.')
  }

  await repo.updateContact(cursistaId, { email: emailLimpo, phone: telefoneLimpo })
  await registrar({
    actorType: 'cursista',
    actorId: cursistaId,
    action: ACOES.DADOS_ALTERADOS,
    cursistaId,
    req,
    // Registra QUAIS campos mudaram, nunca os valores (sao dado pessoal).
    details: { campos: ['email', 'telefone'] },
  })

  return repo.findById(cursistaId, { fullCpf: true })
}

module.exports = {
  EDICAO_ATUAL,
  listarCursosAbertos,
  listarMinhasInscricoes,
  inscrever,
  cancelarInscricao,
  atualizarMeusDados,
}
