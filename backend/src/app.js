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

function isModuleProducer(user, course) {
  return user?.role === 'professor' && course?.producers?.some((p) => Number(p.id) === Number(user.id))
}

function isModuleSupervisor(user, module, course) {
  if (user?.role !== 'supervisor') return false
  if (module) return module.supervisorId === user.id || module.supervisorName === user.name
  return course?.supervisorId === user.id || course?.supervisorName === user.name
}

function isModuleCoordinator(user, module, course) {
  if (!isCoordinator(user)) return false
  if (module) return module.coordinatorId === user.id || module.coordinatorName === user.name
  return course?.coordinatorId === user.id || course?.coordinatorName === user.name
}

function canManageModule(user, course) {
  return user?.role === 'administrador'
    || isModuleSupervisor(user, null, course)
    || isModuleCoordinator(user, null, course)
    || isModuleProducer(user, course)
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
  const course = material.courseId
    ? await store.getCourseById(material.courseId) || await store.getCourseByName(material.course)
    : await store.getCourseByName(material.course)
  if (user.role === 'supervisor') {
    return course?.supervisorId === user.id || course?.supervisorName === user.name
  }
  if (isCoordinator(user)) {
    return course?.coordinatorId === user.id || course?.coordinatorName === user.name
  }
  return user.role === 'professor' && (
    material.responsibleId === user.id ||
    material.responsibles?.some(r => Number(r.id) === Number(user.id))
  )
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
    area: String(body.area || '').trim() || null,
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

  if (payload.area && payload.area.length > 150) {
    return { error: 'A area deve ter no maximo 150 caracteres.' }
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

function normalizeOptionalEnum(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return value
}

function normalizeMaterialType(value, currentValue) {
  if (Array.isArray(value)) {
    return value[0] || null
  }
  if (value === undefined) return currentValue ?? null
  if (value === null || value === '') return null
  return value
}

async function materialPayload(body, actor, currentMaterial) {
  const requestedCourseId = Number(body.courseId) || currentMaterial?.courseId || null
  const requestedCourseName = String(body.course || currentMaterial?.course || '').trim()
  const course = requestedCourseId
    ? await store.getCourseById(requestedCourseId) || await store.getCourseByName(requestedCourseName)
    : await store.getCourseByName(requestedCourseName)

  if (!course) {
    return { error: 'Curso invalido.' }
  }

  const moduleIdProvided = Object.prototype.hasOwnProperty.call(body, 'moduleId')
  let moduleId = moduleIdProvided
    ? (body.moduleId ? Number(body.moduleId) : null)
    : (currentMaterial?.moduleId ?? null)
  let legacyModule = Number(body.module) || currentMaterial?.module || 1

  if (moduleId) {
    const courseModule = await store.getModuleById(moduleId)
    if (!courseModule || Number(courseModule.courseId) !== Number(course.id)) {
      return { error: 'Modulo invalido para este curso.' }
    }
    legacyModule = courseModule.order || legacyModule
  }

  const payload = {
    course: course.name,
    courseId: course.id,
    session: body.session || currentMaterial?.session,
    module: legacyModule,
    moduleId,
    theme: body.theme ?? currentMaterial?.theme ?? '',
    objective: body.objective ?? currentMaterial?.objective ?? '',
    type: normalizeMaterialType(body.type, currentMaterial?.type),
    duration: body.duration ?? currentMaterial?.duration ?? '',
    deliveryDate: body.deliveryDate ?? currentMaterial?.deliveryDate ?? null,
    originalLink: body.originalLink ?? currentMaterial?.originalLink ?? '',
    adjustedLink: body.adjustedLink ?? currentMaterial?.adjustedLink ?? '',
  }

  if (canAssignMaterial(actor)) {
    payload.status = normalizeOptionalEnum(body.status)
    if (payload.status === undefined) payload.status = currentMaterial?.status ?? null
    payload.reviewStatus = body.reviewStatus || currentMaterial?.reviewStatus || 'em_execucao'
    payload.supervisorStatus = normalizeOptionalEnum(body.supervisorStatus)
    if (payload.supervisorStatus === undefined) payload.supervisorStatus = currentMaterial?.supervisorStatus ?? null
    payload.coordinatorStatus = normalizeOptionalEnum(body.coordinatorStatus)
    if (payload.coordinatorStatus === undefined) payload.coordinatorStatus = currentMaterial?.coordinatorStatus ?? null
    payload.reviewNotes = body.reviewNotes ?? currentMaterial?.reviewNotes ?? ''
    payload.responsibleId = Number(body.responsibleId) || currentMaterial?.responsibleId

    if (payload.responsibleId) {
      const responsible = await findUserById(payload.responsibleId)
      payload.responsibleName = responsible?.name || body.responsibleName || currentMaterial?.responsibleName || ''
      payload.responsibleRole = responsible?.function || body.responsibleRole || currentMaterial?.responsibleRole || ''
    }

    if (Array.isArray(body.responsibles) && body.responsibles.length > 0) {
      payload.responsibles = body.responsibles
    } else {
      payload.responsibles = currentMaterial?.responsibles || null
    }

    return { payload }
  }

  payload.status = currentMaterial?.status ?? null
  payload.reviewStatus = currentMaterial?.reviewStatus || 'em_execucao'
  payload.supervisorStatus = currentMaterial?.supervisorStatus ?? null
  payload.coordinatorStatus = currentMaterial?.coordinatorStatus ?? null
  payload.reviewNotes = currentMaterial?.reviewNotes || ''
  payload.responsibleId = currentMaterial?.responsibleId || actor.id

  const actorUser = await findUserById(actor.id)
  payload.responsibleName = currentMaterial?.responsibleName || actorUser?.name || ''
  payload.responsibleRole = currentMaterial?.responsibleRole || actorUser?.function || ''
  payload.responsibles = currentMaterial?.responsibles?.length
    ? currentMaterial.responsibles
    : [{ id: payload.responsibleId, name: payload.responsibleName, role: payload.responsibleRole }]

  return { payload }
}

async function modulePayload(body, course, currentModule) {
  const payload = {
    courseId: course.id,
    title: String(body.title ?? currentModule?.title ?? '').trim(),
    description: body.description ?? currentModule?.description ?? '',
    workload: body.workload ?? currentModule?.workload ?? '',
    order: Number(body.order) || currentModule?.order || 1,
    teacherId: Object.prototype.hasOwnProperty.call(body, 'teacherId')
      ? (body.teacherId ? Number(body.teacherId) : null)
      : (currentModule?.teacherId ?? null),
    supervisorId: Object.prototype.hasOwnProperty.call(body, 'supervisorId')
      ? (body.supervisorId ? Number(body.supervisorId) : null)
      : (currentModule?.supervisorId ?? course.supervisorId ?? null),
    coordinatorId: Object.prototype.hasOwnProperty.call(body, 'coordinatorId')
      ? (body.coordinatorId ? Number(body.coordinatorId) : null)
      : (currentModule?.coordinatorId ?? course.coordinatorId ?? null),
    deadline: body.deadline ?? currentModule?.deadline ?? null,
    stage: currentModule?.stage || 'producao',
    professorStatus: currentModule?.professorStatus || 'rascunho',
    supervisorStatus: currentModule?.supervisorStatus || 'aguardando',
    coordinatorStatus: currentModule?.coordinatorStatus || 'pendente',
  }

  if (!payload.title) {
    return { error: 'Informe o titulo do modulo.' }
  }

  if (payload.teacherId) {
    const teacher = await findUserById(payload.teacherId)
    if (!teacher || teacher.role !== 'professor') return { error: 'Professor conteudista invalido.' }
    payload.teacherName = teacher.name
  } else {
    payload.teacherName = null
  }

  if (payload.supervisorId) {
    const supervisor = await findUserById(payload.supervisorId)
    if (!supervisor || !['supervisor', 'administrador'].includes(supervisor.role)) return { error: 'Supervisor invalido.' }
    payload.supervisorName = supervisor.name
  } else {
    payload.supervisorName = null
  }

  if (payload.coordinatorId) {
    const coordinator = await findUserById(payload.coordinatorId)
    if (!coordinator || !(coordinator.role === 'administrador' || isCoordinator(coordinator))) return { error: 'Coordenador(a) invalido.' }
    payload.coordinatorName = coordinator.name
  } else {
    payload.coordinatorName = null
  }

  return { payload }
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

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Informe um e-mail valido.' })
  }

  // Senhas sao salvas com hash; por seguranca, a recuperacao exige redefinicao por um administrador.
  await store.getUserByEmail(email)
  res.json({
    message: 'Se o e-mail estiver cadastrado, solicite a redefinicao de senha a um administrador do sistema.',
  })
})

app.get('/api/auth/me', auth, async (req, res) => {
  const user = await store.getUserById(req.user.id)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' })
  res.json(sanitizeUser(user))
})

app.patch('/api/auth/me/password', auth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '')
  const newPassword = String(req.body.newPassword || '')

  if (!currentPassword) {
    return res.status(400).json({ message: 'Informe a senha atual.' })
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 8 caracteres.' })
  }

  const user = await store.getUserById(req.user.id)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return res.status(401).json({ message: 'Senha atual incorreta.' })

  const updated = await store.updateUser(user.id, { password: newPassword })
  res.json(sanitizeUser(updated))
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

app.patch('/api/users/:id/password', auth, requireRole('administrador'), async (req, res) => {
  const password = String(req.body.password || '')

  if (password.length < 8) {
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 8 caracteres.' })
  }

  const current = await store.getUserById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Usuario nao encontrado.' })

  const user = await store.updateUser(req.params.id, { password })
  res.json(sanitizeUser(user))
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

  const { payload, error } = await materialPayload(req.body, actor)
  if (error) return res.status(400).json({ message: error })
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

  const { payload, error } = await materialPayload(req.body, actor, current)
  if (error) return res.status(400).json({ message: error })
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

app.patch('/api/materials/:id/status', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canManageProduction(actor)) return res.status(403).json({ message: 'Sem permissao para alterar status.' })

  const current = await store.getMaterialById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!(await canEditMaterial(actor, current))) {
    return res.status(403).json({ message: 'Voce nao tem permissao para editar este material.' })
  }

  const update = { ...current }
  const isAdmin = actor.role === 'administrador'
  // Admin e coordenacao podem sempre alterar qualquer status de qualquer perfil,
  // sem passar pelo gate sequencial (que continua valendo para supervisor comum).
  const isPrivileged = isAdmin || isCoordinator(actor)
  const isSupervisor = isPrivileged || actor.role === 'supervisor'
  const isCoord = isPrivileged
  const isProfessor = isPrivileged || actor.role === 'professor'
  let professorStatusChangedDirectly = false

  if (current.moduleId) {
    // Conteudo vinculado a um modulo: cada papel só mexe no proprio campo,
    // com o mesmo gate sequencial usado entre supervisor e coordenacao
    // (professor conclui -> supervisor aprova -> coordenacao aprova).
    if (isProfessor && Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      update.status = normalizeOptionalEnum(req.body.status)
      professorStatusChangedDirectly = true
    }

    if (isSupervisor && Object.prototype.hasOwnProperty.call(req.body, 'supervisorStatus')) {
      const nextSupStatus = normalizeOptionalEnum(req.body.supervisorStatus)
      if (!isPrivileged && nextSupStatus === 'aprovado' && update.status !== 'concluido') {
        return res.status(400).json({ message: 'O supervisor so pode aprovar conteudos ja concluidos pelo professor.' })
      }
      update.supervisorStatus = nextSupStatus
      if (update.supervisorStatus === 'ajustes') update.status = 'em_ajustes'
    }

    if (isCoord && Object.prototype.hasOwnProperty.call(req.body, 'coordinatorStatus')) {
      const nextCoordStatus = normalizeOptionalEnum(req.body.coordinatorStatus)
      update.coordinatorStatus = nextCoordStatus
      if (nextCoordStatus === 'ajustes' || nextCoordStatus === 'reprovado') {
        update.supervisorStatus = 'aguardando'
        update.status = 'em_ajustes'
      }
    }

    if ((isSupervisor || isCoord) && Object.prototype.hasOwnProperty.call(req.body, 'reviewNotes')) {
      update.reviewNotes = req.body.reviewNotes
    }
  } else if (actor.role === 'professor' && !isAdmin) {
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) update.status = normalizeOptionalEnum(req.body.status)
  } else {
    if (Object.prototype.hasOwnProperty.call(req.body, 'status')) update.status = normalizeOptionalEnum(req.body.status)
    if (req.body.reviewStatus) update.reviewStatus = req.body.reviewStatus

    if (isSupervisor && Object.prototype.hasOwnProperty.call(req.body, 'supervisorStatus')) {
      update.supervisorStatus = normalizeOptionalEnum(req.body.supervisorStatus)
      if (update.supervisorStatus === 'ajustes') update.status = 'em_ajustes'
    }

    if (isCoord && Object.prototype.hasOwnProperty.call(req.body, 'coordinatorStatus')) {
      const nextCoordStatus = normalizeOptionalEnum(req.body.coordinatorStatus)
      if (nextCoordStatus === 'aprovado' && update.supervisorStatus !== 'aprovado') {
        return res.status(400).json({ message: 'A coordenacao so pode aprovar conteudos ja aprovados pelo supervisor.' })
      }
      update.coordinatorStatus = nextCoordStatus
      if (nextCoordStatus === 'ajustes' || nextCoordStatus === 'reprovado') {
        update.supervisorStatus = 'aguardando'
        update.status = 'em_ajustes'
      }
    }

    if ((isSupervisor || isCoord) && Object.prototype.hasOwnProperty.call(req.body, 'reviewNotes')) {
      update.reviewNotes = req.body.reviewNotes
    }
  }

  const material = await store.updateMaterial(req.params.id, update)
  if (!material) return res.status(404).json({ message: 'Material nao encontrado.' })

  if (material.moduleId) {
    const CONTENT_ACTION_BY_STATUS = {
      status: { concluido: 'concluir_conteudo_professor', em_ajustes: 'ajustes_conteudo_professor' },
      supervisorStatus: { aprovado: 'aprovar_conteudo_supervisor', ajustes: 'ajustes_conteudo_supervisor' },
      coordinatorStatus: { aprovado: 'aprovar_conteudo_coordenador', ajustes: 'ajustes_conteudo_coordenador', reprovado: 'reprovar_conteudo_coordenador' },
    }
    const note = String(req.body.reviewNotes || '').trim()

    if (professorStatusChangedDirectly && update.status !== current.status && CONTENT_ACTION_BY_STATUS.status[update.status]) {
      await store.createModuleEvent({
        moduleId: material.moduleId,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: actor.role,
        type: 'history',
        action: CONTENT_ACTION_BY_STATUS.status[update.status],
        message: [material.theme, note].filter(Boolean).join(' — ') || material.theme,
      })
    }

    if (update.supervisorStatus !== current.supervisorStatus && CONTENT_ACTION_BY_STATUS.supervisorStatus[update.supervisorStatus]) {
      await store.createModuleEvent({
        moduleId: material.moduleId,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: actor.role,
        type: 'history',
        action: CONTENT_ACTION_BY_STATUS.supervisorStatus[update.supervisorStatus],
        message: [material.theme, note].filter(Boolean).join(' — ') || material.theme,
      })
    }

    if (update.coordinatorStatus !== current.coordinatorStatus && CONTENT_ACTION_BY_STATUS.coordinatorStatus[update.coordinatorStatus]) {
      await store.createModuleEvent({
        moduleId: material.moduleId,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: actor.role,
        type: 'history',
        action: CONTENT_ACTION_BY_STATUS.coordinatorStatus[update.coordinatorStatus],
        message: [material.theme, note].filter(Boolean).join(' — ') || material.theme,
      })
    }
  }

  res.json(material)
})

app.delete('/api/materials/:id', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  const current = await store.getMaterialById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!(await canEditMaterial(actor, current))) {
    return res.status(403).json({ message: 'Voce nao tem permissao para excluir este material.' })
  }
  const deleted = await store.deleteMaterial(req.params.id)
  if (!deleted) return res.status(404).json({ message: 'Material nao encontrado.' })
  res.json({ id: Number(req.params.id) })
})

app.patch('/api/materials/:id/session', auth, async (req, res) => {
  const actor = await store.getUserById(req.user.id)
  if (!canAssignMaterial(actor)) return res.status(403).json({ message: 'Sem permissao para mover sessoes.' })

  const current = await store.getMaterialById(req.params.id)
  if (!current) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!(await canEditMaterial(actor, current))) {
    return res.status(403).json({ message: 'Voce nao tem permissao para editar este material.' })
  }

  const session = Number(req.body.session)
  if (!session || session < 1) return res.status(400).json({ message: 'Numero de sessao invalido.' })

  const material = await store.updateMaterial(req.params.id, { ...current, session })
  if (!material) return res.status(404).json({ message: 'Material nao encontrado.' })
  res.json(material)
})

app.get('/api/courses/:courseId/modules', auth, async (req, res) => {
  try {
    const course = await store.getCourseById(req.params.courseId)
    if (!course) return res.status(404).json({ message: 'Curso nao encontrado.' })
    const modules = await store.listModules(course.id)
    res.json(modules)
  } catch (err) {
    console.error('[GET /api/courses/:courseId/modules]', err)
    res.status(500).json({ message: 'Erro ao carregar modulos.' })
  }
})

app.post('/api/courses/:courseId/modules', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const course = await store.getCourseById(req.params.courseId)
    if (!course) return res.status(404).json({ message: 'Curso nao encontrado.' })
    if (!canManageModule(actor, course)) return res.status(403).json({ message: 'Voce nao tem permissao para criar modulos neste curso.' })

    const { payload, error } = await modulePayload(req.body, course)
    if (error) return res.status(400).json({ message: error })

    const existing = await store.listModules(course.id)
    const module = await store.createModule({ ...payload, order: existing.length + 1, createdBy: actor.id })
    res.status(201).json(module)
  } catch (err) {
    console.error('[POST /api/courses/:courseId/modules]', err)
    res.status(500).json({ message: 'Erro ao criar modulo.' })
  }
})

app.put('/api/modules/:id', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const current = await store.getModuleById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    const course = await store.getCourseById(current.courseId)
    if (!canManageModule(actor, course)) return res.status(403).json({ message: 'Voce nao tem permissao para editar este modulo.' })
    if (actor.role !== 'administrador' && current.stage !== 'producao') {
      return res.status(400).json({ message: 'O modulo so pode ser editado enquanto estiver em producao.' })
    }

    const { payload, error } = await modulePayload(req.body, course, current)
    if (error) return res.status(400).json({ message: error })

    if (payload.stage === 'producao' && payload.professorStatus === 'rascunho') {
      payload.professorStatus = 'em_producao'
    }

    const module = await store.updateModule(current.id, { ...current, ...payload })
    res.json(module)
  } catch (err) {
    console.error('[PUT /api/modules/:id]', err)
    res.status(500).json({ message: 'Erro ao atualizar modulo.' })
  }
})

app.patch('/api/modules/:id/order', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const current = await store.getModuleById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    const course = await store.getCourseById(current.courseId)
    if (!canManageModule(actor, course)) return res.status(403).json({ message: 'Sem permissao para reordenar modulos.' })

    const order = Number(req.body.order)
    if (!order || order < 1) return res.status(400).json({ message: 'Ordem invalida.' })

    const module = await store.updateModule(current.id, { ...current, order })
    res.json(module)
  } catch (err) {
    console.error('[PATCH /api/modules/:id/order]', err)
    res.status(500).json({ message: 'Erro ao reordenar modulo.' })
  }
})

app.patch('/api/modules/:id/status', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const current = await store.getModuleById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    const course = await store.getCourseById(current.courseId)

    const action = String(req.body.action || '')
    const note = String(req.body.note || '').trim()

    const isAdmin = actor.role === 'administrador'
    const isProducer = isModuleProducer(actor, course)
    const isCoord = isAdmin || isModuleCoordinator(actor, current, course)

    let update = null

    switch (action) {
      case 'enviar_supervisao': {
        if (!(isAdmin || isProducer)) return res.status(403).json({ message: 'Apenas o professor responsavel pode enviar o modulo para supervisao.' })
        if (current.stage !== 'producao') return res.status(400).json({ message: 'O modulo nao esta em producao.' })
        const summary = await store.getModuleApprovalSummary(current.id)
        if (summary.total === 0 || summary.professorConcluded < summary.total) {
          return res.status(400).json({ message: 'Conclua todos os conteudos do modulo antes de enviar para supervisao.' })
        }
        update = { stage: 'supervisao', professorStatus: 'concluido' }
        break
      }
      case 'publicar': {
        if (!isCoord) return res.status(403).json({ message: 'Apenas a coordenacao do modulo pode publicar.' })
        if (current.stage !== 'supervisao') {
          return res.status(400).json({ message: 'O modulo precisa ter sido enviado para supervisao antes de publicar.' })
        }
        const summary = await store.getModuleApprovalSummary(current.id)
        if (summary.total === 0 || summary.coordinatorApproved < summary.total) {
          return res.status(400).json({ message: 'Todos os conteudos do modulo precisam estar aprovados pela coordenacao antes de publicar.' })
        }
        update = { stage: 'publicado' }
        break
      }
      default:
        return res.status(400).json({ message: 'Acao invalida.' })
    }

    const module = await store.updateModule(current.id, { ...current, ...update })
    await store.createModuleEvent({
      moduleId: current.id,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      type: 'history',
      action,
      message: note || null,
    })
    const events = await store.listModuleEvents(current.id)
    res.json({ ...module, events })
  } catch (err) {
    console.error('[PATCH /api/modules/:id/status]', err)
    res.status(500).json({ message: 'Erro ao atualizar status do modulo.' })
  }
})

app.post('/api/modules/:id/comments', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const current = await store.getModuleById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    const course = await store.getCourseById(current.courseId)

    if (actor.role !== 'administrador' && !canManageModule(actor, course)) {
      return res.status(403).json({ message: 'Voce nao tem permissao para comentar neste modulo.' })
    }

    const message = String(req.body.message || '').trim()
    if (!message) return res.status(400).json({ message: 'Escreva um comentario.' })

    const event = await store.createModuleEvent({
      moduleId: current.id,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      type: 'comment',
      action: null,
      message,
    })
    res.status(201).json(event)
  } catch (err) {
    console.error('[POST /api/modules/:id/comments]', err)
    res.status(500).json({ message: 'Erro ao adicionar comentario.' })
  }
})

app.delete('/api/modules/:id', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const current = await store.getModuleById(req.params.id)
    if (!current) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    const course = await store.getCourseById(current.courseId)
    // Exclusao de modulo e restrita ao supervisor do curso (admin sempre pode).
    const canDelete = actor.role === 'administrador' || isModuleSupervisor(actor, current, course)
    if (!canDelete) return res.status(403).json({ message: 'Apenas o supervisor do curso pode excluir modulos.' })
    if (actor.role !== 'administrador' && current.stage !== 'producao') {
      return res.status(400).json({ message: 'So e possivel excluir modulos que ainda estao em producao.' })
    }

    // Excluir o modulo leva junto todos os conteudos vinculados (o frontend avisa isso antes de confirmar).
    await store.deleteMaterialsByModule(current.id)
    const deleted = await store.deleteModule(current.id)
    if (!deleted) return res.status(404).json({ message: 'Modulo nao encontrado.' })
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /api/modules/:id]', err)
    res.status(500).json({ message: 'Erro ao excluir modulo.' })
  }
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

app.get('/api/ementas', auth, async (req, res) => {
  try {
    res.json(await store.getAllEmentas())
  } catch (err) {
    console.error('[GET /api/ementas]', err)
    res.status(500).json({ message: 'Erro ao carregar ementas.' })
  }
})

app.get('/api/ementas/:courseId', auth, async (req, res) => {
  try {
    const ementa = await store.getEmentaByCourseId(req.params.courseId)
    if (!ementa) return res.status(404).json({ message: 'Ementa nao encontrada.' })
    res.json(ementa)
  } catch (err) {
    console.error('[GET /api/ementas/:courseId]', err)
    res.status(500).json({ message: 'Erro ao carregar ementa.' })
  }
})

app.put('/api/ementas/:courseId', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const course = await store.getCourseById(req.params.courseId)
    if (!course) return res.status(404).json({ message: 'Curso nao encontrado.' })

    const isCoord = isCoordinator(actor)
    const isProducer = course.producers?.some((p) => Number(p.id) === Number(actor.id))
    const isSup = actor.role === 'supervisor' && (course.supervisorId === actor.id || course.supervisorName === actor.name)
    const isCoord2 = isCoord && (course.coordinatorId === actor.id || course.coordinatorName === actor.name)

    if (actor.role !== 'administrador' && !isProducer && !isSup && !isCoord2) {
      return res.status(403).json({ message: 'Voce nao tem permissao para editar esta ementa.' })
    }

    const ementa = await store.saveEmenta(req.params.courseId, req.body, actor.id)
    res.json(ementa)
  } catch (err) {
    console.error('[PUT /api/ementas/:courseId]', err)
    res.status(500).json({ message: 'Erro ao salvar ementa.' })
  }
})

app.patch('/api/ementas/:courseId/status', auth, async (req, res) => {
  try {
    const actor = await store.getUserById(req.user.id)
    const course = await store.getCourseById(req.params.courseId)
    if (!course) return res.status(404).json({ message: 'Curso nao encontrado.' })

    const ementa = await store.getEmentaByCourseId(req.params.courseId)
    if (!ementa) return res.status(404).json({ message: 'Ementa nao encontrada.' })

    const isCoord = isCoordinator(actor)
    // Admin e coordenacao do curso podem sempre alterar qualquer status (professor/supervisor/
    // coordenador), mesma regra aplicada em materials (PATCH /api/materials/:id/status).
    const isPrivileged = actor.role === 'administrador' || (isCoord && (course.coordinatorId === actor.id || course.coordinatorName === actor.name))
    const update = {}

    if (req.body.professorStatus) {
      const isProducer = course.producers?.some((p) => Number(p.id) === Number(actor.id))
      if (!isPrivileged && !isProducer) return res.status(403).json({ message: 'Apenas produtores do curso podem submeter a ementa.' })
      update.professorStatus = req.body.professorStatus
    }
    if (req.body.supervisorStatus) {
      const isCourseSupervisor = actor.role === 'supervisor' && (course.supervisorId === actor.id || course.supervisorName === actor.name)
      if (!isPrivileged && !isCourseSupervisor) return res.status(403).json({ message: 'Apenas o supervisor do curso pode validar.' })
      update.supervisorStatus = req.body.supervisorStatus
    }
    if (req.body.coordinatorStatus) {
      if (!isPrivileged) return res.status(403).json({ message: 'Apenas o coordenador do curso pode aprovar.' })
      update.coordinatorStatus = req.body.coordinatorStatus
    }

    const updated = await store.updateEmentaStatus(req.params.courseId, update)
    if (!updated) return res.status(404).json({ message: 'Ementa nao encontrada.' })
    res.json(updated)
  } catch (err) {
    console.error('[PATCH /api/ementas/:courseId/status]', err)
    res.status(500).json({ message: 'Erro ao atualizar status da ementa.' })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'Transforma Educacao PB 2026', dataMode: store.DATA_MODE, timestamp: new Date().toISOString() })
})

module.exports = app
