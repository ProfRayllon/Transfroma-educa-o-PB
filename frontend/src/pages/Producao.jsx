import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, CheckCircle, FileText, Clock, Eye, Search, Filter, X, ExternalLink, CheckSquare, ArrowLeft, Link2, Pencil, SlidersHorizontal, GripVertical, Trash2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const PROFESSOR_STATUS_OPTIONS = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_execucao', label: 'Em execução' },
  { value: 'em_ajustes', label: 'Em ajustes' },
  { value: 'concluido', label: 'Concluído' },
]

const SUPERVISOR_STATUS_OPTIONS = [
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'nao_validado', label: 'Não validado' },
  { value: 'validado_com_ajustes', label: 'Validado c/ ajustes' },
  { value: 'valido', label: 'Válido' },
]

const COORDINATOR_STATUS_OPTIONS = [
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'nao_validado', label: 'Não validado' },
  { value: 'validado_com_ajustes', label: 'Validado c/ ajustes' },
  { value: 'valido', label: 'Válido' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  ...PROFESSOR_STATUS_OPTIONS,
]

const MATERIAL_TYPE_OPTIONS = [
  { value: 'videoaula', label: 'Videoaula' },
  { value: 'apresentacao', label: 'Apresentação' },
  { value: 'atividade_escrita', label: 'Atividade escrita' },
  { value: 'material_complementar', label: 'Material complementar' },
  { value: 'atividade_interativa', label: 'Atividade interativa' },
  { value: 'outro', label: 'Outro' },
  { value: 'ebook', label: 'Ebook' },
  { value: 'avaliacao_final', label: 'Avaliação final' },
  { value: 'atividade_objetiva', label: 'Atividade objetiva' },
  { value: 'pdf', label: 'PDF' },
]

const TYPE_LABELS = Object.fromEntries(MATERIAL_TYPE_OPTIONS.map((option) => [option.value, option.label]))

function TypeBadge({ type }) {
  const documentTypes = ['videoaula', 'apresentacao', 'ebook', 'pdf', 'Aula']
  const types = Array.isArray(type) ? type : (type ? [type] : [])
  if (!types.length) return <span className="text-gray-300 text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {types.map(t => {
        const cls = documentTypes.includes(t)
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-orange-50 text-orange-700 border border-orange-200'
        return (
          <span key={t} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
            {documentTypes.includes(t) ? <FileText size={10} /> : <CheckSquare size={10} />}
            {TYPE_LABELS[t] || t}
          </span>
        )
      })}
    </div>
  )
}

function LinkChip({ url }) {
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

function AvatarChip({ name, role }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-700 truncate">{name}</div>
        <div className="text-[10px] text-gray-400">{role}</div>
      </div>
    </div>
  )
}

function AvatarTooltip({ name, role }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  return (
    <div className="relative group inline-flex">
      <div className="w-7 h-7 rounded-full bg-brand-700 text-white text-xs font-semibold flex items-center justify-center cursor-default select-none">
        {initials}
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <div className="font-medium">{name}</div>
          {role && <div className="text-gray-300 text-[10px] mt-0.5">{role}</div>}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
      </div>
    </div>
  )
}

function StackedAvatars({ responsibles, assignees = [] }) {
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

function MiniAvatar({ name, roleLabel, avatar }) {
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

function InlineStatusSelect({ value, options, onChange }) {
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

function ActionButtons({ material, onView, onEdit, onDelete, canEdit }) {
  return (
    <div className="flex items-center gap-0.5">
      <button onClick={() => onView(material)} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
        <Eye size={14} />
      </button>
      {canEdit && (
        <button onClick={() => onEdit(material)} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
          <Pencil size={14} />
        </button>
      )}
      {material.originalLink && (
        <a href={material.originalLink} target="_blank" rel="noopener noreferrer" title="Abrir link original" className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors">
          <ExternalLink size={14} />
        </a>
      )}
      {canEdit && (
        <button onClick={() => onDelete(material)} title="Excluir" className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

function ColumnsToggle({ cols, onChange }) {
  const [open, setOpen] = useState(false)
  const labels = {
    tema: 'Título',
    objetivo: 'Objetivo',
    tempo: 'Tempo',
    dataEntrega: 'Data Entrega',
    linkOriginal: 'Link Original',
    linkAjustado: 'Link Ajustado',
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Colunas visíveis"
        className={`p-1.5 rounded-lg transition-colors ${open ? 'bg-brand-50 text-brand-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
      >
        <SlidersHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">Colunas</p>
            {Object.entries(labels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cols[key]}
                  onChange={() => onChange(key, !cols[key])}
                  className="accent-brand-600 w-3.5 h-3.5"
                />
                <span className="text-xs text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MaterialModal({ material, open, onClose }) {
  if (!material) return null
  return (
    <Modal open={open} onClose={onClose} title={`Sessão ${material.session} — ${material.theme}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Curso</div>
            <div className="text-sm text-gray-800">{material.course}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Tipo</div>
            <TypeBadge type={material.type} />
          </div>
          <div className="col-span-2">
            <div className="text-xs font-medium text-gray-500 mb-1">Objetivo</div>
            <div className="text-sm text-gray-800">{material.objective}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Responsável(is)</div>
            <div className="space-y-1.5">
              {(material.responsibles?.length
                ? material.responsibles
                : material.responsibleName ? [{ name: material.responsibleName, role: material.responsibleRole }] : []
              ).map((r, i) => (
                <AvatarChip key={i} name={r.name} role={r.role} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Tempo estimado</div>
            <div className="text-sm text-gray-800">{material.duration}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Status</div>
            <Badge status={material.status} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Data de entrega</div>
            <div className="text-sm text-gray-800">{material.deliveryDate ? new Date(material.deliveryDate).toLocaleDateString('pt-BR') : '—'}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Link original</div>
            <LinkChip url={material.originalLink} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Link ajustado</div>
            <LinkChip url={material.adjustedLink} />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Status da revisão</div>
            <Badge status={material.reviewStatus} />
          </div>
          {material.reviewNotes && (
            <div className="col-span-2">
              <div className="text-xs font-medium text-gray-500 mb-1">Observações</div>
              <div className="text-sm text-gray-800 bg-amber-50 border border-amber-100 rounded-lg p-3">{material.reviewNotes}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function EditModal({ material, open, onClose, onSave, defaultCourse, canApprove, courses, assignees = [], saving }) {
  const isNew = !material?.id
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState(() => {
    const base = {
      course: defaultCourse && defaultCourse !== 'Todos' ? defaultCourse : '',
      session: '',
      module: 1,
      type: [],
      theme: '',
      objective: '',
      duration: '',
      deliveryDate: '',
      status: 'nao_iniciado',
      supervisorStatus: 'em_revisao',
      coordinatorStatus: 'em_revisao',
      reviewNotes: '',
      responsibleId: '',
      responsibleName: '',
      responsibleRole: '',
      originalLink: '',
      adjustedLink: '',
      ...(material || {}),
    }
    base.type = Array.isArray(base.type) ? base.type : (base.type ? [base.type] : [])
    base.responsibles = material?.responsibles?.length
      ? material.responsibles
      : (material?.responsibleId ? [{ id: material.responsibleId, name: material.responsibleName, role: material.responsibleRole }] : [])
    return base
  })

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))
  }

  const addResponsible = (e) => {
    const userId = Number(e.target.value)
    if (!userId) return
    const u = assignees.find(a => a.id === userId)
    if (!u || form.responsibles.some(r => r.id === u.id)) return
    setForm(f => ({ ...f, responsibles: [...f.responsibles, { id: u.id, name: u.name, role: u.function || '' }] }))
    setErrors(prev => ({ ...prev, responsibles: null }))
    e.target.value = ''
  }

  const removeResponsible = (i) => {
    setForm(f => ({ ...f, responsibles: f.responsibles.filter((_, j) => j !== i) }))
  }

  const selectedCourse = courses.find((course) => course.name === form.course)
  const supervisor = selectedCourse?.supervisorName || null

  const validate = () => {
    const e = {}
    if (!form.course) e.course = 'Selecione um curso'
    if (!form.theme?.trim()) e.theme = 'Informe o título do conteúdo'
    if (!form.responsibles.length) e.responsibles = 'Adicione pelo menos um produtor responsável'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const primary = form.responsibles[0]
    const saved = await onSave({
      ...form,
      responsibleId: primary.id,
      responsibleName: primary.name,
      responsibleRole: primary.role,
    })
    if (saved !== false) onClose()
  }

  const SectionLabel = ({ children }) => (
    <div className="col-span-2 pt-2 pb-0.5 border-t border-gray-100 mt-1">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{children}</span>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo conteúdo' : 'Editar conteúdo'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            <CheckCircle size={15} />
            {saving ? 'Salvando...' : isNew ? 'Adicionar conteúdo' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">

        {/* ── Identificação ── */}
        <SectionLabel>Identificação</SectionLabel>

        {/* Curso */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Curso <span className="text-red-500">*</span>
          </label>
          <select
            name="course"
            value={form.course}
            onChange={handleChange}
            className={`select-field ${errors.course ? 'border-red-400 ring-1 ring-red-300' : ''}`}
          >
            <option value="">Selecionar curso...</option>
            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {errors.course && <p className="text-xs text-red-500 mt-1">{errors.course}</p>}
        </div>

        {/* Módulo + Sessão */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Módulo</label>
          <select name="module" value={form.module} onChange={handleChange} className="select-field">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Módulo {n}</option>
            ))}
          </select>
        </div>

        {/* Título */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            name="theme"
            value={form.theme}
            onChange={handleChange}
            className={`input-field ${errors.theme ? 'border-red-400 ring-1 ring-red-300' : ''}`}
            placeholder="Título do conteúdo"
          />
          {errors.theme && <p className="text-xs text-red-500 mt-1">{errors.theme}</p>}
        </div>

        {/* Objetivo */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Objetivo de aprendizagem</label>
          <textarea
            name="objective"
            value={form.objective}
            onChange={handleChange}
            className="input-field resize-none"
            rows={2}
            placeholder="Descreva o objetivo de aprendizagem..."
          />
        </div>

        {/* ── Tipo ── */}
        <SectionLabel>Tipo de material</SectionLabel>

        <div className="col-span-2">
          <div className="flex flex-wrap gap-2">
            {MATERIAL_TYPE_OPTIONS.map(option => {
              const selected = form.type.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    type: selected
                      ? f.type.filter(t => t !== option.value)
                      : [...f.type, option.value]
                  }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-700'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {form.type.length === 0 && (
            <p className="text-xs text-gray-400 mt-1.5">Nenhum tipo selecionado — clique para selecionar</p>
          )}
        </div>

        {/* ── Entrega ── */}
        <SectionLabel>Entrega</SectionLabel>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tempo estimado</label>
          <input name="duration" value={form.duration} onChange={handleChange} className="input-field" placeholder="Ex: 50 min" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de entrega</label>
          <input name="deliveryDate" value={form.deliveryDate} onChange={handleChange} type="date" className="input-field" />
        </div>

        {/* ── Responsáveis ── */}
        <SectionLabel>Responsáveis</SectionLabel>

        {/* Produtor(es) */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Produtor(es) <span className="text-red-500">*</span>
          </label>
          {form.responsibles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.responsibles.map((r, i) => (
                <div key={r.id || i} className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-lg px-2 py-1">
                  <div className="w-5 h-5 rounded-full bg-brand-700 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                    {r.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-brand-700 truncate max-w-[140px]">{r.name}</span>
                  <button type="button" onClick={() => removeResponsible(i)} className="text-brand-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <select
            value=""
            onChange={addResponsible}
            className={`select-field ${errors.responsibles ? 'border-red-400 ring-1 ring-red-300' : ''}`}
          >
            <option value="">+ Adicionar produtor...</option>
            {assignees.filter(u => !form.responsibles.some(r => r.id === u.id)).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          {errors.responsibles && <p className="text-xs text-red-500 mt-1">{errors.responsibles}</p>}
        </div>

        {/* Supervisor (auto) */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Supervisor para aprovação</label>
          <div className={`input-field flex items-center gap-2 bg-gray-50`}>
            {supervisor ? (
              <>
                <div className="w-5 h-5 rounded-full bg-slate-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                  {supervisor.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <span className="text-sm text-gray-700">{supervisor}</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">Preenchido automaticamente ao selecionar o curso</span>
            )}
          </div>
        </div>

        {/* ── Links ── */}
        <SectionLabel>Links</SectionLabel>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Material original</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input name="originalLink" value={form.originalLink || ''} onChange={handleChange} className="input-field pl-9" placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Material ajustado</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input name="adjustedLink" value={form.adjustedLink || ''} onChange={handleChange} className="input-field pl-9" placeholder="https://..." />
          </div>
        </div>

        {/* ── Status ── */}
        <SectionLabel>Status</SectionLabel>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do professor</label>
          <select name="status" value={form.status} onChange={handleChange} className="select-field">
            {PROFESSOR_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {canApprove && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do supervisor</label>
            <select name="supervisorStatus" value={form.supervisorStatus} onChange={handleChange} className="select-field">
              {SUPERVISOR_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}

        {canApprove && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do coordenador</label>
            <select name="coordinatorStatus" value={form.coordinatorStatus} onChange={handleChange} className="select-field">
              {COORDINATOR_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações da revisão</label>
          <textarea name="reviewNotes" value={form.reviewNotes} onChange={handleChange} className="input-field resize-none" rows={2} placeholder="Observações para o produtor..." />
        </div>

      </div>
    </Modal>
  )
}

export default function Producao() {
  const { user, can } = useAuth()
  const { materials, setMaterials, courses, materialAssignees, saveMaterial, approveMaterial, updateMaterialStatus, updateMaterialSession, deleteMaterial } = useData()
  const location = useLocation()
  const navigate = useNavigate()
  const initialCourse = location.state?.course || 'Todos'
  const [filters, setFilters] = useState({ course: initialCourse, session: '', responsible: 'Todos', status: '' })
  const [search, setSearch] = useState('')
  const [viewMaterial, setViewMaterial] = useState(null)
  const [editMaterial, setEditMaterial] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [page, setPage] = useState(1)
  const perPage = 5
  const [visibleCols, setVisibleCols] = useState({
    tema: true,
    objetivo: false,
    tempo: true,
    dataEntrega: true,
    linkOriginal: true,
    linkAjustado: true,
  })
  const toggleCol = (key, val) => setVisibleCols(c => ({ ...c, [key]: val }))

  const isCoordinator = user?.role === 'coordenador' || (user?.function || '').toLowerCase().includes('coordenador')
  const canApprove = can('approve_material') || user?.role === 'administrador' || isCoordinator
  const canEdit = can('edit_producao') || ['administrador', 'supervisor', 'professor'].includes(user?.role) || isCoordinator
  const canMoveSessions = user?.role === 'administrador' || user?.role === 'supervisor' || isCoordinator
  const courseOptions = ['Todos', ...courses.map(c => c.name)]

  const getCanEditMaterial = (material) => {
    if (!user) return false
    if (user.role === 'administrador') return true
    if (isCoordinator) {
      const course = courses.find(c => c.name === material.course)
      return course?.coordinatorId === user.id || course?.coordinatorName === user.name
    }
    if (user.role === 'supervisor') {
      const course = courses.find(c => c.name === material.course)
      return course?.supervisorId === user.id || course?.supervisorName === user.name
    }
    if (user.role === 'professor') return (
      material.responsibleId === user.id ||
      material.responsibles?.some(r => Number(r.id) === Number(user.id))
    )
    return false
  }

  const getCanEditSupervisorStatus = (material) => {
    if (!user) return false
    if (user.role === 'administrador') return true
    if (user.role === 'supervisor') {
      const course = courses.find(c => c.name === material.course)
      return course?.supervisorId === user.id || course?.supervisorName === user.name
    }
    return false
  }

  const getCanEditCoordinatorStatus = (material) => {
    if (!user) return false
    if (user.role === 'administrador') return true
    if (isCoordinator) {
      const course = courses.find(c => c.name === material.course)
      return course?.coordinatorId === user.id || course?.coordinatorName === user.name
    }
    return false
  }

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (filters.course !== 'Todos' && m.course !== filters.course) return false
      if (filters.status && m.status !== filters.status) return false
      if (filters.responsible !== 'Todos' && m.responsibleName !== filters.responsible) return false
      if (filters.session && String(m.session) !== filters.session) return false
      if (search) {
        const q = search.toLowerCase()
        return m.theme.toLowerCase().includes(q) ||
          m.responsibleName.toLowerCase().includes(q) ||
          m.objective.toLowerCase().includes(q)
      }
      return true
    })
  }, [materials, filters, search])

  const paged = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtered.length / perPage)

  const statsMaterials = filters.course !== 'Todos'
    ? materials.filter(m => m.course === filters.course)
    : materials
  const stats = {
    total: statsMaterials.length,
    emProducao: statsMaterials.filter(m => ['nao_iniciado', 'em_execucao', 'em_ajustes'].includes(m.status)).length,
    concluidos: statsMaterials.filter(m => m.status === 'concluido' && m.supervisorStatus === 'valido' && m.coordinatorStatus === 'valido').length,
    emRevisao: statsMaterials.filter(m => m.status === 'concluido' && (m.supervisorStatus !== 'valido' || m.coordinatorStatus !== 'valido')).length,
  }

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (form) => {
    try {
      setSavingMaterial(true)
      const isNew = !form.id
      if (isNew) {
        const courseMaterials = materials.filter(m => m.course === form.course)
        form.session = courseMaterials.length + 1
      }
      await saveMaterial(form)
      showToast(form.id ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo inserido com sucesso!')
      return true
    } catch {
      showToast('Erro ao salvar conteúdo. Tente novamente.', 'error')
      return false
    } finally {
      setSavingMaterial(false)
    }
  }

  const handleStatusChange = async (mat, field, value) => {
    try {
      await updateMaterialStatus(mat.id, { [field]: value })
    } catch {
      setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, [field]: value } : m))
    }
  }

  const handleMoveSession = async (mat, direction) => {
    const newSession = Number(mat.session) + direction
    if (newSession < 1) return
    try {
      await updateMaterialSession(mat.id, newSession)
    } catch {
      setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, session: newSession } : m))
    }
  }

  const handleDragStart = (e, mat) => {
    setDragId(mat.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, mat) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (mat.id !== dragId) setDragOverId(mat.id)
  }

  const handleDrop = async (e, targetMat) => {
    e.preventDefault()
    setDragOverId(null)
    if (!dragId || dragId === targetMat.id) { setDragId(null); return }
    const srcMat = materials.find(m => m.id === dragId)
    if (!srcMat) { setDragId(null); return }
    const srcSession = Number(srcMat.session)
    const tgtSession = Number(targetMat.session)
    setMaterials(prev => prev.map(m => {
      if (m.id === srcMat.id) return { ...m, session: tgtSession }
      if (m.id === targetMat.id) return { ...m, session: srcSession }
      return m
    }))
    try {
      await Promise.all([
        updateMaterialSession(srcMat.id, tgtSession),
        updateMaterialSession(targetMat.id, srcSession),
      ])
    } catch { /* optimistic já aplicado */ }
    setDragId(null)
  }

  const handleDragEnd = () => { setDragId(null); setDragOverId(null) }

  const handleDelete = (mat) => setConfirmDelete(mat)

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return
    try {
      await deleteMaterial(confirmDelete.id)
      showToast('Conteúdo excluído com sucesso!')
    } catch {
      showToast('Erro ao excluir conteúdo.', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  const clearFilters = () => {
    setFilters({ course: 'Todos', session: '', responsible: 'Todos', status: '' })
    setSearch('')
    setPage(1)
  }

  const responsibleOptions = ['Todos', ...new Set(materials.map(m => m.responsibleName))]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          {initialCourse !== 'Todos' && (
            <button
              onClick={() => navigate('/cursos')}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mb-1.5 group"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              Voltar para Cursos
            </button>
          )}
          <h1 className="page-title">Produção</h1>
          <p className="page-subtitle">
            {initialCourse !== 'Todos'
              ? `Materiais do curso: ${initialCourse}`
              : 'Acompanhe os materiais produzidos pelos professores/produtores.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
{canEdit && (
            <button
              onClick={() => { setEditMaterial({}); setEditOpen(true) }}
              className="btn-primary"
            >
              <Plus size={14} />
              Novo conteúdo
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Curso</label>
            <select
              value={filters.course}
              onChange={e => { setFilters(f => ({ ...f, course: e.target.value })); setPage(1) }}
              className="select-field"
            >
              {courseOptions.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sessão/Módulo</label>
            <select
              value={filters.session}
              onChange={e => { setFilters(f => ({ ...f, session: e.target.value })); setPage(1) }}
              className="select-field"
            >
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={String(n)}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Responsável</label>
            <select
              value={filters.responsible}
              onChange={e => { setFilters(f => ({ ...f, responsible: e.target.value })); setPage(1) }}
              className="select-field"
            >
              {responsibleOptions.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select
              value={filters.status}
              onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1) }}
              className="select-field"
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <Filter size={14} />
            Limpar filtros
          </button>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar conteúdos, temas ou responsáveis..."
            className="input-field pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} iconBg="bg-brand-100" iconColor="text-brand-700"
          value={stats.total} label="Materiais cadastrados" sublabel="Total de materiais no curso" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600"
          value={stats.emProducao} label="Em produção" sublabel="Aguardando finalização" />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600"
          value={stats.concluidos} label="Concluídos" sublabel="Produção concluída" />
        <StatCard icon={Eye} iconBg="bg-purple-100" iconColor="text-purple-700"
          value={stats.emRevisao} label="Em revisão" sublabel="Aguardando aprovação" />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-gray-100">
          <ColumnsToggle cols={visibleCols} onChange={toggleCol} />
        </div>
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header w-12">N</th>
                <th className="table-header w-16">Módulo</th>
                {visibleCols.tema && <th className="table-header">Título</th>}
                {visibleCols.objetivo && <th className="table-header">Objetivo</th>}
                <th className="table-header w-24">Tipo</th>
                {visibleCols.tempo && <th className="table-header w-16">Tempo</th>}
                <th className="table-header w-10">Resp.</th>
                <th className="table-header">St. Prof.</th>
                <th className="table-header">St. Sup.</th>
                <th className="table-header">St. Coord.</th>
                {visibleCols.dataEntrega && <th className="table-header w-24">Data entrega</th>}
                {visibleCols.linkOriginal && <th className="table-header w-28">Link original</th>}
                {visibleCols.linkAjustado && <th className="table-header w-28">Link ajustado</th>}
                <th className="table-header w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(mat => {
                const canEditThis = getCanEditMaterial(mat)
                const canEditSupStatus = getCanEditSupervisorStatus(mat)
                const canEditCoordStatus = getCanEditCoordinatorStatus(mat)
                const matCourse = courses.find(c => c.name === mat.course)
                const supName = matCourse?.supervisorName || null
                const supAvatar = matCourse?.supervisorAvatar || null
                const coordName = matCourse?.coordinatorName || null
                const coordAvatar = matCourse?.coordinatorAvatar || null
                const isDragging = dragId === mat.id
                const isDragOver = dragOverId === mat.id
                return (
                <tr
                  key={mat.id}
                  draggable={canMoveSessions && canEditThis}
                  onDragStart={canMoveSessions && canEditThis ? e => handleDragStart(e, mat) : undefined}
                  onDragOver={canMoveSessions ? e => handleDragOver(e, mat) : undefined}
                  onDrop={canMoveSessions ? e => handleDrop(e, mat) : undefined}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-gray-50 transition-colors
                    ${isDragging ? 'opacity-40' : ''}
                    ${isDragOver ? 'bg-brand-50/30 border-t-2 border-t-brand-400' : 'hover:bg-gray-50/50'}
                  `}
                >
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canMoveSessions && canEditThis && (
                        <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
                      )}
                      <span className="font-semibold text-gray-600">{mat.session}</span>
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    <span className="text-xs font-medium text-gray-500">M{mat.module || 1}</span>
                  </td>
                  {visibleCols.tema && (
                    <td className="table-cell">
                      <div className="font-medium text-gray-700 truncate max-w-[160px]">{mat.theme}</div>
                    </td>
                  )}
                  {visibleCols.objetivo && (
                    <td className="table-cell">
                      <div className="text-gray-500 max-w-[180px] line-clamp-2">{mat.objective}</div>
                    </td>
                  )}
                  <td className="table-cell"><TypeBadge type={mat.type} /></td>
                  {visibleCols.tempo && <td className="table-cell text-gray-500">{mat.duration}</td>}
                  <td className="table-cell">
                    <StackedAvatars
                      assignees={materialAssignees}
                      responsibles={
                        mat.responsibles?.length
                          ? mat.responsibles
                          : (mat.responsibleName ? [{ id: mat.responsibleId, name: mat.responsibleName, role: mat.responsibleRole }] : [])
                      }
                    />
                  </td>
                  <td className="table-cell">
                    {canEditThis ? (
                      <InlineStatusSelect
                        value={mat.status || 'nao_iniciado'}
                        options={PROFESSOR_STATUS_OPTIONS}
                        onChange={val => handleStatusChange(mat, 'status', val)}
                      />
                    ) : (
                      <Badge status={mat.status || 'nao_iniciado'} />
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <MiniAvatar name={supName} roleLabel="Supervisor" avatar={supAvatar} />
                      {canEditSupStatus ? (
                        <InlineStatusSelect
                          value={mat.supervisorStatus || 'em_revisao'}
                          options={SUPERVISOR_STATUS_OPTIONS}
                          onChange={val => handleStatusChange(mat, 'supervisorStatus', val)}
                        />
                      ) : (
                        <Badge status={mat.supervisorStatus || 'em_revisao'} />
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <MiniAvatar name={coordName} roleLabel="Coordenador" avatar={coordAvatar} />
                      {canEditCoordStatus ? (
                        <InlineStatusSelect
                          value={mat.coordinatorStatus || 'em_revisao'}
                          options={COORDINATOR_STATUS_OPTIONS}
                          onChange={val => handleStatusChange(mat, 'coordinatorStatus', val)}
                        />
                      ) : (
                        <Badge status={mat.coordinatorStatus || 'em_revisao'} />
                      )}
                    </div>
                  </td>
                  {visibleCols.dataEntrega && (
                    <td className="table-cell text-gray-500">
                      {mat.deliveryDate ? new Date(mat.deliveryDate).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  )}
                  {visibleCols.linkOriginal && (
                    <td className="table-cell"><LinkChip url={mat.originalLink} /></td>
                  )}
                  {visibleCols.linkAjustado && (
                    <td className="table-cell"><LinkChip url={mat.adjustedLink} /></td>
                  )}
                  <td className="table-cell">
                    <ActionButtons
                      material={mat}
                      onView={m => setViewMaterial(m)}
                      onEdit={m => { setEditMaterial(m); setEditOpen(true) }}
                      onDelete={handleDelete}
                      canEdit={canEditThis}
                    />
                  </td>
                </tr>
                )
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={20} className="table-cell text-center py-10 text-gray-400 text-sm">
                    Nenhum material encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Exibindo {Math.min((page - 1) * perPage + 1, filtered.length)} a {Math.min(page * perPage, filtered.length)} de {filtered.length} conteúdos
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
              >‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === n ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {n}
                </button>
              ))}
              {totalPages > 5 && <span className="text-gray-400 text-xs px-1">...</span>}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500"
              >›</button>
            </div>
          </div>
        )}
      </div>

      <MaterialModal material={viewMaterial} open={!!viewMaterial} onClose={() => setViewMaterial(null)} />
      <EditModal
        key={editMaterial?.id ?? 'new'}
        material={editMaterial?.id ? editMaterial : null}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        defaultCourse={filters.course}
        canApprove={canApprove}
        courses={courses}
        assignees={materialAssignees}
        saving={savingMaterial}
      />

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Excluir conteúdo</h3>
                <p className="text-xs text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir <span className="font-medium text-gray-800">{confirmDelete.theme}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={confirmDeleteAction} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors">
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <CheckCircle size={16} className={toast.type === 'error' ? 'text-red-200' : 'text-green-400'} />
          {toast.message}
        </div>
      )}
    </div>
  )
}
