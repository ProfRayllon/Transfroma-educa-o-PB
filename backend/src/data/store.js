const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const { users, courses, materials, people, occurrences, notifications } = require('./mockData')

const DATA_MODE = process.env.DATA_MODE || 'mock'
const MYSQL_AUTO_SEED = process.env.MYSQL_AUTO_SEED === 'true'

let pool

function isMysqlMode() {
  return DATA_MODE === 'mysql'
}

function mapUserRow(row) {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    registration: row.registration,
    role: row.role,
    function: row.function,
    avatar: row.avatar,
    status: row.status,
    lastAccess: row.last_access,
    createdAt: formatDate(row.created_at, true),
  }
}

function mapMaterialRow(row) {
  return {
    id: row.id,
    course: row.course,
    session: row.session,
    theme: row.theme,
    objective: row.objective,
    type: row.type,
    duration: row.duration,
    responsibleId: row.responsible_id,
    responsibleName: row.responsible_name,
    responsibleRole: row.responsible_role,
    status: row.status,
    deliveryDate: formatDate(row.delivery_date),
    originalLink: row.original_link,
    adjustedLink: row.adjusted_link,
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
    createdAt: formatDate(row.created_at),
  }
}

function mapCourseRow(row) {
  return {
    id: row.id,
    name: row.name,
    primaryTrail: row.primary_trail,
    trail: row.secondary_trail,
    totalSessions: row.total_sessions,
    supervisorName: row.supervisor_name,
    coordinatorName: row.coordinator_name,
    startDate: formatDate(row.start_date),
    deadline: formatDate(row.deadline),
    image: row.image,
    createdAt: formatDate(row.created_at, true),
  }
}

function mapPeopleRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.user_name,
    function: row.function,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    attendanceStatus: row.attendance_status,
    attendanceTime: row.attendance_time,
    completedActivities: row.completed_activities_percentage,
    openOccurrences: row.open_occurrences_count,
    status: row.status,
  }
}

function mapOccurrenceRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    type: row.type,
    description: row.description,
    severity: row.severity,
    status: row.status,
    createdBy: row.created_by_name,
    resolvedBy: row.resolved_by_name,
    createdAt: formatDate(row.created_at),
  }
}

function mapNotificationRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

function formatDate(value, includeTime = false) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  if (includeTime) {
    return date.toISOString().slice(0, 19)
  }

  return date.toISOString().slice(0, 10)
}

async function createPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'transforma_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })

  await pool.query('SELECT 1')
}

async function ensureMysqlSchema() {
  const [avatarColumns] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'avatar'`
  )

  if (avatarColumns.length === 0) {
    await pool.execute('ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT DEFAULT NULL AFTER `function`')
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      primary_trail ENUM('TRILHAS TRANSVERSAIS','TRILHAS DA FORMACAO GERAL BASICA') NOT NULL,
      secondary_trail VARCHAR(150) NOT NULL,
      total_sessions INT NOT NULL DEFAULT 0,
      supervisor_name VARCHAR(150) NOT NULL,
      coordinator_name VARCHAR(150) NOT NULL,
      start_date DATE DEFAULT NULL,
      deadline DATE DEFAULT NULL,
      image MEDIUMTEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_courses_name (name),
      INDEX idx_courses_primary_trail (primary_trail),
      INDEX idx_courses_secondary_trail (secondary_trail),
      INDEX idx_courses_supervisor (supervisor_name),
      INDEX idx_courses_coordinator (coordinator_name),
      CONSTRAINT chk_courses_total_sessions
        CHECK (total_sessions >= 0)
    ) ENGINE=InnoDB
  `)
}

async function seedMysqlIfNeeded() {
  const [[result]] = await pool.query('SELECT COUNT(*) AS total FROM users')
  if (result.total > 0) return

  for (const user of users) {
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, registration, role, \`function\`, avatar, status, last_access, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.registration,
        user.role,
        user.function,
        user.avatar || null,
        user.status,
        user.lastAccess || null,
        user.createdAt,
      ]
    )
  }

  for (const material of materials) {
    await pool.execute(
      `INSERT INTO materials
       (id, course, session, theme, objective, type, duration, responsible_id, responsible_name, responsible_role, status, delivery_date, original_link, adjusted_link, review_status, review_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        material.id,
        material.course,
        material.session,
        material.theme,
        material.objective,
        material.type,
        material.duration,
        material.responsibleId,
        material.responsibleName,
        material.responsibleRole,
        material.status,
        material.deliveryDate,
        material.originalLink,
        material.adjustedLink,
        material.reviewStatus,
        material.reviewNotes,
        material.createdAt,
      ]
    )
  }

  for (const person of people) {
    await pool.execute(
      `INSERT INTO people_management
       (id, user_id, supervisor_id, \`function\`, attendance_status, attendance_time, completed_activities_percentage, open_occurrences_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        person.id,
        person.userId,
        person.supervisorId,
        person.function,
        person.attendanceStatus,
        person.attendanceTime,
        person.completedActivities,
        person.openOccurrences,
        person.status,
      ]
    )
  }

  for (const occurrence of occurrences) {
    const createdById = users.find((user) => user.name === occurrence.createdBy)?.id || null
    const resolvedById = users.find((user) => user.name === occurrence.resolvedBy)?.id || null

    await pool.execute(
      `INSERT INTO occurrences
       (id, user_id, type, description, severity, status, created_by, resolved_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        occurrence.id,
        occurrence.userId,
        occurrence.type,
        occurrence.description,
        occurrence.severity,
        occurrence.status,
        createdById,
        resolvedById,
        occurrence.createdAt,
      ]
    )
  }

  for (const notification of notifications) {
    await pool.execute(
      `INSERT INTO notifications
       (id, user_id, title, message, type, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.userId,
        notification.title,
        notification.message,
        notification.type,
        notification.readAt,
        notification.createdAt,
      ]
    )
  }

  for (const course of courses) {
    await pool.execute(
      `INSERT INTO courses
       (id, name, primary_trail, secondary_trail, total_sessions, supervisor_name, coordinator_name, start_date, deadline, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id,
        course.name,
        course.primaryTrail,
        course.trail,
        course.totalSessions || 0,
        course.supervisorName,
        course.coordinatorName,
        course.startDate || null,
        course.deadline || null,
        course.image || null,
      ]
    )
  }
}

async function initStore() {
  if (!isMysqlMode()) return

  await createPool()
  await ensureMysqlSchema()

  if (MYSQL_AUTO_SEED) {
    await seedMysqlIfNeeded()
  }
}

async function getUserByEmail(email) {
  if (!isMysqlMode()) {
    return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email])
  return mapUserRow(rows[0])
}

async function getUserById(id) {
  if (!isMysqlMode()) {
    return users.find((user) => user.id === Number(id)) || null
  }

  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [id])
  return mapUserRow(rows[0])
}

async function listUsers() {
  if (!isMysqlMode()) {
    return users.slice()
  }

  const [rows] = await pool.execute('SELECT * FROM users ORDER BY id')
  return rows.map(mapUserRow)
}

async function createUser(payload) {
  if (!isMysqlMode()) {
    const passwordHash = await bcrypt.hash(payload.password, 10)
    const newUser = {
      id: Date.now(),
      ...payload,
      passwordHash,
      createdAt: new Date().toISOString().split('T')[0],
      lastAccess: null,
    }
    delete newUser.password
    users.push(newUser)
    return newUser
  }

  const passwordHash = await bcrypt.hash(payload.password, 10)
  const [result] = await pool.execute(
    `INSERT INTO users (name, email, password_hash, registration, role, \`function\`, avatar, status, last_access, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.email,
      passwordHash,
      payload.registration || null,
      payload.role,
      payload.function || null,
      payload.avatar || null,
      payload.status || 'ativo',
      null,
      new Date().toISOString().slice(0, 10),
    ]
  )

  return getUserById(result.insertId)
}

async function updateUser(id, updates) {
  if (!isMysqlMode()) {
    const idx = users.findIndex((user) => user.id === Number(id))
    if (idx === -1) return null
    const next = { ...users[idx], ...updates }
    delete next.password
    delete next.passwordHash

    if (updates.password) {
      next.passwordHash = await bcrypt.hash(updates.password, 10)
    } else {
      next.passwordHash = users[idx].passwordHash
    }

    users[idx] = next
    return users[idx]
  }

  const fields = []
  const values = []
  const mapped = {
    name: updates.name,
    email: updates.email,
    registration: updates.registration,
    role: updates.role,
    '`function`': updates.function,
    avatar: updates.avatar,
    status: updates.status,
  }

  Object.entries(mapped).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  })

  if (updates.password) {
    fields.push('password_hash = ?')
    values.push(await bcrypt.hash(updates.password, 10))
  }

  if (fields.length > 0) {
    values.push(id)
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  return getUserById(id)
}

async function deleteUser(id) {
  if (!isMysqlMode()) {
    const idx = users.findIndex((user) => user.id === Number(id))
    if (idx === -1) return false
    users.splice(idx, 1)
    return true
  }

  const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id])
  return result.affectedRows > 0
}

async function listCourses() {
  if (!isMysqlMode()) {
    return courses.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }

  const [rows] = await pool.execute('SELECT * FROM courses ORDER BY name')
  return rows.map(mapCourseRow)
}

async function getCourseById(id) {
  if (!isMysqlMode()) {
    return courses.find((course) => course.id === Number(id)) || null
  }

  const [rows] = await pool.execute('SELECT * FROM courses WHERE id = ? LIMIT 1', [id])
  return rows[0] ? mapCourseRow(rows[0]) : null
}

async function createCourse(payload) {
  if (!isMysqlMode()) {
    const course = {
      id: Date.now(),
      ...payload,
      totalSessions: Number(payload.totalSessions) || 0,
      createdAt: new Date().toISOString().slice(0, 19),
    }
    courses.push(course)
    return course
  }

  const [result] = await pool.execute(
    `INSERT INTO courses
     (name, primary_trail, secondary_trail, total_sessions, supervisor_name, coordinator_name, start_date, deadline, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.primaryTrail,
      payload.trail,
      Number(payload.totalSessions) || 0,
      payload.supervisorName,
      payload.coordinatorName,
      payload.startDate || null,
      payload.deadline || null,
      payload.image || null,
    ]
  )

  return getCourseById(result.insertId)
}

async function updateCourse(id, payload) {
  if (!isMysqlMode()) {
    const idx = courses.findIndex((course) => course.id === Number(id))
    if (idx === -1) return null
    courses[idx] = {
      ...courses[idx],
      ...payload,
      id: Number(id),
      totalSessions: Number(payload.totalSessions) || 0,
    }
    return courses[idx]
  }

  await pool.execute(
    `UPDATE courses
     SET name = ?, primary_trail = ?, secondary_trail = ?, total_sessions = ?, supervisor_name = ?, coordinator_name = ?, start_date = ?, deadline = ?, image = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.primaryTrail,
      payload.trail,
      Number(payload.totalSessions) || 0,
      payload.supervisorName,
      payload.coordinatorName,
      payload.startDate || null,
      payload.deadline || null,
      payload.image || null,
      id,
    ]
  )

  return getCourseById(id)
}

async function deleteCourse(id) {
  if (!isMysqlMode()) {
    const idx = courses.findIndex((course) => course.id === Number(id))
    if (idx === -1) return false
    courses.splice(idx, 1)
    return true
  }

  const [result] = await pool.execute('DELETE FROM courses WHERE id = ?', [id])
  return result.affectedRows > 0
}

async function listMaterials(user) {
  if (!isMysqlMode()) {
    if (user.role === 'professor') {
      return materials.filter((material) => material.responsibleId === user.id)
    }
    return materials.slice()
  }

  const params = []
  let sql = 'SELECT * FROM materials'
  if (user.role === 'professor') {
    sql += ' WHERE responsible_id = ?'
    params.push(user.id)
  }
  sql += ' ORDER BY id'
  const [rows] = await pool.execute(sql, params)
  return rows.map(mapMaterialRow)
}

async function getMaterialById(id) {
  if (!isMysqlMode()) {
    return materials.find((material) => material.id === Number(id)) || null
  }

  const [rows] = await pool.execute('SELECT * FROM materials WHERE id = ? LIMIT 1', [id])
  return rows[0] ? mapMaterialRow(rows[0]) : null
}

async function createMaterial(payload) {
  if (!isMysqlMode()) {
    const material = { id: Date.now(), ...payload, createdAt: new Date().toISOString().split('T')[0] }
    materials.push(material)
    return material
  }

  const [result] = await pool.execute(
    `INSERT INTO materials
     (course, session, theme, objective, type, duration, responsible_id, responsible_name, responsible_role, status, delivery_date, original_link, adjusted_link, review_status, review_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.course,
      payload.session,
      payload.theme,
      payload.objective || null,
      payload.type,
      payload.duration || null,
      payload.responsibleId || null,
      payload.responsibleName || null,
      payload.responsibleRole || null,
      payload.status,
      payload.deliveryDate || null,
      payload.originalLink || null,
      payload.adjustedLink || null,
      payload.reviewStatus,
      payload.reviewNotes || null,
      new Date().toISOString().slice(0, 10),
    ]
  )

  return getMaterialById(result.insertId)
}

async function updateMaterial(id, payload) {
  if (!isMysqlMode()) {
    const idx = materials.findIndex((material) => material.id === Number(id))
    if (idx === -1) return null
    materials[idx] = { ...materials[idx], ...payload }
    return materials[idx]
  }

  await pool.execute(
    `UPDATE materials
     SET course = ?, session = ?, theme = ?, objective = ?, type = ?, duration = ?, responsible_id = ?, responsible_name = ?, responsible_role = ?, status = ?, delivery_date = ?, original_link = ?, adjusted_link = ?, review_status = ?, review_notes = ?
     WHERE id = ?`,
    [
      payload.course,
      payload.session,
      payload.theme,
      payload.objective || null,
      payload.type,
      payload.duration || null,
      payload.responsibleId || null,
      payload.responsibleName || null,
      payload.responsibleRole || null,
      payload.status,
      payload.deliveryDate || null,
      payload.originalLink || null,
      payload.adjustedLink || null,
      payload.reviewStatus,
      payload.reviewNotes || null,
      id,
    ]
  )

  return getMaterialById(id)
}

async function approveMaterial(id) {
  if (!isMysqlMode()) {
    const idx = materials.findIndex((material) => material.id === Number(id))
    if (idx === -1) return null
    materials[idx] = { ...materials[idx], status: 'aprovado', reviewStatus: 'aprovado' }
    return materials[idx]
  }

  await pool.execute(
    'UPDATE materials SET status = ?, review_status = ? WHERE id = ?',
    ['aprovado', 'aprovado', id]
  )
  return getMaterialById(id)
}

async function listPeople(user) {
  if (!isMysqlMode()) {
    if (['administrador', 'supervisor', 'gestao'].includes(user.role)) return people.slice()
    return people.filter((person) => person.userId === user.id)
  }

  const params = []
  let sql = `
    SELECT pm.*, u.name AS user_name, s.name AS supervisor_name
    FROM people_management pm
    JOIN users u ON u.id = pm.user_id
    LEFT JOIN users s ON s.id = pm.supervisor_id
  `

  if (!['administrador', 'supervisor', 'gestao'].includes(user.role)) {
    sql += ' WHERE pm.user_id = ?'
    params.push(user.id)
  }

  sql += ' ORDER BY pm.id'
  const [rows] = await pool.execute(sql, params)
  return rows.map(mapPeopleRow)
}

async function updateAttendance(id, updates) {
  if (!isMysqlMode()) {
    const idx = people.findIndex((person) => person.id === Number(id))
    if (idx === -1) return null
    people[idx] = { ...people[idx], ...updates }
    return people[idx]
  }

  const fields = []
  const values = []
  const mapped = {
    '`function`': updates.function,
    attendance_status: updates.attendanceStatus,
    attendance_time: updates.attendanceTime,
    completed_activities_percentage: updates.completedActivities,
    open_occurrences_count: updates.openOccurrences,
    status: updates.status,
  }

  Object.entries(mapped).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  })

  if (fields.length === 0) {
    const [rows] = await pool.execute(
      `SELECT pm.*, u.name AS user_name, s.name AS supervisor_name
       FROM people_management pm
       JOIN users u ON u.id = pm.user_id
       LEFT JOIN users s ON s.id = pm.supervisor_id
       WHERE pm.id = ?`,
      [id]
    )
    return rows[0] ? mapPeopleRow(rows[0]) : null
  }

  values.push(id)
  await pool.execute(`UPDATE people_management SET ${fields.join(', ')} WHERE id = ?`, values)

  const [rows] = await pool.execute(
    `SELECT pm.*, u.name AS user_name, s.name AS supervisor_name
     FROM people_management pm
     JOIN users u ON u.id = pm.user_id
     LEFT JOIN users s ON s.id = pm.supervisor_id
     WHERE pm.id = ?`,
    [id]
  )
  return rows[0] ? mapPeopleRow(rows[0]) : null
}

async function listOccurrences(user) {
  if (!isMysqlMode()) {
    if (['administrador', 'supervisor', 'gestao'].includes(user.role)) return occurrences.slice()
    return occurrences.filter((occurrence) => occurrence.userId === user.id)
  }

  const params = []
  let sql = `
    SELECT o.*, u.name AS user_name, cb.name AS created_by_name, rb.name AS resolved_by_name
    FROM occurrences o
    JOIN users u ON u.id = o.user_id
    LEFT JOIN users cb ON cb.id = o.created_by
    LEFT JOIN users rb ON rb.id = o.resolved_by
  `

  if (!['administrador', 'supervisor', 'gestao'].includes(user.role)) {
    sql += ' WHERE o.user_id = ?'
    params.push(user.id)
  }

  sql += ' ORDER BY o.id'
  const [rows] = await pool.execute(sql, params)
  return rows.map(mapOccurrenceRow)
}

async function createOccurrence(payload) {
  if (!isMysqlMode()) {
    const occurrence = { id: Date.now(), ...payload, createdAt: new Date().toISOString().split('T')[0] }
    occurrences.push(occurrence)
    return occurrence
  }

  const [result] = await pool.execute(
    `INSERT INTO occurrences (user_id, type, description, severity, status, created_by, resolved_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.type,
      payload.description || null,
      payload.severity || 'baixa',
      payload.status || 'aberta',
      payload.createdBy,
      payload.resolvedBy || null,
      payload.createdAt || new Date().toISOString().slice(0, 10),
    ]
  )

  const [rows] = await pool.execute(
    `SELECT o.*, u.name AS user_name, cb.name AS created_by_name, rb.name AS resolved_by_name
     FROM occurrences o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN users cb ON cb.id = o.created_by
     LEFT JOIN users rb ON rb.id = o.resolved_by
     WHERE o.id = ?`,
    [result.insertId]
  )

  return mapOccurrenceRow(rows[0])
}

async function updateOccurrence(id, updates) {
  if (!isMysqlMode()) {
    const idx = occurrences.findIndex((occurrence) => occurrence.id === Number(id))
    if (idx === -1) return null
    occurrences[idx] = { ...occurrences[idx], ...updates }
    return occurrences[idx]
  }

  const mapped = {
    user_id: updates.userId,
    type: updates.type,
    description: updates.description,
    severity: updates.severity,
    status: updates.status,
    created_by: updates.createdBy,
    resolved_by: updates.resolvedBy,
  }

  const fields = []
  const values = []

  Object.entries(mapped).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  })

  values.push(id)
  await pool.execute(`UPDATE occurrences SET ${fields.join(', ')} WHERE id = ?`, values)

  const [rows] = await pool.execute(
    `SELECT o.*, u.name AS user_name, cb.name AS created_by_name, rb.name AS resolved_by_name
     FROM occurrences o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN users cb ON cb.id = o.created_by
     LEFT JOIN users rb ON rb.id = o.resolved_by
     WHERE o.id = ?`,
    [id]
  )

  return rows[0] ? mapOccurrenceRow(rows[0]) : null
}

async function listNotifications(userId) {
  if (!isMysqlMode()) {
    return notifications.filter((notification) => notification.userId === Number(userId))
  }

  const [rows] = await pool.execute(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC',
    [userId]
  )
  return rows.map(mapNotificationRow)
}

async function markNotificationRead(id, userId) {
  if (!isMysqlMode()) {
    const idx = notifications.findIndex((notification) => notification.id === Number(id))
    if (idx === -1 || notifications[idx].userId !== Number(userId)) return null
    notifications[idx].readAt = new Date().toISOString()
    return notifications[idx]
  }

  await pool.execute(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?',
    [id, userId]
  )

  const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ? AND user_id = ? LIMIT 1', [id, userId])
  return rows[0] ? mapNotificationRow(rows[0]) : null
}

module.exports = {
  DATA_MODE,
  MYSQL_AUTO_SEED,
  initStore,
  getUserByEmail,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  listMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  approveMaterial,
  listPeople,
  updateAttendance,
  listOccurrences,
  createOccurrence,
  updateOccurrence,
  listNotifications,
  markNotificationRead,
}
