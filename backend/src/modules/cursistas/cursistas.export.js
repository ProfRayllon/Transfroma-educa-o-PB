'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { registrar, ACOES } = require('../../shared/audit')

/**
 * Mapa de colunas da planilha enviada ao AVA.
 *
 * ISOLADO DE PROPOSITO: quando o layout exigido pelo AVA RIEH/PB chegar, basta
 * reescrever este array -- nenhuma outra parte do modulo precisa mudar.
 * `valor` recebe a linha ja carregada do banco.
 */
const COLUNAS_AVA = [
  { titulo: 'cpf', valor: (r) => r.cpf },
  { titulo: 'nome_completo', valor: (r) => r.name },
  { titulo: 'email', valor: (r) => r.email || '' },
  { titulo: 'telefone', valor: (r) => r.phone || '' },
  { titulo: 'matricula', valor: (r) => r.registration || '' },
  { titulo: 'cargo', valor: (r) => r.position || '' },
  { titulo: 'escola', valor: (r) => r.school || '' },
  { titulo: 'municipio', valor: (r) => r.municipality || '' },
  { titulo: 'regional', valor: (r) => r.regional || '' },
  { titulo: 'curso', valor: (r) => r.course_name },
  { titulo: 'data_inscricao', valor: (r) => (r.enrolled_at ? new Date(r.enrolled_at).toISOString().slice(0, 10) : '') },
]

function escaparCsv(valor) {
  const texto = String(valor ?? '')
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Gera a planilha de inscritos para carga no AVA.
 *
 * Esta e a superficie de maior risco do modulo -- um arquivo com o CPF de todos
 * os inscritos. Por isso: restrita a administrador, sempre registrada na trilha
 * de auditoria e nunca acessivel por link publico.
 */
async function exportarInscritos({ courseId = null, edition, actor, req }) {
  requireMysql()

  const params = [edition]
  let filtroCurso = ''
  if (courseId) {
    filtroCurso = 'AND i.course_id = ?'
    params.push(courseId)
  }

  const [rows] = await getPool().execute(
    `SELECT c.cpf, c.name, c.email, c.phone, c.registration, c.position,
            c.school, c.municipality, c.regional,
            cur.name AS course_name, i.enrolled_at
     FROM inscricoes i
     JOIN cursistas c ON c.id = i.cursista_id
     JOIN courses cur ON cur.id = i.course_id
     WHERE i.status = 'inscrito' AND i.edition = ? ${filtroCurso}
     ORDER BY cur.name, c.name`,
    params
  )

  const linhas = [
    COLUNAS_AVA.map((coluna) => coluna.titulo).join(';'),
    ...rows.map((row) => COLUNAS_AVA.map((coluna) => escaparCsv(coluna.valor(row))).join(';')),
  ]

  // BOM para o Excel abrir os acentos corretamente.
  const csv = `﻿${linhas.join('\r\n')}\r\n`

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.BASE_EXPORTADA,
    req,
    details: { courseId: courseId ? Number(courseId) : 'todos', edition, registros: rows.length },
  })

  return { csv, total: rows.length }
}

/** Marca as inscricoes como enviadas ao AVA, para acompanhar o que ja foi carregado. */
async function marcarComoExportadas({ courseId, edition }) {
  requireMysql()
  const params = [edition]
  let filtroCurso = ''
  if (courseId) {
    filtroCurso = 'AND course_id = ?'
    params.push(courseId)
  }
  await getPool().execute(
    `UPDATE inscricoes SET exported_at = NOW()
     WHERE status = 'inscrito' AND edition = ? ${filtroCurso}`,
    params
  )
}

module.exports = { exportarInscritos, marcarComoExportadas, COLUNAS_AVA }
