import {
  FileText, ExternalLink, Link2, Video, Presentation, ClipboardList,
  Paperclip, MousePointerClick, Award, ListChecks, HelpCircle, BookOpen, File,
} from 'lucide-react'

export const PROFESSOR_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_execucao', label: 'Em execução' },
  { value: 'em_ajustes', label: 'Em ajustes' },
  { value: 'concluido', label: 'Concluído' },
]

export const SUPERVISOR_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'ajustes', label: 'Ajustes' },
]

export const COORDINATOR_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'reprovado', label: 'Reprovado' },
]

export const MATERIAL_TYPE_OPTIONS = [
  { value: 'videoaula', label: 'Videoaula' },
  { value: 'apresentacao', label: 'Apresentação' },
  { value: 'atividade_escrita', label: 'Tarefa' },
  { value: 'material_complementar', label: 'Arquivo' },
  { value: 'atividade_interativa', label: 'Atividade interativa' },
  { value: 'outro', label: 'Outro' },
  { value: 'ebook', label: 'E-book' },
  { value: 'avaliacao_final', label: 'Avaliação final' },
  { value: 'atividade_objetiva', label: 'Quiz' },
  { value: 'pdf', label: 'PDF' },
]

const TYPE_ICONS = {
  videoaula: Video,
  apresentacao: Presentation,
  atividade_escrita: ClipboardList,
  material_complementar: Paperclip,
  atividade_interativa: MousePointerClick,
  outro: HelpCircle,
  ebook: BookOpen,
  avaliacao_final: Award,
  atividade_objetiva: ListChecks,
  pdf: File,
  Aula: Video,
}

export const TYPE_LABELS = Object.fromEntries(MATERIAL_TYPE_OPTIONS.map((option) => [option.value, option.label]))

export function getMaterialResponsibles(material) {
  if (material?.responsibles?.length) return material.responsibles
  if (material?.responsibleName) {
    return [{ id: material.responsibleId, name: material.responsibleName, role: material.responsibleRole }]
  }
  return []
}

export function TypeBadge({ type, iconOnly = false }) {
  const documentTypes = ['videoaula', 'apresentacao', 'ebook', 'pdf', 'Aula']
  const types = Array.isArray(type) ? type.filter(Boolean).slice(0, 1) : (type ? [type] : [])
  if (!types.length) return <span className="text-gray-300 text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {types.map(t => {
        const Icon = TYPE_ICONS[t] || FileText
        const isDoc = documentTypes.includes(t)
        const label = TYPE_LABELS[t] || t

        if (iconOnly) {
          return (
            <div key={t} className="relative group inline-flex">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDoc ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                <Icon size={14} />
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">{label}</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
              </div>
            </div>
          )
        }

        const cls = isDoc
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-orange-50 text-orange-700 border border-orange-200'
        return (
          <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
            <Icon size={10} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

export function LinkChip({ url }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>
  const isHttp = url.startsWith('http')
  if (isHttp) {
    let domain = url
    try { domain = new URL(url).hostname.replace('www.', '') } catch {}
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 min-w-0 group"
      >
        <ExternalLink size={13} className="text-brand-600 flex-shrink-0" />
        <span className="text-xs font-medium text-brand-700 group-hover:text-brand-900 truncate max-w-[120px] group-hover:underline underline-offset-2">
          {domain}
        </span>
      </a>
    )
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Link2 size={13} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 truncate max-w-[120px]">{url}</span>
    </div>
  )
}

export function StackedAvatars({ responsibles, assignees = [] }) {
  if (!responsibles?.length) return <span className="text-gray-300 text-xs">—</span>
  const visible = responsibles.slice(0, 3)
  const extra = responsibles.length - visible.length
  return (
    <div className="flex items-center">
      {visible.map((r, i) => {
        const initials = (r.name || '').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        const avatarUrl = assignees.find(a => Number(a.id) === Number(r.id))?.avatar || r.avatar || null
        return (
          <div key={r.id || i} className={`relative group ${i > 0 ? '-ml-2' : ''}`} style={{ zIndex: visible.length - i }}>
            <div className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs font-semibold flex items-center justify-center border-2 border-white cursor-default select-none overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt={r.name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                <div className="font-medium">{r.name}</div>
                {r.role && <div className="text-gray-300 text-[10px] mt-0.5">{r.role}</div>}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
        )
      })}
      {extra > 0 && (
        <div className="-ml-2 w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center border-2 border-white flex-shrink-0">
          +{extra}
        </div>
      )}
    </div>
  )
}

export function MiniAvatar({ name, roleLabel, avatar }) {
  if (!name) return null
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className="relative group inline-flex flex-shrink-0">
      <div className="w-7 h-7 rounded-full bg-slate-500 text-white text-xs font-semibold flex items-center justify-center cursor-default select-none overflow-hidden">
        {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : initials}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <div className="font-medium">{name}</div>
          {roleLabel && <div className="text-gray-300 text-[10px] mt-0.5">{roleLabel}</div>}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

export function InlineStatusSelect({ value, options, onChange }) {
  const STATUS_COLORS = {
    nao_iniciado: 'text-gray-600 bg-gray-50 border-gray-200',
    em_execucao: 'text-blue-700 bg-blue-50 border-blue-200',
    em_ajustes: 'text-orange-700 bg-orange-50 border-orange-200',
    concluido: 'text-teal-700 bg-teal-50 border-teal-200',
    em_revisao: 'text-purple-700 bg-purple-50 border-purple-200',
    nao_validado: 'text-red-700 bg-red-50 border-red-200',
    validado_com_ajustes: 'text-amber-700 bg-amber-50 border-amber-200',
    valido: 'text-green-700 bg-green-50 border-green-200',
    validado: 'text-green-700 bg-green-50 border-green-200',
    aprovado: 'text-green-700 bg-green-50 border-green-200',
    revisao_linguistica: 'text-purple-700 bg-purple-50 border-purple-200',
    edicao: 'text-amber-700 bg-amber-50 border-amber-200',
    esperando_material: 'text-gray-600 bg-gray-50 border-gray-200',
  }
  const colorCls = STATUS_COLORS[value] || 'text-gray-600 bg-gray-50 border-gray-200'
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`text-xs font-medium px-2 py-0.5 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400 ${colorCls}`}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
