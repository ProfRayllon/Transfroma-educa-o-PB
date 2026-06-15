const bcrypt = require('bcryptjs')

const hash = (p) => bcrypt.hashSync(p, 10)

const users = [
  { id: 1, name: 'Juliana Santos', email: 'admin@transforma.pb.gov.br', passwordHash: hash('admin123'), registration: 'ADM-001', role: 'administrador', function: 'Administrador', status: 'ativo', lastAccess: '2026-06-08T08:30:00', createdAt: '2025-01-10' },
  { id: 2, name: 'Marcos Lima', email: 'marcos.lima@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'SUP-001', role: 'supervisor', function: 'Supervisor', status: 'ativo', lastAccess: '2026-06-08T08:10:00', createdAt: '2025-01-10' },
  { id: 3, name: 'Ana Moura', email: 'ana.moura@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'PRO-001', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-07T16:45:00', createdAt: '2025-01-15' },
  { id: 4, name: 'João Teixeira', email: 'joao.teixeira@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'PRO-002', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-07T14:20:00', createdAt: '2025-01-15' },
  { id: 5, name: 'Luana Pereira', email: 'luana.pereira@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'PRO-003', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-06T11:30:00', createdAt: '2025-01-20' },
  { id: 6, name: 'Rafael Oliveira', email: 'rafael.oliveira@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'PRO-004', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-08T08:23:00', createdAt: '2025-01-20' },
  { id: 7, name: 'Camila Nunes', email: 'camila.nunes@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'TUT-001', role: 'tutor', function: 'Tutor', status: 'ativo', lastAccess: '2026-06-07T17:00:00', createdAt: '2025-02-01' },
  { id: 8, name: 'Lucas Ferreira', email: 'lucas.ferreira@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'TEC-001', role: 'tecnico', function: 'Técnico', status: 'ativo', lastAccess: '2026-06-08T07:45:00', createdAt: '2025-02-01' },
  { id: 9, name: 'Beatriz Costa', email: 'beatriz.costa@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'TUT-002', role: 'tutor', function: 'Tutor', status: 'ativo', lastAccess: '2026-06-05T15:30:00', createdAt: '2025-02-01' },
  { id: 10, name: 'Ana Carolina', email: 'ana.carolina@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'TEC-002', role: 'tecnico', function: 'Técnico', status: 'ativo', lastAccess: '2026-06-08T08:05:00', createdAt: '2025-02-05' },
  { id: 11, name: 'Carlos Mendes', email: 'carlos.mendes@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'GP-001', role: 'gestao', function: 'Gestão de Pessoas', status: 'ativo', lastAccess: '2026-06-07T09:00:00', createdAt: '2025-02-10' },
  { id: 12, name: 'Fernanda Rocha', email: 'fernanda.rocha@transforma.pb.gov.br', passwordHash: hash('pass123'), registration: 'PRO-005', role: 'professor', function: 'Professor/Produtor', status: 'ativo', lastAccess: '2026-06-06T16:00:00', createdAt: '2025-02-15' },
]

const materials = [
  { id: 1, course: 'Língua Portuguesa – 8º Ano', session: 1, theme: 'Leitura e compreensão textual', objective: 'Compreender a estrutura do texto e identificar ideias principais.', type: 'Aula', duration: '50 min', responsibleId: 3, responsibleName: 'Ana Moura', responsibleRole: 'Professora', status: 'concluido', deliveryDate: '2025-05-06', originalFile: 'Aula_01_Leitura.docx', originalFileSize: '128 KB', adjustedFile: 'Aula_01_Leitura_rev.docx', adjustedFileSize: '132 KB', reviewStatus: 'aprovado', reviewNotes: '' },
  { id: 2, course: 'Língua Portuguesa – 8º Ano', session: 2, theme: 'Gêneros textuais no dia a dia', objective: 'Identificar diferentes gêneros textuais e suas finalidades.', type: 'Atividade', duration: '40 min', responsibleId: 4, responsibleName: 'João Teixeira', responsibleRole: 'Professor', status: 'em_producao', deliveryDate: '2025-05-08', originalFile: 'Atividade_02.docx', originalFileSize: '96 KB', adjustedFile: null, adjustedFileSize: null, reviewStatus: 'pendente', reviewNotes: '' },
  { id: 3, course: 'Língua Portuguesa – 8º Ano', session: 3, theme: 'Produção de texto dissertativo', objective: 'Planejar e produzir texto dissertativo com coerência.', type: 'Aula', duration: '60 min', responsibleId: 3, responsibleName: 'Ana Moura', responsibleRole: 'Professora', status: 'concluido', deliveryDate: '2025-05-12', originalFile: 'Aula_03_Producao.docx', originalFileSize: '144 KB', adjustedFile: 'Aula_03_Producao_rev.docx', adjustedFileSize: '148 KB', reviewStatus: 'aprovado', reviewNotes: '' },
  { id: 4, course: 'Língua Portuguesa – 8º Ano', session: 4, theme: 'Coesão e coerência textual', objective: 'Aplicar conectivos e recursos de coesão em textos.', type: 'Atividade', duration: '45 min', responsibleId: 5, responsibleName: 'Luana Pereira', responsibleRole: 'Professora', status: 'em_revisao', deliveryDate: '2025-05-13', originalFile: 'Atividade_04.docx', originalFileSize: '101 KB', adjustedFile: 'Atividade_04_rev.docx', adjustedFileSize: '105 KB', reviewStatus: 'em_revisao', reviewNotes: 'Revisar exemplos da seção 2.' },
  { id: 5, course: 'Língua Portuguesa – 8º Ano', session: 5, theme: 'Revisão e reescrita textual', objective: 'Revisar e reescrever textos aprimorando argumentos.', type: 'Aula', duration: '50 min', responsibleId: 4, responsibleName: 'João Teixeira', responsibleRole: 'Professor', status: 'em_producao', deliveryDate: null, originalFile: 'Aula_05_Rascunho.docx', originalFileSize: '87 KB', adjustedFile: null, adjustedFileSize: null, reviewStatus: 'pendente', reviewNotes: '' },
  { id: 6, course: 'Língua Portuguesa – 8º Ano', session: 6, theme: 'Interpretação de textos literários', objective: 'Interpretar e analisar textos literários clássicos brasileiros.', type: 'Aula', duration: '55 min', responsibleId: 6, responsibleName: 'Rafael Oliveira', responsibleRole: 'Professor/Produtor', status: 'concluido', deliveryDate: '2025-05-15', originalFile: 'Aula_06_Literatura.docx', originalFileSize: '156 KB', adjustedFile: 'Aula_06_Literatura_rev.docx', adjustedFileSize: '161 KB', reviewStatus: 'aprovado', reviewNotes: '' },
  { id: 7, course: 'Língua Portuguesa – 8º Ano', session: 7, theme: 'Variação linguística', objective: 'Compreender as diferentes variações da língua portuguesa.', type: 'Atividade', duration: '40 min', responsibleId: 12, responsibleName: 'Fernanda Rocha', responsibleRole: 'Professora', status: 'em_revisao', deliveryDate: '2025-05-18', originalFile: 'Atividade_07.docx', originalFileSize: '92 KB', adjustedFile: 'Atividade_07_rev.docx', adjustedFileSize: '95 KB', reviewStatus: 'ajuste_solicitado', reviewNotes: 'Adicionar mais exemplos regionais.' },
  { id: 8, course: 'Língua Portuguesa – 8º Ano', session: 8, theme: 'Pontuação e ortografia', objective: 'Aplicar corretamente as regras de pontuação e ortografia.', type: 'Atividade', duration: '45 min', responsibleId: 5, responsibleName: 'Luana Pereira', responsibleRole: 'Professora', status: 'concluido', deliveryDate: '2025-05-20', originalFile: 'Atividade_08.docx', originalFileSize: '88 KB', adjustedFile: 'Atividade_08_rev.docx', adjustedFileSize: '90 KB', reviewStatus: 'aprovado', reviewNotes: '' },
]

const people = [
  { id: 1, userId: 6, name: 'Rafael Oliveira', function: 'Professor/Produtor', supervisorId: 1, supervisorName: 'Juliana Santos', attendanceStatus: 'registrada', attendanceTime: '08:23', completedActivities: 92, openOccurrences: 0, status: 'ativo' },
  { id: 2, userId: 7, name: 'Camila Nunes', function: 'Tutor', supervisorId: 1, supervisorName: 'Juliana Santos', attendanceStatus: 'pendente', attendanceTime: null, completedActivities: 65, openOccurrences: 1, status: 'ativo' },
  { id: 3, userId: 8, name: 'Lucas Ferreira', function: 'Técnico', supervisorId: 2, supervisorName: 'Marcos Lima', attendanceStatus: 'registrada', attendanceTime: '07:45', completedActivities: 88, openOccurrences: 0, status: 'ativo' },
  { id: 4, userId: 9, name: 'Beatriz Costa', function: 'Tutor', supervisorId: 1, supervisorName: 'Juliana Santos', attendanceStatus: 'pendente', attendanceTime: null, completedActivities: 40, openOccurrences: 1, status: 'ativo' },
  { id: 5, userId: 2, name: 'Marcos Lima', function: 'Supervisor', supervisorId: null, supervisorName: '—', attendanceStatus: 'registrada', attendanceTime: '08:10', completedActivities: 100, openOccurrences: 0, status: 'ativo' },
  { id: 6, userId: 10, name: 'Ana Carolina', function: 'Técnico', supervisorId: 2, supervisorName: 'Marcos Lima', attendanceStatus: 'registrada', attendanceTime: '08:05', completedActivities: 71, openOccurrences: 1, status: 'ativo' },
]

const occurrences = [
  { id: 1, userId: 7, userName: 'Camila Nunes', type: 'Falta injustificada', description: 'Profissional não compareceu sem justificativa prévia.', severity: 'media', status: 'em_analise', createdBy: 'Juliana Santos', resolvedBy: null, createdAt: '2026-06-03' },
  { id: 2, userId: 9, userName: 'Beatriz Costa', type: 'Atraso recorrente', description: 'Registrado terceiro atraso no mês sem justificativa.', severity: 'baixa', status: 'aberta', createdBy: 'Marcos Lima', resolvedBy: null, createdAt: '2026-06-05' },
  { id: 3, userId: 10, userName: 'Ana Carolina', type: 'Entrega atrasada', description: 'Material técnico entregue com 3 dias de atraso.', severity: 'baixa', status: 'resolvida', createdBy: 'Marcos Lima', resolvedBy: 'Marcos Lima', createdAt: '2026-05-28' },
]

const notifications = [
  { id: 1, userId: 1, title: 'Material aprovado', message: 'O material "Leitura e compreensão textual" foi aprovado com sucesso.', type: 'success', readAt: null, createdAt: '2026-06-08T07:30:00' },
  { id: 2, userId: 1, title: 'Ajuste solicitado', message: 'Revisão solicitada no material da Sessão 7.', type: 'warning', readAt: null, createdAt: '2026-06-08T06:15:00' },
  { id: 3, userId: 1, title: 'Frequência pendente', message: '5 profissionais com frequência pendente hoje.', type: 'info', readAt: null, createdAt: '2026-06-08T08:00:00' },
]

module.exports = { users, materials, people, occurrences, notifications }
