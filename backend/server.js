require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET nao configurado. Defina a variavel no arquivo .env antes de iniciar o backend.')
}

app.use(cors({ origin: corsOrigins }))
app.use(express.json())

const { users, materials, people, occurrences, notifications } = require('./src/data/mockData')

function sanitizeUser(user) {
  const { passwordHash: _, ...safeUser } = user
  return safeUser
}

function findUserById(userId) {
  return users.find((user) => user.id === Number(userId))
}

function isManager(role) {
  return ['administrador', 'supervisor'].includes(role)
}

function isAttendanceManager(role) {
  return ['administrador', 'supervisor', 'gestao'].includes(role)
}

function canEditMaterial(user, material) {
  if (!material) return false
  if (isManager(user.role)) return true
  return user.role === 'professor' && material.responsibleId === user.id
}

function materialPayload(body, actor, currentMaterial) {
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

  if (isManager(actor.role)) {
    payload.status = body.status || currentMaterial?.status || 'pendente'
    payload.reviewStatus = body.reviewStatus || currentMaterial?.reviewStatus || 'pendente'
    payload.reviewNotes = body.reviewNotes ?? currentMaterial?.reviewNotes ?? ''
    payload.responsibleId = Number(body.responsibleId) || currentMaterial?.responsibleId

    if (payload.responsibleId) {
      const responsible = findUserById(payload.responsibleId)
      payload.responsibleName = responsible?.name || body.responsibleName || currentMaterial?.responsibleName || ''
      payload.responsibleRole = responsible?.function || body.responsibleRole || currentMaterial?.responsibleRole || ''
    }

    return payload
  }

  payload.status = currentMaterial?.status || 'em_producao'
  payload.reviewStatus = currentMaterial?.reviewStatus || 'pendente'
  payload.reviewNotes = currentMaterial?.reviewNotes || ''
  payload.responsibleId = actor.id

  const actorUser = findUserById(actor.id)
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
    const user = users.find((entry) => entry.email.toLowerCase() === email?.toLowerCase())
    if (!user) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    res.json({ token, user: sanitizeUser(user) })
  } catch {
    res.status(500).json({ message: 'Erro interno do servidor.' })
  }
})

app.get('/api/auth/me', auth, (req, res) => {
  const user = users.find((entry) => entry.id === req.user.id)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' })
  res.json(sanitizeUser(user))
})

app.get('/api/users', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  res.json(users.map(sanitizeUser))
})

app.post('/api/users', auth, requireRole('administrador'), async (req, res) => {
  const { password, ...rest } = req.body

  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'A senha inicial deve ter pelo menos 8 caracteres.' })
  }

  if (users.some((user) => user.email.toLowerCase() === String(rest.email || '').toLowerCase())) {
    return res.status(409).json({ message: 'Ja existe um usuario com esse e-mail.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const newUser = {
    id: Date.now(),
    ...rest,
    passwordHash,
    createdAt: new Date().toISOString().split('T')[0],
    lastAccess: null,
  }

  users.push(newUser)
  res.status(201).json(sanitizeUser(newUser))
})

app.put('/api/users/:id', auth, requireRole('administrador'), async (req, res) => {
  const idx = users.findIndex((user) => user.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Usuario nao encontrado.' })

  const { password, passwordHash, id, ...updates } = req.body

  if (updates.email && users.some((user) => user.id !== users[idx].id && user.email.toLowerCase() === String(updates.email).toLowerCase())) {
    return res.status(409).json({ message: 'Ja existe um usuario com esse e-mail.' })
  }

  users[idx] = { ...users[idx], ...updates }

  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 8 caracteres.' })
    }

    users[idx].passwordHash = await bcrypt.hash(password, 10)
  }

  res.json(sanitizeUser(users[idx]))
})

app.delete('/api/users/:id', auth, requireRole('administrador'), (req, res) => {
  const idx = users.findIndex((user) => user.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Usuario nao encontrado.' })
  users.splice(idx, 1)
  res.status(204).end()
})

app.get('/api/materials', auth, (req, res) => {
  if (req.user.role === 'professor') {
    return res.json(materials.filter((material) => material.responsibleId === req.user.id))
  }

  res.json(materials)
})

app.post('/api/materials', auth, requireRole('administrador', 'supervisor', 'professor'), (req, res) => {
  const material = {
    id: Date.now(),
    ...materialPayload(req.body, req.user),
    createdAt: new Date().toISOString().split('T')[0],
  }

  materials.push(material)
  res.status(201).json(material)
})

app.put('/api/materials/:id', auth, requireRole('administrador', 'supervisor', 'professor'), (req, res) => {
  const idx = materials.findIndex((material) => material.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Material nao encontrado.' })
  if (!canEditMaterial(req.user, materials[idx])) {
    return res.status(403).json({ message: 'Voce nao tem permissao para editar este material.' })
  }

  materials[idx] = {
    ...materials[idx],
    ...materialPayload(req.body, req.user, materials[idx]),
  }

  res.json(materials[idx])
})

app.patch('/api/materials/:id/approve', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const idx = materials.findIndex((material) => material.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Material nao encontrado.' })
  materials[idx] = { ...materials[idx], status: 'aprovado', reviewStatus: 'aprovado' }
  res.json(materials[idx])
})

app.get('/api/people', auth, (req, res) => {
  if (isAttendanceManager(req.user.role)) {
    return res.json(people)
  }

  res.json(people.filter((person) => person.userId === req.user.id))
})

app.put('/api/people/:id/attendance', auth, requireRole('administrador', 'supervisor', 'gestao'), (req, res) => {
  const idx = people.findIndex((person) => person.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Registro nao encontrado.' })
  people[idx] = { ...people[idx], ...req.body }
  res.json(people[idx])
})

app.get('/api/occurrences', auth, (req, res) => {
  if (isAttendanceManager(req.user.role)) {
    return res.json(occurrences)
  }

  res.json(occurrences.filter((occurrence) => occurrence.userId === req.user.id))
})

app.post('/api/occurrences', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const occurrence = {
    id: Date.now(),
    ...req.body,
    status: 'aberta',
    createdBy: req.user.id,
    resolvedBy: null,
    createdAt: new Date().toISOString().split('T')[0],
  }

  occurrences.push(occurrence)
  res.status(201).json(occurrence)
})

app.put('/api/occurrences/:id', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const idx = occurrences.findIndex((occurrence) => occurrence.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Ocorrencia nao encontrada.' })
  occurrences[idx] = { ...occurrences[idx], ...req.body }
  res.json(occurrences[idx])
})

app.get('/api/notifications', auth, (req, res) => {
  res.json(notifications.filter((notification) => notification.userId === req.user.id))
})

app.patch('/api/notifications/:id/read', auth, (req, res) => {
  const idx = notifications.findIndex((notification) => notification.id === Number(req.params.id))
  if (idx === -1) return res.status(404).end()
  if (notifications[idx].userId !== req.user.id) {
    return res.status(403).json({ message: 'Voce nao pode alterar notificacoes de outro usuario.' })
  }

  notifications[idx].readAt = new Date().toISOString()
  res.json(notifications[idx])
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'Transforma Educacao PB 2026', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`\nTransforma API rodando em http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health\n`)
})
