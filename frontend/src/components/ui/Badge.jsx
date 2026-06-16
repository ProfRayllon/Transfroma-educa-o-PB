const variants = {
  concluido: 'bg-green-50 text-green-700 border border-green-200',
  aprovado: 'bg-green-50 text-green-700 border border-green-200',
  ativo: 'bg-green-50 text-green-700 border border-green-200',
  registrada: 'bg-green-50 text-green-700 border border-green-200',
  resolvida: 'bg-green-50 text-green-700 border border-green-200',

  em_producao: 'bg-amber-50 text-amber-700 border border-amber-200',
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  em_analise: 'bg-amber-50 text-amber-700 border border-amber-200',

  em_revisao: 'bg-purple-50 text-purple-700 border border-purple-200',
  ajuste_solicitado: 'bg-orange-50 text-orange-700 border border-orange-200',
  justificada: 'bg-blue-50 text-blue-700 border border-blue-200',

  reprovado: 'bg-red-50 text-red-700 border border-red-200',
  aberta: 'bg-red-50 text-red-700 border border-red-200',
  ausente: 'bg-red-50 text-red-700 border border-red-200',
  desligado: 'bg-red-50 text-red-700 border border-red-200',

  inativo: 'bg-gray-100 text-gray-600 border border-gray-200',
  substituido: 'bg-gray-100 text-gray-600 border border-gray-200',
  cancelada: 'bg-gray-100 text-gray-600 border border-gray-200',

  administrador: 'bg-purple-100 text-purple-800 border border-purple-200',
  coordenador: 'bg-violet-100 text-violet-800 border border-violet-200',
  supervisor: 'bg-blue-100 text-blue-800 border border-blue-200',
  professor: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  tutor: 'bg-pink-100 text-pink-800 border border-pink-200',
  tecnico: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  gestao: 'bg-teal-100 text-teal-800 border border-teal-200',
}

const labels = {
  concluido: 'Concluído',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  registrada: 'Registrada',
  resolvida: 'Resolvida',
  em_producao: 'Em produção',
  pendente: 'Pendente',
  em_analise: 'Em análise',
  em_revisao: 'Em revisão',
  ajuste_solicitado: 'Ajuste solicitado',
  justificada: 'Justificada',
  reprovado: 'Reprovado',
  aberta: 'Aberta',
  ausente: 'Ausente',
  desligado: 'Desligado',
  inativo: 'Inativo',
  substituido: 'Substituído',
  cancelada: 'Cancelada',
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor/Produtor',
  tutor: 'Tutor',
  tecnico: 'Técnico',
  gestao: 'Gestão de Pessoas',
}

const dots = {
  concluido: 'bg-green-500',
  aprovado: 'bg-green-500',
  ativo: 'bg-green-500',
  registrada: 'bg-green-500',
  em_producao: 'bg-amber-500',
  pendente: 'bg-amber-500',
  em_revisao: 'bg-purple-500',
  reprovado: 'bg-red-500',
  aberta: 'bg-red-500',
  ausente: 'bg-red-500',
  inativo: 'bg-gray-400',
}

export default function Badge({ status, showDot = false, className = '' }) {
  const cls = variants[status] || 'bg-gray-100 text-gray-600 border border-gray-200'
  const label = labels[status] || status
  const dot = dots[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {showDot && dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  )
}
