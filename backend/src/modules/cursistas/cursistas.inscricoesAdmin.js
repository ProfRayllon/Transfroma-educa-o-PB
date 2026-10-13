'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { registrar, ACOES } = require('../../shared/audit')
const { EDICAO_ATUAL } = require('./cursistas.service')

/**
 * Inscricao feita pelo administrador, em nome do cursista.
 *
 * A diferenca para a inscricao do proprio cursista e uma so: aqui a janela de
 * inscricao NAO e conferida. Serve para o caso real de quem ficou de fora --
 * perdeu o prazo, teve problema de acesso, foi remanejado -- e precisa aparecer
 * inscrito num curso que ja fechou ou ainda nem abriu. O curso so precisa existir.
 *
 * A inscricao entra na edicao atual, a mesma que a area do cursista lista: e o
 * que faz o curso aparecer para ele no proximo acesso.
 */

function erro(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

const SITUACAO = `
  CASE
    WHEN c.enrollment_opens_at IS NULL OR c.enrollment_closes_at IS NULL THEN 'sem_janela'
    WHEN NOW() < c.enrollment_opens_at THEN 'em_breve'
    WHEN NOW() > c.enrollment_closes_at THEN 'encerrado'
    ELSE 'aberto'
  END`

async function garantirCursista(cursistaId) {
  const [[linha]] = await getPool().execute('SELECT id FROM cursistas WHERE id = ?', [cursistaId])
  if (!linha) throw erro(404, 'Cursista nao encontrado.')
}

/** As inscricoes do cursista, todas as edicoes, com a situacao do curso hoje. */
async function listar(cursistaId) {
  requireMysql()
  await garantirCursista(cursistaId)
  const [linhas] = await getPool().execute(
    `SELECT i.course_id, i.edition, i.status, i.enrolled_at, c.name AS curso, c.inscricao_obrigatoria, ${SITUACAO} AS situacao
       FROM inscricoes i
       JOIN courses c ON c.id = i.course_id
      WHERE i.cursista_id = ?
      ORDER BY i.edition DESC, (i.status = 'cancelado'), c.name`,
    [cursistaId]
  )
  return {
    edicaoAtual: EDICAO_ATUAL,
    inscricoes: linhas.map((l) => ({
      courseId: l.course_id,
      curso: l.curso,
      edicao: l.edition,
      status: l.status,
      inscritoEm: l.enrolled_at,
      situacao: l.situacao,
      obrigatoria: Boolean(Number(l.inscricao_obrigatoria)),
    })),
  }
}

/** Todos os cursos, para escolher -- abertos ou nao. */
async function cursosDisponiveis() {
  requireMysql()
  const [linhas] = await getPool().execute(
    `SELECT c.id, c.name, ${SITUACAO} AS situacao FROM courses c ORDER BY c.name`
  )
  return linhas.map((l) => ({ id: l.id, nome: l.name, situacao: l.situacao }))
}

async function inscrever({ cursistaId, courseId, actor, req }) {
  requireMysql()
  if (!Number.isInteger(courseId) || courseId <= 0) throw erro(400, 'Escolha o curso.')
  await garantirCursista(cursistaId)

  const [[curso]] = await getPool().execute('SELECT id, name FROM courses WHERE id = ?', [courseId])
  if (!curso) throw erro(404, 'Curso nao encontrado.')

  const [[existente]] = await getPool().execute(
    'SELECT status FROM inscricoes WHERE cursista_id = ? AND course_id = ? AND edition = ?',
    [cursistaId, courseId, EDICAO_ATUAL]
  )
  if (existente && existente.status !== 'cancelado') {
    throw erro(409, existente.status === 'concluido'
      ? 'O cursista ja concluiu este curso.'
      : 'O cursista ja esta inscrito neste curso.')
  }

  // Reaproveita a linha cancelada, se houver: a chave unica e cursista + curso
  // + edicao, e "reinscrever" e voltar o status, nao criar outra linha.
  await getPool().execute(
    `INSERT INTO inscricoes (cursista_id, course_id, edition, status)
     VALUES (?, ?, ?, 'inscrito')
     ON DUPLICATE KEY UPDATE status = 'inscrito', cancelled_at = NULL, enrolled_at = NOW()`,
    [cursistaId, courseId, EDICAO_ATUAL]
  )

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.INSCRICAO_CRIADA_ADMIN,
    cursistaId,
    req,
    details: { courseId, edition: EDICAO_ATUAL },
  })

  return { courseId, curso: curso.name }
}

/** Desfaz a inscricao da edicao atual, tambem sem olhar a janela. */
async function cancelar({ cursistaId, courseId, actor, req }) {
  requireMysql()
  const [resultado] = await getPool().execute(
    `UPDATE inscricoes SET status = 'cancelado', cancelled_at = NOW()
      WHERE cursista_id = ? AND course_id = ? AND edition = ? AND status = 'inscrito'`,
    [cursistaId, courseId, EDICAO_ATUAL]
  )
  if (!resultado.affectedRows) throw erro(404, 'Inscricao nao encontrada.')

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.INSCRICAO_CANCELADA_ADMIN,
    cursistaId,
    req,
    details: { courseId, edition: EDICAO_ATUAL },
  })
}

module.exports = { listar, cursosDisponiveis, inscrever, cancelar }
