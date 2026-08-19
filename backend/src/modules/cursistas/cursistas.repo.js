'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, maskCpf } = require('../../shared/cpf')

/**
 * Campos seguros para devolver ao proprio cursista. O hash da senha e os
 * contadores de bloqueio nunca saem daqui.
 */
function mapCursista(row, { fullCpf = false } = {}) {
  if (!row) return null
  return {
    id: row.id,
    cpf: fullCpf ? row.cpf : maskCpf(row.cpf),
    name: row.name,
    birthDate: row.birth_date ? new Date(row.birth_date).toISOString().slice(0, 10) : null,
    email: row.email || '',
    phone: row.phone || '',
    registration: row.registration || '',
    position: row.position || '',
    school: row.school || '',
    municipality: row.municipality || '',
    regional: row.regional || '',
    status: row.status,
    passwordDefined: Boolean(row.password_hash),
    firstAccessAt: row.first_access_at || null,
    lastAccessAt: row.last_access_at || null,
  }
}

/** Uso interno da autenticacao -- carrega os campos sensiveis. */
async function findByCpfForAuth(cpf) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT id, cpf, name, status, password_hash, failed_attempts, locked_until, first_access_at
     FROM cursistas WHERE cpf = ? LIMIT 1`,
    [normalizeCpf(cpf)]
  )
  return rows[0] || null
}

async function findByIdForAuth(id) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT id, cpf, name, status, password_hash, failed_attempts, locked_until, first_access_at
     FROM cursistas WHERE id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

async function findById(id, options) {
  requireMysql()
  const [rows] = await getPool().execute('SELECT * FROM cursistas WHERE id = ? LIMIT 1', [id])
  return mapCursista(rows[0], options)
}

async function setPassword(id, passwordHash) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET password_hash = ?, failed_attempts = 0, locked_until = NULL,
         first_access_at = COALESCE(first_access_at, NOW())
     WHERE id = ?`,
    [passwordHash, id]
  )
}

/** Volta a conta para o estado de primeiro acesso: o CPF passa a valer de novo. */
async function resetPassword(id) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET password_hash = NULL, failed_attempts = 0, locked_until = NULL, first_access_at = NULL
     WHERE id = ?`,
    [id]
  )
}

async function registerSuccessfulLogin(id) {
  requireMysql()
  await getPool().execute(
    'UPDATE cursistas SET last_access_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = ?',
    [id]
  )
}

/**
 * Conta a tentativa falha e bloqueia temporariamente ao atingir o limite.
 * O bloqueio e por conta; o limite por IP fica no rate limiter da rota.
 */
async function registerFailedLogin(id, { maxAttempts, lockMinutes }) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET failed_attempts = failed_attempts + 1,
         locked_until = IF(failed_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
     WHERE id = ?`,
    [maxAttempts, lockMinutes, id]
  )
}

/** Campos que o proprio cursista pode alterar: apenas contato. */
async function updateContact(id, { email, phone }) {
  requireMysql()
  await getPool().execute('UPDATE cursistas SET email = ?, phone = ? WHERE id = ?', [
    email || null,
    phone || null,
    id,
  ])
}

/**
 * Insere ou atualiza um cursista da base oficial.
 * O UPDATE nunca toca em password_hash: reimportar a base nao derruba o acesso
 * de quem ja definiu a propria senha.
 */
async function upsertFromImport(record, connection) {
  const runner = connection || getPool()
  const [result] = await runner.execute(
    `INSERT INTO cursistas
       (cpf, name, birth_date, email, phone, registration, position, school, municipality, regional)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       birth_date = VALUES(birth_date),
       email = COALESCE(VALUES(email), email),
       phone = COALESCE(VALUES(phone), phone),
       registration = VALUES(registration),
       position = VALUES(position),
       school = VALUES(school),
       municipality = VALUES(municipality),
       regional = VALUES(regional)`,
    [
      record.cpf,
      record.name,
      record.birthDate || null,
      record.email || null,
      record.phone || null,
      record.registration || null,
      record.position || null,
      record.school || null,
      record.municipality || null,
      record.regional || null,
    ]
  )
  // affectedRows: 1 = inserido, 2 = atualizado (comportamento do MySQL no upsert)
  return result.affectedRows === 1 ? 'inserido' : 'atualizado'
}

async function list({ search = '', status = '', page = 1, perPage = 50 }) {
  requireMysql()
  const filters = []
  const params = []

  if (search) {
    const digits = normalizeCpf(search)
    // Busca por nome sempre; por CPF so quando o termo tem cara de CPF completo.
    if (digits.length === 11) {
      filters.push('(name LIKE ? OR cpf = ?)')
      params.push(`%${search}%`, digits)
    } else {
      filters.push('name LIKE ?')
      params.push(`%${search}%`)
    }
  }
  if (status) {
    filters.push('status = ?')
    params.push(status)
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(perPage) || 50, 1), 200)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit

  const [rows] = await getPool().query(
    `SELECT * FROM cursistas ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [[{ total }]] = await getPool().query(
    `SELECT COUNT(*) AS total FROM cursistas ${where}`,
    params
  )

  return { items: rows.map((row) => mapCursista(row)), total, page: Number(page) || 1, perPage: limit }
}

module.exports = {
  mapCursista,
  findByCpfForAuth,
  findByIdForAuth,
  findById,
  setPassword,
  resetPassword,
  registerSuccessfulLogin,
  registerFailedLogin,
  updateContact,
  upsertFromImport,
  list,
}
