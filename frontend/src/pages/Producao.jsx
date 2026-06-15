import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Upload, CheckCircle, FileText, Clock, Eye, Search, Filter, X, MoreVertical, ExternalLink, CheckSquare, ArrowLeft, Link2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { mockUsers, mockPeople } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_producao', label: 'Em produção' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'ajuste_solicitado', label: 'Ajuste solicitado' },
]

const REVIEW_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'ajuste_solicitado', label: 'Ajuste solicitado' },
]

const producers = mockUsers.filter(u => ['professor', 'supervisor', 'administrador'].includes(u.role))

function TypeBadge({ type }) {
  const cls = type === 'Aula'
    ? 'bg-blue-50 text-blue-700 border border-blue-200'
    : 'bg-orange-50 text-orange-700 border border-orange-200'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {type === 'Aula' ? <FileText size={10} /> : <CheckSquare size={10} />}
      {type}
    </span>
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

function ActionsMenu({ material, onView, onEdit, onApprove, onRequestAdjust, canApprove, canEdit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onView(material)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
      >
        <Eye size={12} />
        Ver
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreVertical size={15} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
              {canEdit && (
                <button
                  onClick={() => { onEdit(material); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Editar
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => { onApprove(material); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-green-700 hover:bg-green-50 transition-colors"
                >
                  Aprovar
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => { onRequestAdjust(material); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-50 transition-colors"
                >
                  Solicitar ajuste
                </button>
              )}
              {material.originalLink && (
                <a
                  href={material.originalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <ExternalLink size={13} />
                  Abrir link original
                </a>
              )}
            </div>
          </>
        )}
      </div>
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
            <div className="text-xs font-medium text-gray-500 mb-1">Responsável</div>
            <AvatarChip name={material.responsibleName} role={material.responsibleRole} />
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

const onlyProducers = mockUsers.filter(u => u.role === 'professor')

function getSupervisor(responsibleId) {
  const person = mockPeople.find(p => p.userId === responsibleId)
  if (!person || !person.supervisorName || person.supervisorName === '—') return null
  return person.supervisorName
}

function EditModal({ material, open, onClose, onSave, defaultCourse, canApprove, courses }) {
  const isNew = !material?.id
  const [form, setForm] = useState(() => ({
    course: defaultCourse && defaultCourse !== 'Todos' ? defaultCourse : '',
    session: '',
    type: 'Aula',
    theme: '',
    objective: '',
    duration: '',
    deliveryDate: '',
    status: 'pendente',
    reviewStatus: 'pendente',
    reviewNotes: '',
    responsibleId: '',
    responsibleName: '',
    responsibleRole: '',
    originalLink: '',
    adjustedLink: '',
    ...(material || {}),
  }))

  const handleChange = e => {
    const { name, value } = e.target
    if (name === 'responsibleId') {
      const user = producers.find(u => u.id === Number(value))
      setForm(f => ({
        ...f,
        responsibleId: Number(value),
        responsibleName: user?.name || '',
        responsibleRole: user?.function || '',
      }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const supervisor = getSupervisor(form.responsibleId)

  const handleSubmit = () => {
    if (!form.course || !form.theme || !form.responsibleId) return
    onSave(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo material' : 'Editar material'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary">
            <CheckCircle size={15} />
            {isNew ? 'Adicionar material' : 'Salvar alterações'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Curso */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Curso *</label>
          <select name="course" value={form.course} onChange={handleChange} className="select-field" required>
            <option value="">Selecionar curso...</option>
            {courses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* Sessão + Tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Sessão *</label>
          <input name="session" value={form.session} onChange={handleChange} type="number" min={1} className="input-field" placeholder="Ex: 1" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo</label>
          <select name="type" value={form.type} onChange={handleChange} className="select-field">
            <option value="Aula">Aula</option>
            <option value="Atividade">Atividade</option>
          </select>
        </div>

        {/* Tema */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tema *</label>
          <input name="theme" value={form.theme} onChange={handleChange} className="input-field" placeholder="Tema da sessão" required />
        </div>

        {/* Objetivo */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Objetivo de aprendizagem</label>
          <textarea name="objective" value={form.objective} onChange={handleChange} className="input-field resize-none" rows={2} placeholder="Descreva o objetivo de aprendizagem..." />
        </div>

        {/* Tempo + Data */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tempo estimado</label>
          <input name="duration" value={form.duration} onChange={handleChange} className="input-field" placeholder="Ex: 50 min" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de entrega</label>
          <input name="deliveryDate" value={form.deliveryDate} onChange={handleChange} type="date" className="input-field" />
        </div>

        {/* Produtor responsável */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Produtor responsável *</label>
          <select name="responsibleId" value={form.responsibleId || ''} onChange={handleChange} className="select-field" required>
            <option value="">Selecionar produtor...</option>
            {onlyProducers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Supervisor (auto) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Supervisor para aprovação</label>
          <div className={`input-field flex items-center gap-2 ${supervisor ? 'bg-gray-50' : 'bg-gray-50 text-gray-400'}`}>
            {supervisor ? (
              <>
                <div className="w-5 h-5 rounded-full bg-brand-700 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                  {supervisor.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <span className="text-sm text-gray-700">{supervisor}</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">Selecione um produtor primeiro</span>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Link do material original</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="originalLink"
              value={form.originalLink || ''}
              onChange={handleChange}
              className="input-field pl-9"
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Link do material ajustado</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="adjustedLink"
              value={form.adjustedLink || ''}
              onChange={handleChange}
              className="input-field pl-9"
              placeholder="https://drive.google.com/..."
            />
          </div>
        </div>

        {/* Status — só aparece ao editar ou para quem pode aprovar */}
        {(!isNew || canApprove) && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="select-field">
                {STATUS_OPTIONS.filter(s => s.value).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Status da revisão</label>
              <select name="reviewStatus" value={form.reviewStatus} onChange={handleChange} className="select-field">
                {REVIEW_STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações da revisão</label>
              <textarea name="reviewNotes" value={form.reviewNotes} onChange={handleChange} className="input-field resize-none" rows={2} placeholder="Observações para o produtor..." />
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function Producao() {
  const { user, can } = useAuth()
  const { materials, setMaterials, courses } = useData()
  const location = useLocation()
  const navigate = useNavigate()
  const initialCourse = location.state?.course || 'Todos'
  const [filters, setFilters] = useState({ course: initialCourse, session: '', responsible: 'Todos', status: '' })
  const [search, setSearch] = useState('')
  const [viewMaterial, setViewMaterial] = useState(null)
  const [editMaterial, setEditMaterial] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 5

  const canApprove = can('approve_material') || user?.role === 'administrador'
  const canEdit = can('edit_producao') || ['administrador', 'supervisor', 'professor'].includes(user?.role)
  const courseOptions = ['Todos', ...courses.map(c => c.name)]

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
    emProducao: statsMaterials.filter(m => m.status === 'em_producao').length,
    concluidos: statsMaterials.filter(m => ['concluido', 'aprovado'].includes(m.status)).length,
    emRevisao: statsMaterials.filter(m => m.status === 'em_revisao').length,
  }

  const handleApprove = (mat) => {
    setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, status: 'aprovado', reviewStatus: 'aprovado' } : m))
  }

  const handleApproveAll = () => {
    setMaterials(prev => prev.map(m =>
      ['concluido', 'em_revisao'].includes(m.status)
        ? { ...m, status: 'aprovado', reviewStatus: 'aprovado' }
        : m
    ))
  }

  const handleRequestAdjust = (mat) => {
    setMaterials(prev => prev.map(m => m.id === mat.id ? { ...m, status: 'em_revisao', reviewStatus: 'ajuste_solicitado' } : m))
  }

  const handleSave = (form) => {
    if (form.id) {
      setMaterials(prev => prev.map(m => m.id === form.id ? { ...m, ...form } : m))
    } else {
      setMaterials(prev => [...prev, { ...form, id: Date.now(), createdAt: new Date().toISOString().split('T')[0] }])
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
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          {initialCourse !== 'Todos' && (
            <button
              onClick={() => navigate('/cursos')}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mb-2 group"
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
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && (
            <button
              onClick={handleApproveAll}
              className="btn-primary bg-green-700 hover:bg-green-800"
            >
              <CheckCircle size={15} />
              Aprovar todos os conteúdos
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <button className="btn-secondary">
          <Upload size={15} />
          Importar planilha
        </button>
        <button
          onClick={() => { setEditMaterial({}); setEditOpen(true) }}
          className="btn-primary"
        >
          <Plus size={15} />
          Novo material
        </button>
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
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header w-16">Sessão</th>
                <th className="table-header">Tema</th>
                <th className="table-header hidden xl:table-cell">Objetivo</th>
                <th className="table-header w-24">Tipo</th>
                <th className="table-header w-20">Tempo</th>
                <th className="table-header">Responsável</th>
                <th className="table-header w-28">Status</th>
                <th className="table-header w-28 hidden lg:table-cell">Data entrega</th>
                <th className="table-header hidden lg:table-cell">Link original</th>
                <th className="table-header hidden xl:table-cell">Link ajustado</th>
                <th className="table-header w-28">Status revisão</th>
                <th className="table-header w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(mat => (
                <tr key={mat.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="table-cell text-center font-semibold text-gray-600">{mat.session}</td>
                  <td className="table-cell">
                    <div className="font-medium text-gray-800 text-sm">{mat.theme}</div>
                  </td>
                  <td className="table-cell hidden xl:table-cell">
                    <div className="text-xs text-gray-500 max-w-[180px] line-clamp-2">{mat.objective}</div>
                  </td>
                  <td className="table-cell"><TypeBadge type={mat.type} /></td>
                  <td className="table-cell text-xs text-gray-500">{mat.duration}</td>
                  <td className="table-cell"><AvatarChip name={mat.responsibleName} role={mat.responsibleRole} /></td>
                  <td className="table-cell"><Badge status={mat.status} /></td>
                  <td className="table-cell hidden lg:table-cell text-xs text-gray-500">
                    {mat.deliveryDate ? new Date(mat.deliveryDate).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="table-cell hidden lg:table-cell">
                    <LinkChip url={mat.originalLink} />
                  </td>
                  <td className="table-cell hidden xl:table-cell">
                    <LinkChip url={mat.adjustedLink} />
                  </td>
                  <td className="table-cell"><Badge status={mat.reviewStatus} /></td>
                  <td className="table-cell">
                    <ActionsMenu
                      material={mat}
                      onView={m => setViewMaterial(m)}
                      onEdit={m => { setEditMaterial(m); setEditOpen(true) }}
                      onApprove={handleApprove}
                      onRequestAdjust={handleRequestAdjust}
                      canApprove={canApprove}
                      canEdit={canEdit}
                    />
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={12} className="table-cell text-center py-10 text-gray-400 text-sm">
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
              Exibindo {Math.min((page - 1) * perPage + 1, filtered.length)} a {Math.min(page * perPage, filtered.length)} de {filtered.length} materiais
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
      />
    </div>
  )
}
