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
  { id: 1, name: 'Juliana Santos', email: 'admin@transforma.pb.gov.br', registration: 'ADM-001', role: 'administrador', function: 'Administrador', status: 'ativo', lastAccess: '2026-06-08T08:30:00', createdAt: '2025-01-10' },
  { id: 2, name: 'Marcos Lima', email: 'marcos.lima@transforma.pb.gov.br', registration: 'SUP-001', role: 'supervisor', function: 'Supervisor', status: 'ativo', lastAccess: '2026-06-08T08:10:00', createdAt: '2025-01-10' },
  { id: 3, name: 'Ana Moura', email: 'ana.moura@transforma.pb.gov.br', registration: 'PRO-001', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-07T16:45:00', createdAt: '2025-01-15' },
  { id: 4, name: 'Joao Teixeira', email: 'joao.teixeira@transforma.pb.gov.br', registration: 'PRO-002', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-07T14:20:00', createdAt: '2025-01-15' },
  { id: 5, name: 'Camila Nunes', email: 'camila.nunes@transforma.pb.gov.br', registration: 'TUT-001', role: 'tutor', function: 'Tutor', status: 'ativo', lastAccess: '2026-06-07T17:00:00', createdAt: '2025-02-01' },
  { id: 6, name: 'Lucas Ferreira', email: 'lucas.ferreira@transforma.pb.gov.br', registration: 'TEC-001', role: 'tecnico', function: 'Tecnico', status: 'ativo', lastAccess: '2026-06-08T07:45:00', createdAt: '2025-02-01' },
  { id: 7, name: 'Carlos Mendes', email: 'carlos.mendes@transforma.pb.gov.br', registration: 'GP-001', role: 'gestao', function: 'Gestao de Pessoas', status: 'ativo', lastAccess: '2026-06-07T09:00:00', createdAt: '2025-02-10' },
].map(withPassword)

const materials = [
  {
    id: 1,
    course: 'Lingua Portuguesa - 8 Ano',
    session: 1,
    theme: 'Leitura e compreensao textual',
    objective: 'Compreender a estrutura do texto e identificar ideias principais.',
    type: 'Aula',
    duration: '50 min',
    responsibleId: 3,
    responsibleName: 'Ana Moura',
    responsibleRole: 'Professora',
    status: 'concluido',
    deliveryDate: '2025-05-06',
    originalLink: 'https://docs.google.com/document/d/mock-aula-01-original',
    adjustedLink: 'https://docs.google.com/document/d/mock-aula-01-ajustado',
    reviewStatus: 'aprovado',
    reviewNotes: '',
    createdAt: '2025-04-20',
  },
  {
    id: 2,
    course: 'Lingua Portuguesa - 8 Ano',
    session: 2,
    theme: 'Generos textuais no dia a dia',
    objective: 'Identificar diferentes generos textuais e suas finalidades.',
    type: 'Atividade',
    duration: '40 min',
    responsibleId: 4,
    responsibleName: 'Joao Teixeira',
    responsibleRole: 'Professor',
    status: 'em_producao',
    deliveryDate: '2025-05-08',
    originalLink: 'https://docs.google.com/document/d/mock-ativ-02-original',
    adjustedLink: null,
    reviewStatus: 'pendente',
    reviewNotes: '',
    createdAt: '2025-04-22',
  },
]

const people = []

const occurrences = [
  { id: 1, userId: 4, userName: 'Joao Teixeira', type: 'Entrega atrasada', description: 'Material entregue com atraso de 2 dias.', severity: 'baixa', status: 'em_analise', createdBy: 'Juliana Santos', resolvedBy: null, createdAt: '2026-06-03' },
  { id: 2, userId: 5, userName: 'Camila Nunes', type: 'Falta injustificada', description: 'Profissional nao compareceu sem justificativa previa.', severity: 'media', status: 'aberta', createdBy: 'Marcos Lima', resolvedBy: null, createdAt: '2026-06-05' },
]

const notifications = [
  { id: 1, userId: 1, title: 'Material aprovado', message: 'O material da sessao 1 foi aprovado com sucesso.', type: 'success', readAt: null, createdAt: '2026-06-08T07:30:00' },
  { id: 2, userId: 2, title: 'Frequencia pendente', message: 'Existem registros pendentes para hoje.', type: 'warning', readAt: null, createdAt: '2026-06-08T08:00:00' },
  { id: 3, userId: 3, title: 'Ajuste solicitado', message: 'Revise o material da sessao 2 antes de reenviar.', type: 'info', readAt: null, createdAt: '2026-06-08T09:15:00' },
]

module.exports = { users, materials, people, occurrences, notifications }
