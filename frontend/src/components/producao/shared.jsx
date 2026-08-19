import { useState } from 'react'
import {
  FileText, ExternalLink, Link2, Video, Presentation, ClipboardList,
  Paperclip, MousePointerClick, Award, ListChecks, HelpCircle, BookOpen, File,
  MessageSquare, Podcast, Copy, Check,
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

export const REVISOR_STATUS_OPTIONS = [
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
  { value: 'forum', label: 'Fórum' },
  { value: 'podcast', label: 'Podcast' },
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
  forum: MessageSquare,
  podcast: Podcast,
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
  const documentTypes = ['videoaula', 'apresentacao', 'ebook', 'pdf', 'podcast', 'Aula']
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

// Versao compacta do LinkChip: so o icone clicavel, usada nas colunas Link e Link final
// da tabela de producao para nao consumir largura com o dominio.
export function LinkIconOnly({ url, label = 'Link' }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>
  const isHttp = url.startsWith('http')
  let hint = url
  if (isHttp) {
    try { hint = new URL(url).hostname.replace('www.', '') } catch {}
  }
  const content = (
    <>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
        isHttp ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-100' : 'bg-gray-100 text-gray-400'
      }`}>
        {isHttp ? <ExternalLink size={13} /> : <Link2 size={13} />}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg max-w-xs truncate">
          <span className="font-medium">{label}:</span> {hint}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </>
  )

  if (!isHttp) return <div className="relative group inline-flex">{content}</div>

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="relative group inline-flex" onClick={e => e.stopPropagation()}>
      {content}
    </a>
  )
}

export async function copyToClipboard(text) {
  const value = String(text ?? '')
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    // Fallback para navegadores/contextos sem Clipboard API.
    try {
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

export function CopyButton({ value, title = 'Copiar', className = '' }) {
  const [copied, setCopied] = useState(false)
  const disabled = !value

  const handleCopy = async () => {
    if (disabled) return
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      title={disabled ? 'Nada para copiar' : title}
      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed ${
        copied ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-brand-700 hover:bg-brand-50'
      } ${className}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

// Linha "rotulo + valor + copiar" do modal de publicacao no AVA (TI).
export function CopyField({ label, value, mono = false, full = false }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      <div className="flex items-start gap-1 bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-1 py-1.5">
        <span className={`flex-1 text-sm text-gray-800 break-words min-w-0 ${mono ? 'font-mono text-xs' : ''}`}>
          {display}
        </span>
        <CopyButton value={value} title={`Copiar ${label.toLowerCase()}`} />
      </div>
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
