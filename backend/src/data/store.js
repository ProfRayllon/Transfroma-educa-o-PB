const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const { users, courses, materials, modules, moduleEvents, people, occurrences, notifications } = require('./mockData')

const DATA_MODE = process.env.DATA_MODE || 'mock'
const MYSQL_AUTO_SEED = process.env.MYSQL_AUTO_SEED === 'true'

let pool
let ementas_data = []

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
    area: row.area,
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
    courseId: row.course_id || null,
    session: row.session,
    module: row.module || 1,
    moduleId: row.module_id || null,
    theme: row.theme,
    objective: row.objective,
    type: parseTypeField(row.type),
    duration: row.duration,
    responsibleId: row.responsible_id,
    responsibleName: row.responsible_name,
    responsibleRole: row.responsible_role,
    responsibles: parseJsonArray(row.responsibles),
    status: row.status,
    deliveryDate: formatDate(row.delivery_date),
    originalLink: row.original_link,
    adjustedLink: row.adjusted_link,
    reviewStatus: row.review_status,
    supervisorStatus: row.supervisor_status ?? null,
    coordinatorStatus: row.coordinator_status ?? null,
    revisorId: row.revisor_id || null,
    revisorName: row.revisor_name || null,
    revisorStatus: row.revisor_status ?? null,
    reviewNotes: row.review_notes,
    createdAt: formatDate(row.created_at),
  }
}

function parseJsonArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Buffer.isBuffer(value)) value = value.toString('utf8')
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

function parseTypeField(value) {
  if (!value) return null
  if (Array.isArray(value)) return value[0] || null
  if (Buffer.isBuffer(value)) value = value.toString('utf8')
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed[0] || null
  } catch {}
  return value
}

function mapCourseRow(row) {
  return {
    id: row.id,
    name: row.name,
    primaryTrail: row.primary_trail,
    trail: row.secondary_trail,
    totalSessions: row.total_sessions,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    supervisorAvatar: row.supervisor_avatar || null,
    coordinatorId: row.coordinator_id,
    coordinatorName: row.coordinator_name,
    coordinatorAvatar: row.coordinator_avatar || null,
    producers: parseJsonArray(row.producers).filter((producer) => producer.id),
    revisors: parseJsonArray(row.revisors).filter((revisor) => revisor.id),
    startDate: formatDate(row.start_date),
    deadline: formatDate(row.deadline),
    image: row.image,
    createdAt: formatDate(row.created_at, true),
  }
}

function mapModuleRow(row) {
  if (!row) return null

  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    workload: row.workload,
    order: row.order_index,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    teacherAvatar: row.teacher_avatar || null,
    supervisorId: row.supervisor_id,
    supervisorName: row.supervisor_name,
    supervisorAvatar: row.supervisor_avatar || null,
    coordinatorId: row.coordinator_id,
    coordinatorName: row.coordinator_name,
    coordinatorAvatar: row.coordinator_avatar || null,
    deadline: formatDate(row.deadline),
    stage: row.stage,
    professorStatus: row.professor_status,
    supervisorStatus: row.supervisor_status,
    coordinatorStatus: row.coordinator_status,
    createdBy: row.created_by,
    createdAt: formatDate(row.created_at, true),
    updatedAt: row.updated_at ? formatDate(row.updated_at, true) : null,
  }
}

function mapModuleEventRow(row) {
  if (!row) return null

  return {
    id: row.id,
    moduleId: row.module_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    type: row.type,
    action: row.action,
    message: row.message,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

function mapEmentaRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    contextualization: row.contextualization,
    justification: row.justification,
    relevance: row.relevance,
    generalObjective: row.general_objective,
    specificObjectives: parseJsonArray(row.specific_objectives),
    technicalCompetencies: row.technical_competencies,
    pedagogicalCompetencies: row.pedagogical_competencies,
    socioemotionalCompetencies: row.socioemotional_competencies,
    syllabusDescription: row.syllabus_description,
    programmaticContent: parseJsonArray(row.programmatic_content),
    educationalResources: parseJsonArray(row.educational_resources),
    evaluationCriteria: row.evaluation_criteria,
    evaluationInstruments: row.evaluation_instruments,
    referencesList: row.references_list,
    professorStatus: row.professor_status || 'rascunho',
    supervisorStatus: row.supervisor_status || 'pendente',
    coordinatorStatus: row.coordinator_status || 'pendente',
    createdBy: row.created_by,
    createdAt: formatDate(row.created_at),
    updatedAt: row.updated_at ? formatDate(row.updated_at) : null,
  }
}

function isCoordinatorUser(user) {
  return user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')
}

function materialMatchesCourse(material, course) {
  if (!material || !course) return false
  return Number(material.courseId) === Number(course.id) || material.course === course.name
}

function materialHasResponsible(material, userId) {
  return Number(material?.responsibleId) === Number(userId)
    || material?.responsibles?.some((responsible) => Number(responsible.id) === Number(userId))
}

function materialsCourseJoin(materialAlias = 'm', courseAlias = 'c') {
  return `${courseAlias}.id = ${materialAlias}.course_id OR (${materialAlias}.course_id IS NULL AND ${courseAlias}.name = ${materialAlias}.course)`
}

function canSeeAllCourses(user) {
  return user?.role === 'administrador'
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
  await pool.execute(
    "ALTER TABLE users MODIFY role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao','revisor') NOT NULL DEFAULT 'professor'"
  )

  const [userExtraColumns] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME IN ('area', 'avatar')`
  )
  const existingUserExtraColumns = new Set(userExtraColumns.map((column) => column.COLUMN_NAME))

  if (!existingUserExtraColumns.has('area')) {
    await pool.execute('ALTER TABLE users ADD COLUMN area VARCHAR(150) DEFAULT NULL AFTER `function`')
  }

  if (!existingUserExtraColumns.has('avatar')) {
    await pool.execute('ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT DEFAULT NULL AFTER `function`')
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      primary_trail ENUM('TRILHAS TRANSVERSAIS','TRILHAS DA FORMACAO GERAL BASICA') NOT NULL,
      secondary_trail VARCHAR(150) NOT NULL,
      total_sessions INT NOT NULL DEFAULT 0,
      supervisor_id INT DEFAULT NULL,
      supervisor_name VARCHAR(150) NOT NULL,
      coordinator_id INT DEFAULT NULL,
      coordinator_name VARCHAR(150) NOT NULL,
      start_date DATE DEFAULT NULL,
      deadline DATE DEFAULT NULL,
      image MEDIUMTEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_courses_name (name),
      INDEX idx_courses_primary_trail (primary_trail),
      INDEX idx_courses_secondary_trail (secondary_trail),
      INDEX idx_courses_supervisor_id (supervisor_id),
      INDEX idx_courses_coordinator_id (coordinator_id),
      INDEX idx_courses_supervisor (supervisor_name),
      INDEX idx_courses_coordinator (coordinator_name),
      CONSTRAINT chk_courses_total_sessions
        CHECK (total_sessions >= 0)
    ) ENGINE=InnoDB
  `)

  const [courseColumns] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'courses'
       AND COLUMN_NAME IN ('supervisor_id', 'coordinator_id')`
  )
  const existingCourseColumns = new Set(courseColumns.map((column) => column.COLUMN_NAME))

  if (!existingCourseColumns.has('supervisor_id')) {
    await pool.execute('ALTER TABLE courses ADD COLUMN supervisor_id INT DEFAULT NULL AFTER total_sessions')
  }

  if (!existingCourseColumns.has('coordinator_id')) {
    await pool.execute('ALTER TABLE courses ADD COLUMN coordinator_id INT DEFAULT NULL AFTER supervisor_name')
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS course_producers (
      course_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (course_id, user_id),
      CONSTRAINT fk_course_producers_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_course_producers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS course_revisors (
      course_id INT NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (course_id, user_id),
      CONSTRAINT fk_course_revisors_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_course_revisors_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await pool.execute(`
    ALTER TABLE materials
    MODIFY type VARCHAR(500) NOT NULL DEFAULT 'videoaula'
  `)

  await pool.execute(`
    ALTER TABLE materials
    MODIFY status ENUM(
      'pendente',
      'em_producao',
      'em_revisao',
      'concluido',
      'aprovado',
      'reprovado',
      'ajuste_solicitado',
      'em_execucao',
      'validado',
      'em_ajustes',
      'revisao_linguistica',
      'edicao',
      'nao_iniciado'
    ) NULL DEFAULT NULL
  `)

  await pool.execute(`
    ALTER TABLE materials
    MODIFY review_status ENUM(
      'pendente',
      'em_revisao',
      'aprovado',
      'reprovado',
      'ajuste_solicitado',
      'em_execucao',
      'validado',
      'em_ajustes',
      'revisao_linguistica',
      'edicao',
      'concluido',
      'esperando_material'
    ) NOT NULL DEFAULT 'em_execucao'
  `)

  const [newMatColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials'
       AND COLUMN_NAME IN ('course_id', 'module', 'supervisor_status', 'coordinator_status', 'responsibles', 'revisor_id', 'revisor_name', 'revisor_status')`
  )
  const existingNewCols = new Set(newMatColumns.map((c) => c.COLUMN_NAME))

  if (!existingNewCols.has('course_id')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN course_id INT DEFAULT NULL AFTER course')
  }

  if (!existingNewCols.has('module')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN module INT NOT NULL DEFAULT 1 AFTER session')
  }

  if (!existingNewCols.has('supervisor_status')) {
    await pool.execute(
      'ALTER TABLE materials ADD COLUMN supervisor_status VARCHAR(20) NULL DEFAULT NULL AFTER review_status'
    )
  }

  if (!existingNewCols.has('coordinator_status')) {
    await pool.execute(
      'ALTER TABLE materials ADD COLUMN coordinator_status VARCHAR(20) NULL DEFAULT NULL AFTER supervisor_status'
    )
  }

  // Valores antigos (em_revisao/nao_validado/validado_com_ajustes/valido) davam status por
  // conteudo mas sem fluxo real; convertido para VARCHAR para suportar o novo vocabulario
  // (aguardando/aprovado/ajustes e pendente/aprovado/ajustes/reprovado) usado na aprovacao por
  // conteudo dentro de um modulo.
  if (existingNewCols.has('supervisor_status')) {
    await pool.execute('ALTER TABLE materials MODIFY supervisor_status VARCHAR(20) NULL DEFAULT NULL')
  }

  if (existingNewCols.has('coordinator_status')) {
    await pool.execute('ALTER TABLE materials MODIFY coordinator_status VARCHAR(20) NULL DEFAULT NULL')
  }

  if (!existingNewCols.has('responsibles')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN responsibles TEXT DEFAULT NULL AFTER responsible_role')
  }

  if (!existingNewCols.has('revisor_id')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN revisor_id INT DEFAULT NULL AFTER coordinator_status')
  }

  if (!existingNewCols.has('revisor_name')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN revisor_name VARCHAR(150) DEFAULT NULL AFTER revisor_id')
  }

  if (!existingNewCols.has('revisor_status')) {
    await pool.execute('ALTER TABLE materials ADD COLUMN revisor_status VARCHAR(20) NULL DEFAULT NULL AFTER revisor_name')
  }

  await pool.execute(`
    UPDATE materials m
    LEFT JOIN courses c ON c.name = m.course
    SET m.course_id = c.id
    WHERE m.course_id IS NULL
      AND c.id IS NOT NULL
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS course_modules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      workload VARCHAR(20) DEFAULT NULL,
      order_index INT NOT NULL DEFAULT 1,
      teacher_id INT DEFAULT NULL,
      teacher_name VARCHAR(150) DEFAULT NULL,
      supervisor_id INT DEFAULT NULL,
      supervisor_name VARCHAR(150) DEFAULT NULL,
      coordinator_id INT DEFAULT NULL,
      coordinator_name VARCHAR(150) DEFAULT NULL,
      deadline DATE DEFAULT NULL,
      stage ENUM('producao','supervisao','coordenacao','publicado') NOT NULL DEFAULT 'producao',
      professor_status ENUM('rascunho','em_producao','concluido') NOT NULL DEFAULT 'rascunho',
      supervisor_status ENUM('aguardando','aprovado','ajustes') NOT NULL DEFAULT 'aguardando',
      coordinator_status ENUM('pendente','aprovado','ajustes','reprovado') NOT NULL DEFAULT 'pendente',
      created_by INT DEFAULT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_course_modules_course (course_id),
      CONSTRAINT fk_course_modules_course
        FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  const [moduleExtraColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_modules' AND COLUMN_NAME = 'is_default'`
  )
  if (moduleExtraColumns.length === 0) {
    await pool.execute('ALTER TABLE course_modules ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0')
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS module_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      module_id INT NOT NULL,
      author_id INT DEFAULT NULL,
      author_name VARCHAR(150) DEFAULT NULL,
      author_role VARCHAR(50) DEFAULT NULL,
      type ENUM('comment','history') NOT NULL DEFAULT 'comment',
      action VARCHAR(50) DEFAULT NULL,
      message TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_module_events_module (module_id),
      CONSTRAINT fk_module_events_module
        FOREIGN KEY (module_id) REFERENCES course_modules(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  const [moduleMatColumns] = await pool.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'materials' AND COLUMN_NAME = 'module_id'`
  )

  if (moduleMatColumns.length === 0) {
    await pool.execute('ALTER TABLE materials ADD COLUMN module_id INT DEFAULT NULL AFTER module')
    await pool.execute('CREATE INDEX idx_materials_module_id ON materials(module_id)')
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ementas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL UNIQUE,
      contextualization TEXT DEFAULT NULL,
      justification TEXT DEFAULT NULL,
      relevance TEXT DEFAULT NULL,
      general_objective TEXT DEFAULT NULL,
      specific_objectives TEXT DEFAULT NULL,
      technical_competencies TEXT DEFAULT NULL,
      pedagogical_competencies TEXT DEFAULT NULL,
      socioemotional_competencies TEXT DEFAULT NULL,
      syllabus_description TEXT DEFAULT NULL,
      programmatic_content TEXT DEFAULT NULL,
      educational_resources TEXT DEFAULT NULL,
      evaluation_criteria TEXT DEFAULT NULL,
      evaluation_instruments TEXT DEFAULT NULL,
      references_list TEXT DEFAULT NULL,
      professor_status ENUM('rascunho','concluido') NOT NULL DEFAULT 'rascunho',
      supervisor_status ENUM('pendente','valido','nao_valido') NOT NULL DEFAULT 'pendente',
      coordinator_status ENUM('pendente','valido','nao_valido') NOT NULL DEFAULT 'pendente',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ementa_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}

async function seedMysqlIfNeeded() {
  const [[result]] = await pool.query('SELECT COUNT(*) AS total FROM users')
  if (result.total > 0) return

  for (const user of users) {
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, registration, role, \`function\`, area, avatar, status, last_access, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.registration,
        user.role,
        user.function,
        user.area || null,
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
       (id, course, course_id, session, theme, objective, type, duration, responsible_id, responsible_name, responsible_role, responsibles, status, delivery_date, original_link, adjusted_link, review_status, supervisor_status, coordinator_status, review_notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        material.id,
        material.course,
        material.courseId || null,
        material.session,
        material.theme,
        material.objective,
        material.type,
        material.duration,
        material.responsibleId,
        material.responsibleName,
        material.responsibleRole,
        material.responsibles?.length ? JSON.stringify(material.responsibles) : null,
        material.status,
        material.deliveryDate,
        material.originalLink,
        material.adjustedLink,
        material.reviewStatus,
        material.supervisorStatus || 'em_revisao',
        material.coordinatorStatus || 'em_revisao',
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
       (id, name, primary_trail, secondary_trail, total_sessions, supervisor_id, supervisor_name, coordinator_id, coordinator_name, start_date, deadline, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id,
        course.name,
        course.primaryTrail,
        course.trail,
        course.totalSessions || 0,
        course.supervisorId || null,
        course.supervisorName,
        course.coordinatorId || null,
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
    `INSERT INTO users (name, email, password_hash, registration, role, \`function\`, area, avatar, status, last_access, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.email,
      passwordHash,
      payload.registration || null,
      payload.role,
      payload.function || null,
      payload.area || null,
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
    area: updates.area,
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

async function listCourses(user) {
  if (!isMysqlMode()) {
    const visible = canSeeAllCourses(user)
      ? courses
      : courses.filter((course) => {
        if (user?.role === 'supervisor') {
          return course.supervisorId === user.id || course.supervisorName === user.name
        }
        if (isCoordinatorUser(user)) {
          return course.coordinatorId === user.id || course.coordinatorName === user.name
        }
        if (user?.role === 'revisor') {
          return course.revisors?.some((revisor) => Number(revisor.id) === Number(user.id))
        }
        return false
      })
    return visible.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }

  const params = []
  let sql = `
    SELECT c.*,
      s.avatar AS supervisor_avatar,
      COALESCE(s.name, c.supervisor_name) AS supervisor_name,
      co.avatar AS coordinator_avatar,
      COALESCE(co.name, c.coordinator_name) AS coordinator_name,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_producers cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.course_id = c.id
      ), JSON_ARRAY()) AS producers,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_revisors cr
        JOIN users u ON u.id = cr.user_id
        WHERE cr.course_id = c.id
      ), JSON_ARRAY()) AS revisors
    FROM courses c
    LEFT JOIN users s ON s.id = c.supervisor_id
    LEFT JOIN users co ON co.id = c.coordinator_id
  `

  if (!canSeeAllCourses(user)) {
    if (user?.role === 'supervisor') {
      sql += ' WHERE c.supervisor_id = ? OR c.supervisor_name = ?'
      params.push(user.id, user.name)
    } else if (isCoordinatorUser(user)) {
      sql += ' WHERE c.coordinator_id = ? OR c.coordinator_name = ?'
      params.push(user.id, user.name)
    } else if (user?.role === 'professor') {
      sql += ` WHERE EXISTS (
        SELECT 1 FROM course_producers cp
        WHERE cp.course_id = c.id AND cp.user_id = ?
      )`
      params.push(user.id)
    } else if (user?.role === 'revisor') {
      sql += ` WHERE EXISTS (
        SELECT 1 FROM course_revisors cr
        WHERE cr.course_id = c.id AND cr.user_id = ?
      )`
      params.push(user.id)
    } else {
      sql += ' WHERE 1 = 0'
    }
  }

  sql += ' ORDER BY c.name'
  const [rows] = await pool.execute(sql, params)
  return rows.map(mapCourseRow)
}

async function getCourseById(id) {
  if (!isMysqlMode()) {
    return courses.find((course) => course.id === Number(id)) || null
  }

  const [rows] = await pool.execute(
    `SELECT c.*,
      s.avatar AS supervisor_avatar,
      COALESCE(s.name, c.supervisor_name) AS supervisor_name,
      co.avatar AS coordinator_avatar,
      COALESCE(co.name, c.coordinator_name) AS coordinator_name,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_producers cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.course_id = c.id
      ), JSON_ARRAY()) AS producers,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_revisors cr
        JOIN users u ON u.id = cr.user_id
        WHERE cr.course_id = c.id
      ), JSON_ARRAY()) AS revisors
     FROM courses c
     LEFT JOIN users s ON s.id = c.supervisor_id
     LEFT JOIN users co ON co.id = c.coordinator_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  )
  return rows[0] ? mapCourseRow(rows[0]) : null
}

async function getCourseByName(name) {
  if (!isMysqlMode()) {
    return courses.find((course) => course.name === name) || null
  }

  const [rows] = await pool.execute(
    `SELECT c.*,
      s.avatar AS supervisor_avatar,
      COALESCE(s.name, c.supervisor_name) AS supervisor_name,
      co.avatar AS coordinator_avatar,
      COALESCE(co.name, c.coordinator_name) AS coordinator_name,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_producers cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.course_id = c.id
      ), JSON_ARRAY()) AS producers,
      COALESCE((
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'id', u.id,
          'name', u.name,
          'avatar', u.avatar,
          'function', u.\`function\`,
          'role', u.role
        ))
        FROM course_revisors cr
        JOIN users u ON u.id = cr.user_id
        WHERE cr.course_id = c.id
      ), JSON_ARRAY()) AS revisors
     FROM courses c
     LEFT JOIN users s ON s.id = c.supervisor_id
     LEFT JOIN users co ON co.id = c.coordinator_id
     WHERE c.name = ?
     LIMIT 1`,
    [name]
  )
  return rows[0] ? mapCourseRow(rows[0]) : null
}

async function syncCourseProducers(courseId, producerIds = []) {
  const ids = [...new Set(producerIds.map((id) => Number(id)).filter(Boolean))]

  await pool.execute('DELETE FROM course_producers WHERE course_id = ?', [courseId])

  for (const producerId of ids) {
    await pool.execute(
      'INSERT INTO course_producers (course_id, user_id) VALUES (?, ?)',
      [courseId, producerId]
    )
  }
}

async function syncCourseRevisors(courseId, revisorIds = []) {
  const ids = [...new Set(revisorIds.map((id) => Number(id)).filter(Boolean))]

  await pool.execute('DELETE FROM course_revisors WHERE course_id = ?', [courseId])

  for (const revisorId of ids) {
    await pool.execute(
      'INSERT INTO course_revisors (course_id, user_id) VALUES (?, ?)',
      [courseId, revisorId]
    )
  }
}

async function createCourse(payload) {
  if (!isMysqlMode()) {
    const course = {
      id: Date.now(),
      ...payload,
      producers: payload.producers || [],
      revisors: payload.revisors || [],
      totalSessions: Number(payload.totalSessions) || 0,
      createdAt: new Date().toISOString().slice(0, 19),
    }
    courses.push(course)
    return course
  }

  const [result] = await pool.execute(
    `INSERT INTO courses
     (name, primary_trail, secondary_trail, total_sessions, supervisor_id, supervisor_name, coordinator_id, coordinator_name, start_date, deadline, image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.primaryTrail,
      payload.trail,
      Number(payload.totalSessions) || 0,
      payload.supervisorId || null,
      payload.supervisorName,
      payload.coordinatorId || null,
      payload.coordinatorName,
      payload.startDate || null,
      payload.deadline || null,
      payload.image || null,
    ]
  )

  await syncCourseProducers(result.insertId, payload.producerIds)
  await syncCourseRevisors(result.insertId, payload.revisorIds)

  return getCourseById(result.insertId)
}

async function updateCourse(id, payload) {
  if (!isMysqlMode()) {
    const idx = courses.findIndex((course) => course.id === Number(id))
    if (idx === -1) return null
    const previous = courses[idx]
    courses[idx] = {
      ...courses[idx],
      ...payload,
      id: Number(id),
      producers: payload.producers || [],
      revisors: payload.revisors || [],
      totalSessions: Number(payload.totalSessions) || 0,
    }
    materials.forEach((material, materialIndex) => {
      if (!materialMatchesCourse(material, previous)) return
      materials[materialIndex] = {
        ...material,
        course: payload.name,
        courseId: Number(id),
      }
    })
    return courses[idx]
  }

  const previous = await getCourseById(id)

  await pool.execute(
    `UPDATE courses
     SET name = ?, primary_trail = ?, secondary_trail = ?, total_sessions = ?, supervisor_id = ?, supervisor_name = ?, coordinator_id = ?, coordinator_name = ?, start_date = ?, deadline = ?, image = ?
     WHERE id = ?`,
    [
      payload.name,
      payload.primaryTrail,
      payload.trail,
      Number(payload.totalSessions) || 0,
      payload.supervisorId || null,
      payload.supervisorName,
      payload.coordinatorId || null,
      payload.coordinatorName,
      payload.startDate || null,
      payload.deadline || null,
      payload.image || null,
      id,
    ]
  )

  await syncCourseProducers(id, payload.producerIds)
  await syncCourseRevisors(id, payload.revisorIds)
  if (previous) {
    await pool.execute(
      `UPDATE materials
       SET course = ?, course_id = ?
       WHERE course_id = ? OR (course_id IS NULL AND course = ?)`,
      [payload.name, id, id, previous.name]
    )
  }

  return getCourseById(id)
}

async function deleteCourse(id) {
  const course = await getCourseById(id)
  if (!course) return false

  if (!isMysqlMode()) {
    // Sem FK no modo mock: cascata manual de materiais, modulos e eventos de modulo,
    // no mesmo espirito do cascade ja feito ao excluir um modulo isolado.
    for (let i = materials.length - 1; i >= 0; i -= 1) {
      if (Number(materials[i].courseId) === Number(id) || materials[i].course === course.name) materials.splice(i, 1)
    }
    const moduleIdsToRemove = modules.filter((m) => Number(m.courseId) === Number(id)).map((m) => m.id)
    for (let i = modules.length - 1; i >= 0; i -= 1) {
      if (Number(modules[i].courseId) === Number(id)) modules.splice(i, 1)
    }
    for (let i = moduleEvents.length - 1; i >= 0; i -= 1) {
      if (moduleIdsToRemove.includes(moduleEvents[i].moduleId)) moduleEvents.splice(i, 1)
    }
    for (let i = ementas_data.length - 1; i >= 0; i -= 1) {
      if (Number(ementas_data[i].courseId) === Number(id)) ementas_data.splice(i, 1)
    }
    const idx = courses.findIndex((c) => c.id === Number(id))
    if (idx === -1) return false
    courses.splice(idx, 1)
    return true
  }

  // course_modules/module_events/ementas ja cascadam via FK (ON DELETE CASCADE);
  // materials nao tem FK para courses, entao precisa ser removido explicitamente.
  await pool.execute('DELETE FROM materials WHERE course_id = ? OR course = ?', [id, course.name])
  const [result] = await pool.execute('DELETE FROM courses WHERE id = ?', [id])
  return result.affectedRows > 0
}

async function listCourseParticipants() {
  const safeUser = (user) => {
    const { passwordHash: _, ...rest } = user
    return rest
  }

  if (!isMysqlMode()) {
    const activeUsers = users.filter((user) => user.status === 'ativo')
    return {
      supervisors: activeUsers.filter((user) => ['supervisor', 'administrador'].includes(user.role)).map(safeUser),
      coordinators: activeUsers.filter((user) => user.role === 'administrador' || isCoordinatorUser(user)).map(safeUser),
      producers: activeUsers.filter((user) => user.role === 'professor').map(safeUser),
      revisors: activeUsers.filter((user) => user.role === 'revisor').map(safeUser),
    }
  }

  const [rows] = await pool.execute(
    `SELECT *
     FROM users
     WHERE status = 'ativo'
       AND (
        role IN ('administrador', 'coordenador', 'supervisor', 'professor', 'revisor')
        OR LOWER(COALESCE(\`function\`, '')) LIKE '%coordenador%'
       )
     ORDER BY name`
  )
  const mapped = rows.map(mapUserRow).map(safeUser)

  return {
    supervisors: mapped.filter((user) => ['supervisor', 'administrador'].includes(user.role)),
    coordinators: mapped.filter((user) => user.role === 'administrador' || isCoordinatorUser(user)),
    producers: mapped.filter((user) => user.role === 'professor'),
    revisors: mapped.filter((user) => user.role === 'revisor'),
  }
}

async function listMaterialAssignees() {
  const safeUser = (user) => {
    const { passwordHash: _, ...rest } = user
    return rest
  }

  if (!isMysqlMode()) {
    return users
      .filter((user) => user.status === 'ativo')
      .filter((user) => ['administrador', 'supervisor', 'professor'].includes(user.role) || isCoordinatorUser(user))
      .map(safeUser)
  }

  const [rows] = await pool.execute(
    `SELECT *
     FROM users
     WHERE status = 'ativo'
       AND (
        role IN ('administrador', 'supervisor', 'professor')
        OR LOWER(COALESCE(\`function\`, '')) LIKE '%coordenador%'
       )
     ORDER BY name`
  )

  return rows.map(mapUserRow).map(safeUser)
}

async function listMaterials(user) {
  if (!isMysqlMode()) {
    if (user.role === 'professor') {
      return materials.filter((material) => {
        if (materialHasResponsible(material, user.id)) return true
        const course = courses.find((listedCourse) => materialMatchesCourse(material, listedCourse))
        return course?.producers?.some((producer) => Number(producer.id) === Number(user.id))
      })
    }
    if (user.role === 'supervisor') {
      return materials.filter((material) => {
        const course = courses.find((listedCourse) => materialMatchesCourse(material, listedCourse))
        return course?.supervisorId === user.id || course?.supervisorName === user.name
      })
    }
    if (isCoordinatorUser(user) && user.role !== 'administrador') {
      return materials.filter((material) => {
        const course = courses.find((listedCourse) => materialMatchesCourse(material, listedCourse))
        return course?.coordinatorId === user.id || course?.coordinatorName === user.name
      })
    }
    if (user.role === 'revisor') {
      return materials.filter((material) => {
        const course = courses.find((listedCourse) => materialMatchesCourse(material, listedCourse))
        return course?.revisors?.some((revisor) => Number(revisor.id) === Number(user.id))
      })
    }
    return materials.slice()
  }

  const params = []
  let sql = 'SELECT m.* FROM materials m'
  if (user.role === 'professor') {
    sql += ` LEFT JOIN courses c ON ${materialsCourseJoin('m', 'c')}
      WHERE m.responsible_id = ?
        OR JSON_CONTAINS(COALESCE(m.responsibles, JSON_ARRAY()), JSON_OBJECT('id', CAST(? AS UNSIGNED)), '$')
        OR EXISTS (
          SELECT 1 FROM course_producers cp
          WHERE cp.course_id = c.id AND cp.user_id = ?
        )`
    params.push(user.id, user.id, user.id)
  } else if (user.role === 'supervisor') {
    sql += ` LEFT JOIN courses c ON ${materialsCourseJoin('m', 'c')} WHERE c.supervisor_id = ? OR c.supervisor_name = ?`
    params.push(user.id, user.name)
  } else if (isCoordinatorUser(user) && user.role !== 'administrador') {
    sql += ` LEFT JOIN courses c ON ${materialsCourseJoin('m', 'c')} WHERE c.coordinator_id = ? OR c.coordinator_name = ?`
    params.push(user.id, user.name)
  } else if (user.role === 'revisor') {
    sql += ` LEFT JOIN courses c ON ${materialsCourseJoin('m', 'c')}
      WHERE EXISTS (
        SELECT 1 FROM course_revisors cr
        WHERE cr.course_id = c.id AND cr.user_id = ?
      )`
    params.push(user.id)
  }
  sql += ' ORDER BY m.id'
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
     (course, course_id, session, module, module_id, theme, objective, type, duration, responsible_id, responsible_name, responsible_role, responsibles, status, delivery_date, original_link, adjusted_link, review_status, supervisor_status, coordinator_status, revisor_id, revisor_name, revisor_status, review_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.course,
      payload.courseId || null,
      payload.session,
      payload.module || 1,
      payload.moduleId || null,
      payload.theme,
      payload.objective || null,
      payload.type || null,
      payload.duration || null,
      payload.responsibleId || null,
      payload.responsibleName || null,
      payload.responsibleRole || null,
      payload.responsibles?.length ? JSON.stringify(payload.responsibles) : null,
      payload.status ?? null,
      payload.deliveryDate || null,
      payload.originalLink || null,
      payload.adjustedLink || null,
      payload.reviewStatus || 'em_execucao',
      payload.supervisorStatus ?? null,
      payload.coordinatorStatus ?? null,
      payload.revisorId || null,
      payload.revisorName || null,
      payload.revisorStatus ?? null,
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
     SET course = ?, course_id = ?, session = ?, module = ?, module_id = ?, theme = ?, objective = ?, type = ?, duration = ?,
         responsible_id = ?, responsible_name = ?, responsible_role = ?, responsibles = ?, status = ?,
         delivery_date = ?, original_link = ?, adjusted_link = ?, review_status = ?,
         supervisor_status = ?, coordinator_status = ?, revisor_id = ?, revisor_name = ?, revisor_status = ?, review_notes = ?
     WHERE id = ?`,
    [
      payload.course,
      payload.courseId || null,
      payload.session,
      payload.module || 1,
      payload.moduleId || null,
      payload.theme,
      payload.objective || null,
      payload.type || null,
      payload.duration || null,
      payload.responsibleId || null,
      payload.responsibleName || null,
      payload.responsibleRole || null,
      payload.responsibles?.length ? JSON.stringify(payload.responsibles) : null,
      payload.status ?? null,
      payload.deliveryDate || null,
      payload.originalLink || null,
      payload.adjustedLink || null,
      payload.reviewStatus || 'em_execucao',
      payload.supervisorStatus ?? null,
      payload.coordinatorStatus ?? null,
      payload.revisorId || null,
      payload.revisorName || null,
      payload.revisorStatus ?? null,
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
    materials[idx] = { ...materials[idx], status: 'concluido', supervisorStatus: 'valido', coordinatorStatus: 'valido' }
    return materials[idx]
  }

  await pool.execute(
    'UPDATE materials SET status = ?, supervisor_status = ?, coordinator_status = ? WHERE id = ?',
    ['concluido', 'valido', 'valido', id]
  )
  return getMaterialById(id)
}

async function deleteMaterial(id) {
  if (!isMysqlMode()) {
    const idx = materials.findIndex((m) => m.id === Number(id))
    if (idx === -1) return false
    materials.splice(idx, 1)
    return true
  }
  const [result] = await pool.execute('DELETE FROM materials WHERE id = ?', [id])
  return result.affectedRows > 0
}

const MODULE_JOIN_SELECT = `
  SELECT cm.*,
    t.avatar AS teacher_avatar, COALESCE(t.name, cm.teacher_name) AS teacher_name,
    s.avatar AS supervisor_avatar, COALESCE(s.name, cm.supervisor_name) AS supervisor_name,
    co.avatar AS coordinator_avatar, COALESCE(co.name, cm.coordinator_name) AS coordinator_name
  FROM course_modules cm
  LEFT JOIN users t ON t.id = cm.teacher_id
  LEFT JOIN users s ON s.id = cm.supervisor_id
  LEFT JOIN users co ON co.id = cm.coordinator_id
`

function sortModuleEventsAsc(list) {
  return list.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

async function listModuleEvents(moduleId) {
  if (!isMysqlMode()) {
    return sortModuleEventsAsc(moduleEvents.filter((e) => Number(e.moduleId) === Number(moduleId)))
  }

  const [rows] = await pool.execute(
    'SELECT * FROM module_events WHERE module_id = ? ORDER BY created_at, id',
    [moduleId]
  )
  return rows.map(mapModuleEventRow)
}

const DEFAULT_MODULE_DESCRIPTION = 'Conteudos migrados automaticamente da producao anterior. Edite este modulo para organizar as informacoes.'

async function ensureDefaultModuleIfNeeded(courseId) {
  if (!isMysqlMode()) {
    const course = courses.find((c) => c.id === Number(courseId))
    const orphans = materials.filter((m) => !m.moduleId && (
      Number(m.courseId) === Number(courseId) || (!m.courseId && course && m.course === course.name)
    ))
    if (orphans.length === 0) return

    let defaultModule = modules.find((m) => Number(m.courseId) === Number(courseId) && m.isDefault)
    if (!defaultModule) {
      const now = new Date().toISOString()
      defaultModule = {
        id: Date.now(),
        courseId: Number(courseId),
        title: 'Módulo 1',
        description: DEFAULT_MODULE_DESCRIPTION,
        workload: null,
        order: modules.filter((m) => Number(m.courseId) === Number(courseId)).length + 1,
        teacherId: null,
        teacherName: null,
        supervisorId: course?.supervisorId || null,
        supervisorName: course?.supervisorName || null,
        coordinatorId: course?.coordinatorId || null,
        coordinatorName: course?.coordinatorName || null,
        deadline: null,
        stage: 'producao',
        professorStatus: 'rascunho',
        supervisorStatus: 'aguardando',
        coordinatorStatus: 'pendente',
        isDefault: true,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      }
      modules.push(defaultModule)
    }

    orphans.forEach((m) => {
      m.moduleId = defaultModule.id
      m.module = defaultModule.order
    })
    return
  }

  const [[orphanCount]] = await pool.execute(
    'SELECT COUNT(*) AS total FROM materials WHERE module_id IS NULL AND course_id = ?',
    [courseId]
  )
  if (!orphanCount.total) return

  const [[existing]] = await pool.execute(
    'SELECT id, order_index FROM course_modules WHERE course_id = ? AND is_default = 1 LIMIT 1',
    [courseId]
  )

  let moduleId = existing?.id
  let orderIndex = existing?.order_index || 1

  if (!moduleId) {
    const [[course]] = await pool.execute(
      'SELECT supervisor_id, supervisor_name, coordinator_id, coordinator_name FROM courses WHERE id = ?',
      [courseId]
    )
    const [[countRow]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM course_modules WHERE course_id = ?',
      [courseId]
    )
    orderIndex = countRow.total + 1

    const [result] = await pool.execute(
      `INSERT INTO course_modules
       (course_id, title, description, order_index, supervisor_id, supervisor_name, coordinator_id, coordinator_name, is_default)
       VALUES (?, 'Módulo 1', ?, ?, ?, ?, ?, ?, 1)`,
      [
        courseId,
        DEFAULT_MODULE_DESCRIPTION,
        orderIndex,
        course?.supervisor_id || null,
        course?.supervisor_name || null,
        course?.coordinator_id || null,
        course?.coordinator_name || null,
      ]
    )
    moduleId = result.insertId
  }

  await pool.execute(
    'UPDATE materials SET module_id = ?, module = ? WHERE course_id = ? AND module_id IS NULL',
    [moduleId, orderIndex, courseId]
  )
}

async function listModules(courseId) {
  await ensureDefaultModuleIfNeeded(courseId)

  if (!isMysqlMode()) {
    return modules
      .filter((m) => Number(m.courseId) === Number(courseId))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id)
      .map((m) => ({ ...m, events: sortModuleEventsAsc(moduleEvents.filter((e) => Number(e.moduleId) === Number(m.id))) }))
  }

  const [rows] = await pool.execute(`${MODULE_JOIN_SELECT} WHERE cm.course_id = ? ORDER BY cm.order_index, cm.id`, [courseId])
  const mappedModules = rows.map(mapModuleRow)
  if (mappedModules.length === 0) return []

  const ids = mappedModules.map((m) => m.id)
  const placeholders = ids.map(() => '?').join(',')
  const [eventRows] = await pool.execute(
    `SELECT * FROM module_events WHERE module_id IN (${placeholders}) ORDER BY created_at, id`,
    ids
  )
  const mappedEvents = eventRows.map(mapModuleEventRow)
  return mappedModules.map((m) => ({
    ...m,
    events: mappedEvents.filter((e) => Number(e.moduleId) === Number(m.id)),
  }))
}

async function getModuleById(id) {
  if (!isMysqlMode()) {
    const module = modules.find((m) => m.id === Number(id))
    if (!module) return null
    return { ...module, events: sortModuleEventsAsc(moduleEvents.filter((e) => Number(e.moduleId) === Number(module.id))) }
  }

  const [rows] = await pool.execute(`${MODULE_JOIN_SELECT} WHERE cm.id = ? LIMIT 1`, [id])
  const module = rows[0] ? mapModuleRow(rows[0]) : null
  if (!module) return null
  const events = await listModuleEvents(module.id)
  return { ...module, events }
}

async function createModule(payload) {
  if (!isMysqlMode()) {
    const now = new Date().toISOString()
    const module = {
      id: Date.now(),
      courseId: Number(payload.courseId),
      title: payload.title,
      description: payload.description || null,
      workload: payload.workload || null,
      order: payload.order || 1,
      teacherId: payload.teacherId || null,
      teacherName: payload.teacherName || null,
      supervisorId: payload.supervisorId || null,
      supervisorName: payload.supervisorName || null,
      coordinatorId: payload.coordinatorId || null,
      coordinatorName: payload.coordinatorName || null,
      deadline: payload.deadline || null,
      stage: 'producao',
      professorStatus: 'rascunho',
      supervisorStatus: 'aguardando',
      coordinatorStatus: 'pendente',
      createdBy: payload.createdBy || null,
      createdAt: now,
      updatedAt: now,
    }
    modules.push(module)
    return { ...module, events: [] }
  }

  const [result] = await pool.execute(
    `INSERT INTO course_modules
     (course_id, title, description, workload, order_index, teacher_id, teacher_name, supervisor_id, supervisor_name, coordinator_id, coordinator_name, deadline, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.courseId,
      payload.title,
      payload.description || null,
      payload.workload || null,
      payload.order || 1,
      payload.teacherId || null,
      payload.teacherName || null,
      payload.supervisorId || null,
      payload.supervisorName || null,
      payload.coordinatorId || null,
      payload.coordinatorName || null,
      payload.deadline || null,
      payload.createdBy || null,
    ]
  )
  return getModuleById(result.insertId)
}

async function updateModule(id, payload) {
  if (!isMysqlMode()) {
    const idx = modules.findIndex((m) => m.id === Number(id))
    if (idx === -1) return null
    modules[idx] = { ...modules[idx], ...payload, id: Number(id), updatedAt: new Date().toISOString() }
    return { ...modules[idx], events: sortModuleEventsAsc(moduleEvents.filter((e) => Number(e.moduleId) === Number(id))) }
  }

  await pool.execute(
    `UPDATE course_modules SET
      title = ?, description = ?, workload = ?, order_index = ?,
      teacher_id = ?, teacher_name = ?, supervisor_id = ?, supervisor_name = ?, coordinator_id = ?, coordinator_name = ?,
      deadline = ?, stage = ?, professor_status = ?, supervisor_status = ?, coordinator_status = ?
     WHERE id = ?`,
    [
      payload.title,
      payload.description || null,
      payload.workload || null,
      payload.order || 1,
      payload.teacherId || null,
      payload.teacherName || null,
      payload.supervisorId || null,
      payload.supervisorName || null,
      payload.coordinatorId || null,
      payload.coordinatorName || null,
      payload.deadline || null,
      payload.stage,
      payload.professorStatus,
      payload.supervisorStatus,
      payload.coordinatorStatus,
      id,
    ]
  )
  return getModuleById(id)
}

async function deleteModule(id) {
  if (!isMysqlMode()) {
    const idx = modules.findIndex((m) => m.id === Number(id))
    if (idx === -1) return false
    modules.splice(idx, 1)
    for (let i = moduleEvents.length - 1; i >= 0; i -= 1) {
      if (Number(moduleEvents[i].moduleId) === Number(id)) moduleEvents.splice(i, 1)
    }
    return true
  }

  const [result] = await pool.execute('DELETE FROM course_modules WHERE id = ?', [id])
  return result.affectedRows > 0
}

async function countMaterialsByModule(moduleId) {
  if (!isMysqlMode()) {
    return materials.filter((m) => Number(m.moduleId) === Number(moduleId)).length
  }

  const [[result]] = await pool.execute('SELECT COUNT(*) AS total FROM materials WHERE module_id = ?', [moduleId])
  return result.total
}

async function deleteMaterialsByModule(moduleId) {
  if (!isMysqlMode()) {
    for (let i = materials.length - 1; i >= 0; i -= 1) {
      if (Number(materials[i].moduleId) === Number(moduleId)) materials.splice(i, 1)
    }
    return
  }

  await pool.execute('DELETE FROM materials WHERE module_id = ?', [moduleId])
}

async function getModuleApprovalSummary(moduleId) {
  if (!isMysqlMode()) {
    const contents = materials.filter((m) => Number(m.moduleId) === Number(moduleId))
    return {
      total: contents.length,
      professorConcluded: contents.filter((m) => m.status === 'concluido').length,
      supervisorApproved: contents.filter((m) => m.supervisorStatus === 'aprovado').length,
      coordinatorApproved: contents.filter((m) => m.coordinatorStatus === 'aprovado').length,
      revisorApproved: contents.filter((m) => m.revisorStatus === 'aprovado').length,
    }
  }

  const [[row]] = await pool.execute(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) AS professor_concluded,
      SUM(CASE WHEN supervisor_status = 'aprovado' THEN 1 ELSE 0 END) AS supervisor_approved,
      SUM(CASE WHEN coordinator_status = 'aprovado' THEN 1 ELSE 0 END) AS coordinator_approved,
      SUM(CASE WHEN revisor_status = 'aprovado' THEN 1 ELSE 0 END) AS revisor_approved
     FROM materials WHERE module_id = ?`,
    [moduleId]
  )
  return {
    total: row.total,
    professorConcluded: Number(row.professor_concluded) || 0,
    supervisorApproved: Number(row.supervisor_approved) || 0,
    coordinatorApproved: Number(row.coordinator_approved) || 0,
    revisorApproved: Number(row.revisor_approved) || 0,
  }
}

async function createModuleEvent(payload) {
  if (!isMysqlMode()) {
    const event = {
      id: Date.now(),
      moduleId: Number(payload.moduleId),
      authorId: payload.authorId || null,
      authorName: payload.authorName || null,
      authorRole: payload.authorRole || null,
      type: payload.type,
      action: payload.action || null,
      message: payload.message || null,
      createdAt: new Date().toISOString(),
    }
    moduleEvents.push(event)
    return event
  }

  const [result] = await pool.execute(
    `INSERT INTO module_events (module_id, author_id, author_name, author_role, type, action, message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.moduleId,
      payload.authorId || null,
      payload.authorName || null,
      payload.authorRole || null,
      payload.type,
      payload.action || null,
      payload.message || null,
    ]
  )
  const [rows] = await pool.execute('SELECT * FROM module_events WHERE id = ?', [result.insertId])
  return mapModuleEventRow(rows[0])
}

async function getEmentaByCourseId(courseId) {
  if (!isMysqlMode()) {
    return ementas_data.find((e) => e.courseId === Number(courseId)) || null
  }
  const [rows] = await pool.execute('SELECT * FROM ementas WHERE course_id = ? LIMIT 1', [courseId])
  return rows[0] ? mapEmentaRow(rows[0]) : null
}

async function saveEmenta(courseId, payload, userId) {
  const jsonField = (val) => (Array.isArray(val) && val.length ? JSON.stringify(val) : null)

  if (!isMysqlMode()) {
    const idx = ementas_data.findIndex((e) => e.courseId === Number(courseId))
    const next = {
      id: idx >= 0 ? ementas_data[idx].id : Date.now(),
      courseId: Number(courseId),
      contextualization: payload.contextualization || null,
      justification: payload.justification || null,
      relevance: payload.relevance || null,
      generalObjective: payload.generalObjective || null,
      specificObjectives: payload.specificObjectives || [],
      technicalCompetencies: payload.technicalCompetencies || null,
      pedagogicalCompetencies: payload.pedagogicalCompetencies || null,
      socioemotionalCompetencies: payload.socioemotionalCompetencies || null,
      syllabusDescription: payload.syllabusDescription || null,
      programmaticContent: payload.programmaticContent || [],
      educationalResources: payload.educationalResources || [],
      evaluationCriteria: payload.evaluationCriteria || null,
      evaluationInstruments: payload.evaluationInstruments || null,
      referencesList: payload.referencesList || null,
      professorStatus: idx >= 0 ? ementas_data[idx].professorStatus : 'rascunho',
      supervisorStatus: idx >= 0 ? ementas_data[idx].supervisorStatus : 'pendente',
      coordinatorStatus: idx >= 0 ? ementas_data[idx].coordinatorStatus : 'pendente',
      createdBy: idx >= 0 ? ementas_data[idx].createdBy : userId,
      createdAt: idx >= 0 ? ementas_data[idx].createdAt : new Date().toISOString().slice(0, 10),
    }
    if (idx >= 0) { ementas_data[idx] = next } else { ementas_data.push(next) }
    return next
  }

  const existing = await getEmentaByCourseId(courseId)
  if (existing) {
    await pool.execute(
      `UPDATE ementas SET
        contextualization=?, justification=?, relevance=?, general_objective=?, specific_objectives=?,
        technical_competencies=?, pedagogical_competencies=?, socioemotional_competencies=?,
        syllabus_description=?, programmatic_content=?, educational_resources=?,
        evaluation_criteria=?, evaluation_instruments=?, references_list=?
       WHERE course_id=?`,
      [
        payload.contextualization || null, payload.justification || null, payload.relevance || null,
        payload.generalObjective || null, jsonField(payload.specificObjectives),
        payload.technicalCompetencies || null, payload.pedagogicalCompetencies || null, payload.socioemotionalCompetencies || null,
        payload.syllabusDescription || null, jsonField(payload.programmaticContent), jsonField(payload.educationalResources),
        payload.evaluationCriteria || null, payload.evaluationInstruments || null, payload.referencesList || null,
        courseId,
      ]
    )
  } else {
    await pool.execute(
      `INSERT INTO ementas
       (course_id, contextualization, justification, relevance, general_objective, specific_objectives,
        technical_competencies, pedagogical_competencies, socioemotional_competencies,
        syllabus_description, programmatic_content, educational_resources,
        evaluation_criteria, evaluation_instruments, references_list, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        courseId,
        payload.contextualization || null, payload.justification || null, payload.relevance || null,
        payload.generalObjective || null, jsonField(payload.specificObjectives),
        payload.technicalCompetencies || null, payload.pedagogicalCompetencies || null, payload.socioemotionalCompetencies || null,
        payload.syllabusDescription || null, jsonField(payload.programmaticContent), jsonField(payload.educationalResources),
        payload.evaluationCriteria || null, payload.evaluationInstruments || null, payload.referencesList || null,
        userId,
      ]
    )
  }
  return getEmentaByCourseId(courseId)
}

async function getAllEmentas() {
  if (!isMysqlMode()) {
    return ementas_data.map((e) => ({
      courseId: e.courseId,
      professorStatus: e.professorStatus,
      supervisorStatus: e.supervisorStatus,
      coordinatorStatus: e.coordinatorStatus,
    }))
  }
  const [rows] = await pool.execute(
    'SELECT course_id, professor_status, supervisor_status, coordinator_status FROM ementas'
  )
  return rows.map((r) => ({
    courseId: r.course_id,
    professorStatus: r.professor_status || 'rascunho',
    supervisorStatus: r.supervisor_status || 'pendente',
    coordinatorStatus: r.coordinator_status || 'pendente',
  }))
}

async function updateEmentaStatus(courseId, updates) {
  if (!isMysqlMode()) {
    const idx = ementas_data.findIndex((e) => e.courseId === Number(courseId))
    if (idx === -1) return null
    ementas_data[idx] = { ...ementas_data[idx], ...updates }
    return ementas_data[idx]
  }

  const fields = []
  const values = []
  if (updates.professorStatus !== undefined) { fields.push('professor_status = ?'); values.push(updates.professorStatus) }
  if (updates.supervisorStatus !== undefined) { fields.push('supervisor_status = ?'); values.push(updates.supervisorStatus) }
  if (updates.coordinatorStatus !== undefined) { fields.push('coordinator_status = ?'); values.push(updates.coordinatorStatus) }
  if (!fields.length) return getEmentaByCourseId(courseId)

  values.push(courseId)
  await pool.execute(`UPDATE ementas SET ${fields.join(', ')} WHERE course_id = ?`, values)
  return getEmentaByCourseId(courseId)
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

async function getAllEmentas() {
  if (!isMysqlMode()) {
    return ementas_data.map((e) => ({
      courseId: e.courseId,
      professorStatus: e.professorStatus,
      supervisorStatus: e.supervisorStatus,
      coordinatorStatus: e.coordinatorStatus,
    }))
  }

  const [rows] = await pool.execute(
    'SELECT course_id, professor_status, supervisor_status, coordinator_status FROM ementas'
  )
  return rows.map((r) => ({
    courseId: r.course_id,
    professorStatus: r.professor_status,
    supervisorStatus: r.supervisor_status,
    coordinatorStatus: r.coordinator_status,
  }))
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
  getCourseByName,
  createCourse,
  updateCourse,
  deleteCourse,
  listCourseParticipants,
  listMaterialAssignees,
  listMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  approveMaterial,
  deleteMaterial,
  listModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
  countMaterialsByModule,
  deleteMaterialsByModule,
  getModuleApprovalSummary,
  listModuleEvents,
  createModuleEvent,
  getAllEmentas,
  getEmentaByCourseId,
  saveEmenta,
  updateEmentaStatus,
  listPeople,
  updateAttendance,
  listOccurrences,
  createOccurrence,
  updateOccurrence,
  listNotifications,
  markNotificationRead,
}
