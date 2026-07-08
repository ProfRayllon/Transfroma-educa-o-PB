const variants = {
  concluido: 'bg-green-50 text-green-700 border border-green-200',
  aprovado: 'bg-green-50 text-green-700 border border-green-200',
  ativo: 'bg-green-50 text-green-700 border border-green-200',
  registrada: 'bg-green-50 text-green-700 border border-green-200',
  resolvida: 'bg-green-50 text-green-700 border border-green-200',
  validado: 'bg-green-50 text-green-700 border border-green-200',

  em_producao: 'bg-amber-50 text-amber-700 border border-amber-200',
  em_execucao: 'bg-amber-50 text-amber-700 border border-amber-200',
  pendente: 'bg-amber-50 text-amber-700 border border-amber-200',
  em_analise: 'bg-amber-50 text-amber-700 border border-amber-200',
  edicao: 'bg-amber-50 text-amber-700 border border-amber-200',

  em_revisao: 'bg-purple-50 text-purple-700 border border-purple-200',
  revisao_linguistica: 'bg-purple-50 text-purple-700 border border-purple-200',
  ajuste_solicitado: 'bg-orange-50 text-orange-700 border border-orange-200',
  em_ajustes: 'bg-orange-50 text-orange-700 border border-orange-200',
  justificada: 'bg-blue-50 text-blue-700 border border-blue-200',
  esperando_material: 'bg-blue-50 text-blue-700 border border-blue-200',

  nao_iniciado: 'bg-gray-100 text-gray-600 border border-gray-200',
  nao_validado: 'bg-red-50 text-red-700 border border-red-200',
  validado_com_ajustes: 'bg-amber-50 text-amber-700 border border-amber-200',
  valido: 'bg-green-50 text-green-700 border border-green-200',
  reprovado: 'bg-red-50 text-red-700 border border-red-200',
  aberta: 'bg-red-50 text-red-700 border border-red-200',
  ausente: 'bg-red-50 text-red-700 border border-red-200',
  desligado: 'bg-red-50 text-red-700 border border-red-200',

  rascunho: 'bg-gray-100 text-gray-600 border border-gray-200',
  em_validacao: 'bg-blue-50 text-blue-700 border border-blue-200',
  aguardando: 'bg-amber-50 text-amber-700 border border-amber-200',
  ajustes: 'bg-orange-50 text-orange-700 border border-orange-200',
  publicado: 'bg-teal-50 text-teal-700 border border-teal-200',

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
  revisor: 'bg-rose-100 text-rose-800 border border-rose-200',
}

const labels = {
  concluido: 'Concluído',
  aprovado: 'Aprovado',
  ativo: 'Ativo',
  registrada: 'Registrada',
  resolvida: 'Resolvida',
  validado: 'Validado',
  em_producao: 'Em produção',
  em_execucao: 'Em execução',
  pendente: 'Pendente',
  em_analise: 'Em análise',
  em_revisao: 'Em revisão',
  revisao_linguistica: 'Revisão linguística',
  ajuste_solicitado: 'Ajuste solicitado',
  em_ajustes: 'Em ajustes',
  edicao: 'Edição',
  esperando_material: 'Esperando material',
  justificada: 'Justificada',
  nao_iniciado: 'Não iniciado',
  nao_validado: 'Não validado',
  validado_com_ajustes: 'Validado c/ ajustes',
  valido: 'Válido',
  reprovado: 'Reprovado',
  aberta: 'Aberta',
  ausente: 'Ausente',
  desligado: 'Desligado',
  inativo: 'Inativo',
  substituido: 'Substituído',
  cancelada: 'Cancelada',
  rascunho: 'Rascunho',
  em_validacao: 'Em validação',
  aguardando: 'Aguardando',
  ajustes: 'Ajustes solicitados',
  publicado: 'Publicado',
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio tecnico',
  gestao: 'Gestão de Pessoas',
  revisor: 'Revisor(a)',
}

const dots = {
  concluido: 'bg-green-500',
  aprovado: 'bg-green-500',
  ativo: 'bg-green-500',
  registrada: 'bg-green-500',
  em_producao: 'bg-amber-500',
  em_execucao: 'bg-amber-500',
  pendente: 'bg-amber-500',
  em_revisao: 'bg-purple-500',
  revisao_linguistica: 'bg-purple-500',
  em_ajustes: 'bg-orange-500',
  edicao: 'bg-amber-500',
  esperando_material: 'bg-blue-500',
  validado: 'bg-green-500',
  nao_iniciado: 'bg-gray-400',
  nao_validado: 'bg-red-500',
  validado_com_ajustes: 'bg-amber-500',
  valido: 'bg-green-500',
  reprovado: 'bg-red-500',
  aberta: 'bg-red-500',
  ausente: 'bg-red-500',
  inativo: 'bg-gray-400',
  rascunho: 'bg-gray-400',
  em_validacao: 'bg-blue-500',
  aguardando: 'bg-amber-500',
  ajustes: 'bg-orange-500',
  publicado: 'bg-teal-500',
}

export default function Badge({ status, showDot = false, className = '' }) {
  if (status === null || status === undefined || status === '') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 ${className}`}>
        —
      </span>
    )
  }

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
