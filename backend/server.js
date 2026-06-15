require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'transforma_secret_dev'

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }))
app.use(express.json())

// In-memory data (replace with MySQL queries in production)
const { users, materials, people, occurrences, notifications } = require('./src/data/mockData')

// ── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido.' })
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado.' })
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

// ── Auth routes ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = users.find(u => u.email.toLowerCase() === email?.toLowerCase())
    if (!user) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ message: 'E-mail ou senha incorretos.' })

    const { passwordHash: _, ...safeUser } = user
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' })

    res.json({ token, user: safeUser })
  } catch (err) {
    res.status(500).json({ message: 'Erro interno do servidor.' })
  }
})

app.get('/api/auth/me', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' })
  const { passwordHash: _, ...safeUser } = user
  res.json(safeUser)
})

// ── Users routes ─────────────────────────────────────────────────────────────
app.get('/api/users', auth, (req, res) => {
  const list = users.map(({ passwordHash: _, ...u }) => u)
  res.json(list)
})

app.post('/api/users', auth, requireRole('administrador'), async (req, res) => {
  const { password, ...rest } = req.body
  const passwordHash = await bcrypt.hash(password || 'temp123', 10)
  const newUser = { id: Date.now(), ...rest, passwordHash, createdAt: new Date().toISOString().split('T')[0] }
  users.push(newUser)
  const { passwordHash: _, ...safe } = newUser
  res.status(201).json(safe)
})

app.put('/api/users/:id', auth, requireRole('administrador'), (req, res) => {
  const idx = users.findIndex(u => u.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Usuário não encontrado.' })
  users[idx] = { ...users[idx], ...req.body }
  const { passwordHash: _, ...safe } = users[idx]
  res.json(safe)
})

app.delete('/api/users/:id', auth, requireRole('administrador'), (req, res) => {
  const idx = users.findIndex(u => u.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Usuário não encontrado.' })
  users.splice(idx, 1)
  res.status(204).end()
})

// ── Materials routes ──────────────────────────────────────────────────────────
app.get('/api/materials', auth, (req, res) => {
  res.json(materials)
})

app.post('/api/materials', auth, (req, res) => {
  const mat = { id: Date.now(), ...req.body, createdAt: new Date().toISOString().split('T')[0] }
  materials.push(mat)
  res.status(201).json(mat)
})

app.put('/api/materials/:id', auth, (req, res) => {
  const idx = materials.findIndex(m => m.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Material não encontrado.' })
  materials[idx] = { ...materials[idx], ...req.body }
  res.json(materials[idx])
})

app.patch('/api/materials/:id/approve', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const idx = materials.findIndex(m => m.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Material não encontrado.' })
  materials[idx] = { ...materials[idx], status: 'aprovado', reviewStatus: 'aprovado' }
  res.json(materials[idx])
})

// ── People routes ─────────────────────────────────────────────────────────────
app.get('/api/people', auth, (req, res) => {
  res.json(people)
})

app.put('/api/people/:id/attendance', auth, (req, res) => {
  const idx = people.findIndex(p => p.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Registro não encontrado.' })
  people[idx] = { ...people[idx], ...req.body }
  res.json(people[idx])
})

// ── Occurrences routes ────────────────────────────────────────────────────────
app.get('/api/occurrences', auth, (req, res) => {
  res.json(occurrences)
})

app.post('/api/occurrences', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const occ = {
    id: Date.now(),
    ...req.body,
    status: 'aberta',
    createdBy: req.user.id,
    resolvedBy: null,
    createdAt: new Date().toISOString().split('T')[0],
  }
  occurrences.push(occ)
  res.status(201).json(occ)
})

app.put('/api/occurrences/:id', auth, requireRole('administrador', 'supervisor'), (req, res) => {
  const idx = occurrences.findIndex(o => o.id === Number(req.params.id))
  if (idx === -1) return res.status(404).json({ message: 'Ocorrência não encontrada.' })
  occurrences[idx] = { ...occurrences[idx], ...req.body }
  res.json(occurrences[idx])
})

// ── Notifications routes ──────────────────────────────────────────────────────
app.get('/api/notifications', auth, (req, res) => {
  const userNotifs = notifications.filter(n => n.userId === req.user.id)
  res.json(userNotifs)
})

app.patch('/api/notifications/:id/read', auth, (req, res) => {
  const idx = notifications.findIndex(n => n.id === Number(req.params.id))
  if (idx === -1) return res.status(404).end()
  notifications[idx].readAt = new Date().toISOString()
  res.json(notifications[idx])
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', system: 'Transforma Educação PB 2026', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Transforma API rodando em http://localhost:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`)
})
