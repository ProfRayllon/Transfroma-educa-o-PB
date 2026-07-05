import { useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, FileText, Clock, Eye, Search, Filter, X, Link2, Pencil, Trash2, ShieldAlert } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import ModulosWorkspace from '../components/producao/ModulosWorkspace'
import {
  PROFESSOR_STATUS_OPTIONS,
  SUPERVISOR_STATUS_OPTIONS,
  COORDINATOR_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
  getMaterialResponsibles,
  TypeBadge,
  LinkChip,
  MiniAvatar,
  InlineStatusSelect,
} from '../components/producao/shared'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  ...PROFESSOR_STATUS_OPTIONS,
]

function getMaterialResponsibleNames(material) {
  return [...new Set(getMaterialResponsibles(material).map((responsible) => responsible.name).filter(Boolean))]
}

function findCourseForMaterial(material, courses = []) {
  return courses.find((course) => Number(course.id) === Number(material?.courseId))
    || courses.find((course) => course.name === material?.course)
    || null
}

function materialMatchesCourseName(material, courseName, courses = []) {
  const course = findCourseForMaterial(material, courses)
  return course ? course.name === courseName : material?.course === courseName
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
      {canEdit && (
        <button onClick={() => onDelete(material)} title="Excluir" className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
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
      type: '',
      theme: '',
      objective: '',
      duration: '',
      deliveryDate: '',
      status: '',
      supervisorStatus: '',
      coordinatorStatus: '',
      reviewNotes: '',
      responsibleId: '',
      responsibleName: '',
      responsibleRole: '',
      originalLink: '',
      adjustedLink: '',
      ...(material || {}),
    }
    base.type = Array.isArray(base.type) ? (base.type[0] || '') : (base.type || '')
    base.responsibles = material?.responsibles?.length
      ? material.responsibles
      : (material?.responsibleId ? [{ id: material.responsibleId, name: material.responsibleName, role: material.responsibleRole }] : [])
    return base
  })

  const handleChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name] || errors.form) setErrors(prev => ({ ...prev, [name]: null, form: null }))
  }

  const addResponsible = (e) => {
    const userId = Number(e.target.value)
    if (!userId) return
    const u = assignees.find(a => a.id === userId)
    if (!u || form.responsibles.some(r => r.id === u.id)) return
    setForm(f => ({ ...f, responsibles: [...f.responsibles, { id: u.id, name: u.name, role: u.function || '' }] }))
    setErrors(prev => ({ ...prev, responsibles: null, form: null }))
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
    if (!form.type) e.type = 'Selecione o tipo de material'
    if (!form.theme?.trim()) e.theme = 'Informe o título do conteúdo'
    if (!form.responsibles.length) e.responsibles = 'Adicione pelo menos um produtor responsável'
    if (Object.keys(e).length > 0) e.form = 'Existem campos obrigatórios pendentes. Revise os campos marcados com *.'
    setErrors(e)
    return !e.form
  }

  const handleSubmit = async () => {
    if (!validate()) return
    const primary = form.responsibles[0]
    const saved = await onSave({
      ...form,
      courseId: selectedCourse?.id || form.courseId || null,
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
        {errors.form && (
          <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.form}
          </div>
        )}

        <div className="col-span-2 text-[11px] font-medium text-gray-400">
          Campos com <span className="text-red-500">*</span> são obrigatórios.
        </div>

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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Tipo de material <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {MATERIAL_TYPE_OPTIONS.map(option => {
              const selected = form.type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    type: selected ? '' : option.value
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
          {!form.type && (
            <p className="text-xs text-gray-400 mt-1.5">Nenhum tipo selecionado — clique para selecionar</p>
          )}
        </div>

        {/* ── Entrega ── */}
          {errors.type && <p className="col-span-2 text-xs text-red-500 -mt-1">{errors.type}</p>}
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

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações da revisão</label>
          <textarea name="reviewNotes" value={form.reviewNotes} onChange={handleChange} className="input-field resize-none" rows={2} placeholder="Observações para o produtor..." />
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


      </div>
    </Modal>
  )
}

export default function Producao() {
  const { user, can } = useAuth()
  const { materials, courses, materialAssignees, saveMaterial, updateMaterialStatus, deleteMaterial } = useData()
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
  const [page, setPage] = useState(1)
  const perPage = 50

  const isCoordinator = user?.role === 'coordenador' || (user?.function || '').toLowerCase().includes('coordenador')
  const canApprove = can('approve_material') || user?.role === 'administrador' || isCoordinator
  const isAdmin = user?.role === 'administrador'
  const canViewOverview = isAdmin || isCoordinator || user?.role === 'supervisor'
  const courseOptions = ['Todos', ...courses.map(c => c.name)]
  const activeCourse = filters.course !== 'Todos' ? courses.find(c => c.name === filters.course) : null

  const getMaterialFlags = (material) => {
    const course = findCourseForMaterial(material, courses)
    const isCourseCoordinator = isCoordinator && (course?.coordinatorId === user?.id || course?.coordinatorName === user?.name)
    const isCourseSupervisor = user?.role === 'supervisor' && (course?.supervisorId === user?.id || course?.supervisorName === user?.name)
    const isProducer = user?.role === 'professor' && (
      material.responsibleId === user?.id || material.responsibles?.some(r => Number(r.id) === Number(user?.id))
    )
    return { course, isPrivileged: isAdmin || isCourseCoordinator, isCourseSupervisor, isProducer }
  }

  // Admin e coordenacao do curso podem sempre alterar qualquer status de qualquer perfil,
  // mesma regra aplicada na producao por modulo (ModulosWorkspace).
  const getCanEditMaterial = (material) => {
    if (!user) return false
    const { isPrivileged, isCourseSupervisor, isProducer } = getMaterialFlags(material)
    return isPrivileged || isCourseSupervisor || isProducer
  }

  const getCanEditProfessorStatus = (material) => {
    if (!user) return false
    const { isPrivileged, isProducer } = getMaterialFlags(material)
    return isPrivileged || isProducer
  }

  const getCanEditSupervisorStatus = (material) => {
    if (!user) return false
    const { isPrivileged, isCourseSupervisor } = getMaterialFlags(material)
    return isPrivileged || isCourseSupervisor
  }

  const getCanEditCoordinatorStatus = (material) => {
    if (!user) return false
    return getMaterialFlags(material).isPrivileged
  }

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (filters.course !== 'Todos' && !materialMatchesCourseName(m, filters.course, courses)) return false
      if (filters.status && m.status !== filters.status) return false
      if (filters.responsible !== 'Todos' && !getMaterialResponsibleNames(m).includes(filters.responsible)) return false
      if (filters.session && String(m.session) !== filters.session) return false
      if (search) {
        const q = search.toLowerCase()
        const responsibleNames = getMaterialResponsibleNames(m).join(' ').toLowerCase()
        return m.theme.toLowerCase().includes(q) ||
          responsibleNames.includes(q) ||
          (m.objective || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [materials, filters, search, courses])

  const paged = filtered.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(filtered.length / perPage)

  const statsMaterials = filters.course !== 'Todos'
    ? materials.filter(m => materialMatchesCourseName(m, filters.course, courses))
    : materials
  const stats = {
    total: statsMaterials.length,
    emProducao: statsMaterials.filter(m => ['nao_iniciado', 'em_execucao', 'em_ajustes'].includes(m.status)).length,
    concluidos: statsMaterials.filter(m => m.status === 'concluido' && m.supervisorStatus === 'aprovado' && m.coordinatorStatus === 'aprovado').length,
    emRevisao: statsMaterials.filter(m => m.status === 'concluido' && (m.supervisorStatus !== 'aprovado' || m.coordinatorStatus !== 'aprovado')).length,
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
        const courseMaterials = materials.filter(m => materialMatchesCourseName(m, form.course, courses))
        form.session = courseMaterials.length + 1
      }
      await saveMaterial(form)
      showToast(form.id ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo inserido com sucesso!')
      return true
    } catch (error) {
      showToast(error.message || 'Existem campos obrigatórios pendentes. Revise o formulário.', 'error')
      return false
    } finally {
      setSavingMaterial(false)
    }
  }

  const handleStatusChange = async (mat, field, value) => {
    try {
      await updateMaterialStatus(mat.id, { [field]: value })
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar status.', 'error')
    }
  }

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

  const responsibleOptions = ['Todos', ...new Set(materials.flatMap((material) => getMaterialResponsibleNames(material)))]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header (a view por modulos renderiza seu proprio cabecalho) */}
      {!activeCourse && (
        <div>
          <h1 className="page-title">Produção</h1>
          <p className="page-subtitle">Visão geral dos materiais produzidos em todos os cursos.</p>
          {canViewOverview && filters.course === 'Todos' && courses.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">Selecione um curso no filtro abaixo para abrir a produção por módulos.</p>
          )}
        </div>
      )}

      {activeCourse ? (
        <ModulosWorkspace course={activeCourse} />
      ) : !canViewOverview ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <ShieldAlert size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Visão geral restrita</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Esta visão consolidada de todos os cursos é exclusiva para administradores, coordenadores e supervisores.
              Acesse a produção do seu curso pela página Cursos.
            </p>
          </div>
          <button onClick={() => navigate('/cursos')} className="btn-primary mt-2">
            Ir para Cursos
          </button>
        </div>
      ) : (
      <>
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
                <th className="table-header w-32">Curso</th>
                <th className="table-header w-16">Módulo</th>
                <th className="table-header">Item</th>
                <th className="table-header w-14">Tipo</th>
                <th className="table-header w-36">Professor</th>
                <th className="table-header w-36">Supervisor</th>
                <th className="table-header w-36">Coordenação</th>
                <th className="table-header w-28">Link</th>
                <th className="table-header w-28">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(mat => {
                const flags = getMaterialFlags(mat)
                const canEditThis = getCanEditMaterial(mat)
                const canEditProfStatus = getCanEditProfessorStatus(mat)
                const canEditSupStatus = getCanEditSupervisorStatus(mat)
                const canEditCoordStatus = getCanEditCoordinatorStatus(mat)
                const matCourse = flags.course
                const responsibleAvatar = materialAssignees.find(a => Number(a.id) === Number(mat.responsibleId))?.avatar
                const supName = matCourse?.supervisorName || null
                const supAvatar = matCourse?.supervisorAvatar || null
                const coordName = matCourse?.coordinatorName || null
                const coordAvatar = matCourse?.coordinatorAvatar || null
                return (
                <tr key={mat.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="table-cell">
                    <span className="text-gray-700 truncate max-w-[120px] inline-block align-middle" title={matCourse?.name || mat.course}>
                      {matCourse?.name || mat.course}
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    <span className="text-xs font-medium text-gray-500">M{mat.module || 1}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText size={12} />
                      </div>
                      <span className="text-gray-700 truncate max-w-56" title={mat.theme}>{mat.theme}</span>
                    </div>
                  </td>
                  <td className="table-cell"><TypeBadge type={mat.type} iconOnly /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <MiniAvatar name={mat.responsibleName} roleLabel="Professor" avatar={responsibleAvatar} />
                      {canEditProfStatus ? (
                        <InlineStatusSelect
                          value={mat.status || ''}
                          options={PROFESSOR_STATUS_OPTIONS}
                          onChange={val => handleStatusChange(mat, 'status', val)}
                        />
                      ) : (
                        <Badge status={mat.status || ''} />
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <MiniAvatar name={supName} roleLabel="Supervisor" avatar={supAvatar} />
                      {canEditSupStatus ? (
                        <InlineStatusSelect
                          value={mat.supervisorStatus || ''}
                          options={SUPERVISOR_STATUS_OPTIONS}
                          onChange={val => {
                            if (!flags.isPrivileged && val === 'aprovado' && mat.status !== 'concluido') {
                              showToast('Só é possível aprovar após o professor concluir este conteúdo.', 'error')
                              return
                            }
                            handleStatusChange(mat, 'supervisorStatus', val)
                          }}
                        />
                      ) : (
                        <Badge status={mat.supervisorStatus || ''} />
                      )}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <MiniAvatar name={coordName} roleLabel="Coordenador" avatar={coordAvatar} />
                      {canEditCoordStatus ? (
                        <InlineStatusSelect
                          value={mat.coordinatorStatus || ''}
                          options={COORDINATOR_STATUS_OPTIONS}
                          onChange={val => handleStatusChange(mat, 'coordinatorStatus', val)}
                        />
                      ) : (
                        <Badge status={mat.coordinatorStatus || ''} />
                      )}
                    </div>
                  </td>
                  <td className="table-cell"><LinkChip url={mat.adjustedLink || mat.originalLink} /></td>
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
                  <td colSpan={9} className="table-cell text-center py-10 text-gray-400 text-sm">
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
      </>
      )}

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
