const bcrypt = require('bcryptjs')

const hash = (password) => bcrypt.hashSync(password, 10)

const rolePasswords = {
  administrador: process.env.SEED_ADMIN_PASSWORD,
  supervisor: process.env.SEED_SUPERVISOR_PASSWORD,
  professor: process.env.SEED_PROFESSOR_PASSWORD,
  tutor: process.env.SEED_TUTOR_PASSWORD,
  tecnico: process.env.SEED_TECNICO_PASSWORD,
  gestao: process.env.SEED_GESTAO_PASSWORD,
}

function withPassword(user) {
  const password = rolePasswords[user.role] || process.env.SEED_DEFAULT_PASSWORD

  if (!password) {
    throw new Error(`Seed password ausente para o perfil "${user.role}". Configure as variaveis SEED_* no arquivo .env.`)
  }

  return { ...user, passwordHash: hash(password) }
}

const users = [
  { id: 1, name: 'Juliana Santos', email: 'admin@transforma.pb.gov.br', registration: 'ADM-001', role: 'administrador', function: 'Administrador', area: null, avatar: null, status: 'ativo', lastAccess: '2026-06-08T08:30:00', createdAt: '2025-01-10' },
].map(withPassword)

const courses = []

const materials = []

const modules = []

const moduleEvents = []

const people = []

const occurrences = []

const notifications = []

module.exports = { users, courses, materials, modules, moduleEvents, people, occurrences, notifications }
