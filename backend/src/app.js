require('dotenv').config()

const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const store = require('./data/store')

const app = express()

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET nao configurado. Defina a variavel no arquivo .env antes de iniciar o backend.')
}

const COURSE_TRAILS = {
  'TRILHAS TRANSVERSAIS': [
    'Educacao Socioemocional',
    'Educacao, Ciencia e Tecnologia',
    'Gestao Pedagogica',
    'Inclusao, Diversidade e Equidade',
  ],
  'TRILHAS DA FORMACAO GERAL BASICA': [
    'Area de Linguagens',
    'Area de Ciencias Humanas',
    'Area de Matematica e Ciencias da Natureza',
  ],
}

const USER_ROLES = ['administrador', 'coordenador', 'supervisor', 'professor', 'tutor', 'tecnico', 'gestao']
const USER_STATUSES = ['ativo', 'inativo', 'pendente', 'desligado', 'substituido']

app.use(cors({ origin: corsOrigins }))
app.use(express.json({ limit: '5mb' }))

function sanitizeUser(user) {
  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

async function findUserById(userId) {
  return store.getUserById(userId)
}

function isManager(role) {
  return ['administrador', 'supervisor'].includes(role)
}

function isCoordinator(user) {
  return user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')
}

function canManageCourses(user) {
  return user?.role === 'administrador' || user?.role === 'supervisor' || isCoordinator(user)
}

function canManageProduction(user) {
  return ['administrador', 'supervisor', 'professor'].includes(user?.role) || isCoordinator(user)
}

function canAssignMaterial(user) {
  return ['administrador', 'supervisor'].includes(user?.role) || isCoordinator(user)
}

function isAttendanceManager(role) {
  return ['administrador', 'supervisor', 'gestao'].includes(role)
}

async function canEditMaterial(user, material) {
  if (!material) return false
  if (user.role === 'administrador') return true
  const course = await store.getCourseByName(material.course)
  if (user.role === 'supervisor') {
    return course?.supervisorId === user.id || course?.supervisorName === user.name
  }
  if (isCoordinator(user)) {
    return course?.coordinatorId === user.id || course?.coordinatorName === user.name
  }
  return user.role === 'professor' && material.responsibleId === user.id
}

async function coursePayload(body) {
  const payload = {
    name: String(body.name || '').trim(),
    primaryTrail: String(body.primaryTrail || '').trim(),
    trail: String(body.trail || '').trim(),
    totalSessions: Number(body.totalSessions) || 0,
    supervisorId: Number(body.supervisorId) || null,
    supervisorName: String(body.supervisorName || '').trim(),
    coordinatorId: Number(body.coordinatorId) || null,
    coordinatorName: String(body.coordinatorName || '').trim(),
    producerIds: Array.isArray(body.producerIds) ? body.producerIds.map(Number).filter(Boolean) : [],
    startDate: body.startDate || null,
    deadline: body.deadline || null,
    image: body.image || null,
  }

  const missing = []
  if (!payload.name) missing.push('nome')
  if (!payload.primaryTrail) missing.push('trilha principal')
  if (!payload.trail) missing.push('trilha secundaria')
  if (!payload.supervisorId) missing.push('supervisor')
  if (!payload.coordinatorId) missing.push('coordenador')
  if (payload.producerIds.length === 0) missing.push('professores/produtores')
  if (payload.totalSessions <= 0) missing.push('carga horaria total')

  if (missing.length > 0) {
    return { error: `Preencha os campos obrigatorios: ${missing.join(', ')}.` }
  }

  if (!COURSE_TRAILS[payload.primaryTrail]) {
    return { error: 'Trilha principal invalida.' }
  }

  if (!COURSE_TRAILS[payload.primaryTrail].includes(payload.trail)) {
    return { error: 'Trilha secundaria invalida para a trilha principal selecionada.' }
  }

  const supervisor = await store.getUserById(payload.supervisorId)
  if (!supervisor || !['supervisor', 'administrador'].includes(supervisor.role)) {
    return { error: 'Supervisor invalido.' }
  }

  const coordinator = await store.getUserById(payload.coordinatorId)
  if (!coordinator || !(coordinator.role === 'administrador' || isCoordinator(coordinator))) {
    return { error: 'Coordenador invalido.' }
  }

  payload.supervisorName = supervisor.name
  payload.coordinatorName = coordinator.name
  payload.producerIds = [...new Set(payload.producerIds)]
  payload.producers = []

  for (const producerId of payload.producerIds) {
    const producer = await store.getUserById(producerId)
    if (!producer || producer.role !== 'professor') {
      return { error: 'Professor/produtor invalido.' }
    }
    payload.producers.push(sanitizeUser(producer))
  }

  return { payload }
}

function avatarPayload(body) {
  const avatar = body.avatar || null

  if (avatar !== null && typeof avatar !== 'string') {
    return { error: 'Foto invalida.' }
  }

  if (avatar && !avatar.startsWith('data:image/')) {
    return { error: 'Envie uma imagem valida.' }
  }

  if (avatar && Buffer.byteLength(avatar, 'utf8') > 4 * 1024 * 1024) {
    return { error: 'A foto deve ter no maximo 4 MB.' }
  }

  return { avatar }
}

function userPayload(body, { requirePassword = false } = {}) {
  const payload = {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    registration: String(body.registration || '').trim() || null,
    role: String(body.role || '').trim(),
    function: String(body.function || '').trim() || null,
    status: String(body.status || 'ativo').trim(),
    password: body.password ? String(body.password) : '',
  }

  const missing = []
  if (!payload.name) missing.push('nome')
  if (!payload.email) missing.push('e-mail')
  if (!payload.role) missing.push('perfil')

  if (missing.length > 0) {
    return { error: `Preencha os campos obrigatorios: ${missing.join(', ')}.` }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return { error: 'Informe um e-mail valido.' }
  }

  if (!USER_ROLES.includes(payload.role)) {
    return { error: 'Perfil de acesso invalido.' }
  }

  if (!USER_STATUSES.includes(payload.status)) {
    return { error: 'Status invalido.' }
  }

  if (payload.registration && payload.registration.length > 30) {
    return { error: 'A matricula deve ter no maximo 30 caracteres.' }
  }

  if (payload.function && payload.function.length > 100) {
    return { error: 'A funcao deve ter no maximo 100 caracteres.' }
  }

  if (requirePassword && payload.password.length < 8) {
    return { error: 'A senha inicial deve ter pelo menos 8 caracteres.' }
  }

  if (!requirePassword && payload.password && payload.password.length < 8) {
    return { error: 'A nova senha deve ter pelo menos 8 caracteres.' }
  }

  if (!payload.password) {
    delete payload.password
  }

  return { payload }
}

function mysqlUserErrorMessage(error) {
  if (error.code === 'ER_DUP_ENTRY') return 'Ja existe um usuario com esse e-mail.'
  if (error.code === 'ER_DATA_TOO_LONG') return 'Um dos campos ultrapassou o tamanho permitido.'
  if (error.code === 'WARN_DATA_TRUNCATED') return 'Um dos campos possui valor invalido.'
  return 'Erro ao salvar usuario.'
}

async function materialPayload(body, actor, currentMaterial) {
  const payload = {
    course: body.course,
    session: body.session,
    theme: body.theme,
    objective: body.objective,
    type: body.type,
    duration: body.duration,
    deliveryDate: body.deliveryDate,
    originalLink: body.originalLink,
    adjustedLink: body.adjustedLink,
  }

  if (canAssignMaterial(actor)) {
    payload.status = body.status || currentMaterial?.status || 'em_execucao'
    payload.reviewStatus = body.reviewStatus || currentMaterial?.reviewStatus || 'em_execucao'
    payload.reviewNotes = body.reviewNotes ?? currentMaterial?.reviewNotes ?? ''
    payload.responsibleId = Number(body.responsibleId) || currentMaterial?.responsibleId

    if (payload.responsibleId) {
      const responsible = await findUserById(payload.responsibleId)
      payload.responsibleName = responsible?.name || body.responsibleName || currentMaterial?.responsibleName || ''
      payload.responsibleRole = responsible?.function || body.responsibleRole || currentMaterial?.responsibleRole || ''
    }

    return payload
  }

  payload.status = currentMaterial?.status || 'em_producao'
  payload.reviewStatus = currentMaterial?.reviewStatus || 'em_execucao'
  payload.reviewNotes = currentMaterial?.reviewNotes || ''
  payload.responsibleId = actor.id

  const actorUser = await findUserById(actor.id)
  payload.responsibleName = actorUser?.name || currentMaterial?.responsibleName || ''
  payload.responsibleRole = actorUser?.function || currentMaterial?.responsibleRole || ''

  return payload
}

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token nao fornecido.' })
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Token invalido ou expirado.' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado.' })
    }
    next()
  }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await store.getUserByEmail(email || '')
    if (!user) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: sanitizeUser(user) })
  } catch {
    res.status(500).json({ message: 'Erro interno do servidor.' })
  }
})

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await store.getUserById(req.user.id)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' })
  res.json(sanitizeUser(user))
})

app.patch('/api/auth/me/avatar', auth, async (req, res) => {
  const { avatar, error } = avatarPayload(req.body)
  if (error) return res.status(400).json({ message: error })

  try {
    const user = await store.updateUser(req.user.id, { avatar })
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' })
    res.json(sanitizeUser(user))
  } catch {
    res.status(500).json({ message: 'Erro ao salvar foto.' })
  }
})

app.get('/api/users', auth, requireRole('administrador', 'supervisor'), async (req, res) => {
  const users = await store.listUsers()
  res.json(users.map(sanitizeUser))
})

app.post('/api/users', auth, requireRole('administrador'), async (req, res) => {
  const { payload, error } = userPayload(req.body, { requirePassword: true })
  if (error) return res.status(400).json({ message: error })

  try {
    const existing = await store.getUserByEmail(payload.email)
    if (existing) {
      return res.status(409).json({ message: 'Ja existe um usuario com esse e-mail.' })
    }

    const user = await store.createUser(payload)
    res.status(201).json(sanitizeUser(user))
  } catch (err) {
    res.status(500).json({ message: mysqlUserErrorMessage(err) })
  }
})

app.put('/api/users/:id', auth, requireRole('administrador'), async (req, res) => {
  try {
    const current = await store.getUserById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Usuario nao encontrado.' })

    const { payload, error } = userPayload(req.body)
    if (error) return res.status(400).json({ message: error })

    if (payload.email && payload.email.toLowerCase() !== current.email.toLowerCase()) {
      const existing = await store.getUserByEmail(payload.email)
      if (existing) {
        return res.status(409).json({ message: 'Ja existe um usuario com esse e-mail.' })
      }
    }

    const user = await store.updateUser(req.params.id, payload)
    res.json(sanitizeUser(user))
  } catch (err) {
    res.status(500).json({ message: mysqlUserErrorMessage(err) })
  }
})

app.delete('/api/users/:id', auth, requireRole('administrador'), async (req, res) => {
  const deleted = await store.deleteUser(req.params.id)
  if (!deleted) return res.status(404).json({ message: 'Usuario nao encontrado.' })
  res.status(204).end()
})

app.get('/api/courses', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const courses = await store.listCourses(actor)
    res.json(courses)
  } catch {
    res.status(500).json({ message: 'Erro ao carregar cursos.' })
  }
})

app.get('/api/course-participants', auth, async (req, res) => {
  try {
    const participants = await store.listCourseParticipants()
    res.json(participants)
  } catch {
    res.status(500).json({ message: 'Erro ao carregar supervisores e coordenadores.' })
  }
})

app.get('/api/material-assignees', auth, async (req, res) => {
  try {
    const assignees = await store.listMaterialAssignees()
    res.json(assignees)
  } catch {
    res.status(500).json({ message: 'Erro ao carregar responsaveis por atividades.' })
  }
})

app.post('/api/courses', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageCourses(actor)) return res.status(403).json({ message: 'Apenas administradores, coordenadores e supervisores podem criar cursos.' })

  const { payload, error } = await coursePayload(req.body)
  if (error) return res.status(400).json({ message: error })

  try {
    const course = await store.createCourse(payload)
    res.status(201).json(course)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ja existe um curso com esse nome.' })
    }
    res.status(500).json({ message: 'Erro ao criar curso.' })
  }
})

app.put('/api/courses/:id', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageCourses(actor)) return res.status(403).json({ message: 'Apenas administradores, coordenadores e supervisores podem editar cursos.' })

  const current = await store.getCourseById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Curso nao encontrado.' })

  if (
    actor.role !== 'administrador'
    && current.coordinatorId !== actor.id
    && current.coordinatorName !== actor.name
    && current.supervisorId !== actor.id
    && current.supervisorName !== actor.name
  ) {
    return res.status(403).json({ message: 'Voce so pode editar cursos cadastrados para voce.' })
  }

  const { payload, error } = await coursePayload(req.body)
  if (error) return res.status(400).json({ message: error })

  try {
    const course = await store.updateCourse(req.params.id, payload)
    res.json(course)
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Ja existe um curso com esse nome.' })
    }
    res.status(500).json({ message: 'Erro ao atualizar curso.' })
  }
})

app.delete('/api/courses/:id', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageCourses(actor)) return res.status(403).json({ message: 'Apenas administradores, coordenadores e supervisores podem excluir cursos.' })

  try {
    const current = await store.getCourseById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Curso nao encontrado.' })
    if (
      actor.role !== 'administrador'
      && current.coordinatorId !== actor.id
      && current.coordinatorName !== actor.name
      && current.supervisorId !== actor.id
      && current.supervisorName !== actor.name
    ) {
      return res.status(403).json({ message: 'Voce so pode excluir cursos cadastrados para voce.' })
    }

    const deleted = await store.deleteCourse(req.params.id)
    if (!deleted) return res.status(404).json({ message: 'Curso nao encontrado.' })
    res.status(204).end()
  } catch {
    res.status(500).json({ message: 'Erro ao excluir curso.' })
  }
})

app.get('/api/materials', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  const materials = await store.listMaterials(actor)
  res.json(materials)
})

app.post('/api/materials', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageProduction(actor)) return res.status(403).json({ message: 'Voce nao tem permissao para criar atividades.' })

  const payload = await materialPayload(req.body, actor)
  const material = await store.createMaterial({
    ...payload,
    createdAt: new Date().toISOString().split('T')[0],
  })
  res.status(201).json(material)
})

app.put('/api/materials/:id', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageProduction(actor)) return res.status(403).json({ message: 'Voce nao tem permissao para editar atividades.' })

  const current = await store.getMaterialById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!(await canEditMaterial(actor, current))) {
    return res.status(403).json({ message: 'Voce nao tem permissao para editar este material.' })
  }

  const payload = await materialPayload(req.body, actor, current)
  const material = await store.updateMaterial(req.params.id, payload)
  res.json(material)
})

app.patch('/api/materials/:id/approve', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canAssignMaterial(actor)) return res.status(403).json({ message: 'Voce nao tem permissao para aprovar atividades.' })

  const current = await store.getMaterialById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!(await canEditMaterial(actor, current))) {
    return res.status(403).json({ message: 'Voce nao tem permissao para aprovar este material.' })
  }

  const material = await store.approveMaterial(req.params.id)
  if (!material) return res.status(404).json({ message: 'Material nao encontrado.' })
  res.json(material)
})

app.get('/api/people', auth, async (req, res) => {
  const people = await store.listPeople(req.user)
  res.json(people)
})

app.put('/api/people/:id/attendance', auth, requireRole('administrador', 'supervisor', 'gestao'), async (req, res) => {
  const person = await store.updateAttendance(req.params.id, req.body)
  if (!person) return res.status(404).json({ message: 'Registro nao encontrado.' })
  res.json(person)
})

app.get('/api/occurrences', auth, async (req, res) => {
  const occurrences = await store.listOccurrences(req.user)
  res.json(occurrences)
})

app.post('/api/occurrences', auth, requireRole('administrador', 'supervisor'), async (req, res) => {
  const occurrence = await store.createOccurrence({
    ...req.body,
    status: 'aberta',
    createdBy: req.user.id,
    resolvedBy: null,
    createdAt: new Date().toISOString().split('T')[0],
  })
  res.status(201).json(occurrence)
})

app.put('/api/occurrences/:id', auth, requireRole('administrador', 'supervisor'), async (req, res) => {
  const occurrence = await store.updateOccurrence(req.params.id, req.body)
  if (!occurrence) return res.status(404).json({ message: 'Ocorrencia nao encontrada.' })
  res.json(occurrence)
})

app.get('/api/notifications', auth, async (req, res) => {
  const notifications = await store.listNotifications(req.user.id)
  res.json(notifications)
})

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  const notification = await store.markNotificationRead(req.params.id, req.user.id)
  if (!notification) {
    return res.status(403).json({ message: 'Voce nao pode alterar notificacoes de outro usuario.' })
  }
  res.json(notification)
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'Transforma Educacao PB 2026', dataMode: store.DATA_MODE, timestamp: new Date().toISOString() })
})

module.exports = app
