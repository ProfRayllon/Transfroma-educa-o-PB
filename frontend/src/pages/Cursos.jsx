import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  Clock,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const PRIMARY_TRAILS = {
  'TRILHAS TRANSVERSAIS': [
    'Educacao Socioemocional',
    'Educacao, Ciencia e Tecnologia',
    'Gestao Pedagogica',
    'Inclusao, Diversidade e Equidade',
  ],
  'TRILHAS DA FORMACAO GERAL BASICA': [
    'Area de Linguagens',
    'Area de Ciencias Humanas',
    'Area de Matematica e Ciencias da Natureza',
  ],
}

const TRAIL_COLORS = {
  'TRILHAS TRANSVERSAIS': {
    pill: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    bar: '#A21CAF',
    grad: 'from-fuchsia-500 to-violet-700',
    accent: 'text-fuchsia-700',
  },
  'TRILHAS DA FORMACAO GERAL BASICA': {
    pill: 'bg-sky-100 text-sky-700 border-sky-200',
    bar: '#0369A1',
    grad: 'from-sky-500 to-cyan-700',
    accent: 'text-sky-700',
  },
}

function getTrailColor(primaryTrail) {
  return TRAIL_COLORS[primaryTrail] || {
    pill: 'bg-gray-100 text-gray-700 border-gray-200',
    bar: '#6B7280',
    grad: 'from-gray-500 to-gray-700',
    accent: 'text-gray-700',
  }
}

function getInitials(name) {
  if (!name) return '--'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatDate(iso) {
  if (!iso) return '--'
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function deadlineBadge(deadline) {
  if (!deadline) return null

  const today = new Date()
  const target = new Date(deadline)
  const diff = (target - today) / (1000 * 60 * 60 * 24)

  if (diff < 0) {
    return { label: 'Prazo vencido', cls: 'bg-red-50 text-red-700 border border-red-200' }
  }

  if (diff <= 14) {
    return { label: 'Prazo proximo', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
  }

  return null
}

function MultiSelectFilter({ label, placeholder, options, values, onChange }) {
  const [open, setOpen] = useState(false)

  const toggleValue = (option) => {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option))
      return
    }

    onChange([...values, option])
  }

  const clear = () => onChange([])

  const buttonLabel = values.length === 0
    ? placeholder
    : values.length === 1
      ? values[0]
      : `${values.length} selecionados`

  return (
    <div className="relative min-w-[200px]">
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left text-gray-800 bg-white hover:border-gray-300 transition-colors"
      >
        <span className={`truncate ${values.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {buttonLabel}
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
              <button type="button" onClick={clear} className="text-xs font-medium text-brand-700 hover:text-brand-900">
                Limpar
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {options.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-400">Nenhuma opcao disponivel.</div>
              ) : (
                options.map((option) => {
                  const checked = values.includes(option)
                  return (
                    <label
                      key={option}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleValue(option)}
                        className="rounded border-gray-300 text-brand-700 focus:ring-brand-500"
                      />
                      <span className="truncate">{option}</span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function CourseCard({ course, materials, onEdit }) {
  const navigate = useNavigate()
  const color = getTrailColor(course.primaryTrail)
  const alert = deadlineBadge(course.deadline)

  const courseMaterials = materials.filter((material) => material.course === course.name)
  const completedSessions = courseMaterials.filter((material) => ['concluido', 'aprovado'].includes(material.status)).length
  const progress = course.totalSessions > 0 ? Math.round((completedSessions / course.totalSessions) * 100) : 0

  return (
    <div className="card overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <div className="relative h-36 overflow-hidden">
        {course.image ? (
          <img src={course.image} alt={course.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${color.grad} flex items-center justify-center`}>
            <span className="text-white/25 font-black text-6xl select-none">{course.name[0]}</span>
          </div>
        )}

        <div className="absolute left-3 bottom-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold bg-white/90 backdrop-blur-sm ${color.pill}`}>
            {course.primaryTrail}
          </span>
        </div>

        {alert && (
          <div className="absolute top-3 right-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${alert.cls}`}>
              {alert.label}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{course.name}</h3>
          <p className="text-xs font-medium text-gray-600 mt-1">{course.trail || '--'}</p>
          <p className="text-xs text-gray-500 mt-1">Supervisor: {course.supervisorName || '--'}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
          <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Coordenador</div>
            <div className="font-medium text-gray-700">{course.coordinatorName || '--'}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2 border border-gray-100">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Carga horaria</div>
            <div className="font-medium text-gray-700">{course.totalSessions} sessoes</div>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Progresso</span>
            <span className={`text-2xl font-black leading-none ${color.accent}`}>{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: color.bar }}
            />
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            {completedSessions} de {course.totalSessions} sessoes concluidas
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-gray-500 pt-0.5">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: color.bar }}
            >
              {getInitials(course.coordinatorName || course.supervisorName || course.name)}
            </div>
            <span className="truncate">{course.coordinatorName || 'Coordenador nao informado'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-gray-400" />
              <span>{formatDate(course.startDate)}</span>
            </div>
            <span className="text-gray-300">.</span>
            <div className={`flex items-center gap-1 ${alert ? 'text-amber-600 font-medium' : ''}`}>
              <Clock size={11} className={alert ? 'text-amber-500' : 'text-gray-400'} />
              <span>{formatDate(course.deadline)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
          <button
            onClick={() => navigate('/producao', { state: { course: course.name } })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color.bar }}
          >
            Ver producao
            <ChevronRight size={13} />
          </button>
          <button
            onClick={() => onEdit(course)}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}

function CourseModal({ course, open, onClose, onSave, saving = false, error = null }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => course || {
    name: '',
    primaryTrail: '',
    trail: '',
    totalSessions: 12,
    supervisorName: '',
    coordinatorName: '',
    startDate: '',
    deadline: '',
    image: null,
  })

  const handleChange = (event) => {
    const { name, value } = event.target
    if (name === 'primaryTrail') {
      setForm((current) => ({
        ...current,
        primaryTrail: value,
        trail: '',
      }))
      return
    }

    setForm((current) => ({
      ...current,
      [name]: name === 'totalSessions' ? Number(value) : value,
    }))
  }

  const handleImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      setForm((current) => ({ ...current, image: loadEvent.target?.result || null }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await onSave({
      ...form,
      totalSessions: Number(form.totalSessions) || 0,
    })
  }

  const color = getTrailColor(form.primaryTrail)
  const secondaryTrailOptions = form.primaryTrail ? PRIMARY_TRAILS[form.primaryTrail] || [] : []

  return (
    <Modal open={open} onClose={onClose} title={form.id ? 'Editar curso' : 'Novo curso'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Capa do curso</label>
          <div
            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {form.image ? (
              <>
                <img src={form.image} alt="capa" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <span className="text-white text-xs font-medium flex items-center gap-1.5">
                    <Camera size={14} /> Trocar capa
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setForm((current) => ({ ...current, image: null }))
                    }}
                    className="text-red-300 hover:text-red-200 text-xs flex items-center gap-1"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
              </>
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${form.trail ? color.grad : 'from-gray-300 to-gray-400'} flex flex-col items-center justify-center gap-1.5 group-hover:opacity-80 transition-opacity`}>
                <Camera size={20} className="text-white/70" />
                <span className="text-white/80 text-xs">Clique para adicionar capa</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do curso *</label>
            <input
              name="name"
              value={form.name || ''}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Ex: Lingua Portuguesa - 8 Ano"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Trilha principal *</label>
            <select
              name="primaryTrail"
              value={form.primaryTrail || ''}
              onChange={handleChange}
              required
              className="select-field"
            >
              <option value="">Selecionar trilha principal...</option>
              {Object.keys(PRIMARY_TRAILS).map((trail) => (
                <option key={trail} value={trail}>{trail}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Trilha secundaria *</label>
            <select
              name="trail"
              value={form.trail || ''}
              onChange={handleChange}
              required
              className="select-field"
              disabled={!form.primaryTrail}
            >
              <option value="">{form.primaryTrail ? 'Selecionar trilha secundaria...' : 'Escolha a trilha principal primeiro'}</option>
              {secondaryTrailOptions.map((trail) => (
                <option key={trail} value={trail}>{trail}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Carga horaria total *</label>
            <input
              name="totalSessions"
              type="number"
              min={1}
              value={form.totalSessions || ''}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Ex: 12"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Supervisor responsavel *</label>
            <input
              name="supervisorName"
              value={form.supervisorName || ''}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Nome do supervisor"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Coordenador *</label>
            <input
              name="coordinatorName"
              value={form.coordinatorName || ''}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="Nome do coordenador"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de inicio</label>
            <input
              name="startDate"
              type="date"
              value={form.startDate || ''}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prazo de entrega</label>
            <input
              name="deadline"
              type="date"
              value={form.deadline || ''}
              onChange={handleChange}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          {error && (
            <div className="mr-auto text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Criar curso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Cursos() {
  const { user } = useAuth()
  const { materials, courses, coursesLoading, coursesError, saveCourse } = useData()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editCourse, setEditCourse] = useState(null)
  const [savingCourse, setSavingCourse] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [filters, setFilters] = useState({
    primaryTrails: [],
    trails: [],
    courses: [],
    supervisors: [],
    coordinators: [],
  })

  const canManage = user?.role === 'administrador' || user?.role === 'supervisor'

  const filterOptions = useMemo(() => ({
    primaryTrails: Array.from(new Set(courses.map((course) => course.primaryTrail).filter(Boolean))),
    trails: Array.from(new Set(courses.map((course) => course.trail).filter(Boolean))),
    courses: Array.from(new Set(courses.map((course) => course.name).filter(Boolean))),
    supervisors: Array.from(new Set(courses.map((course) => course.supervisorName).filter(Boolean))),
    coordinators: Array.from(new Set(courses.map((course) => course.coordinatorName).filter(Boolean))),
  }), [courses])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return courses.filter((course) => {
      if (filters.primaryTrails.length > 0 && !filters.primaryTrails.includes(course.primaryTrail)) return false
      if (filters.trails.length > 0 && !filters.trails.includes(course.trail)) return false
      if (filters.courses.length > 0 && !filters.courses.includes(course.name)) return false
      if (filters.supervisors.length > 0 && !filters.supervisors.includes(course.supervisorName)) return false
      if (filters.coordinators.length > 0 && !filters.coordinators.includes(course.coordinatorName)) return false

      if (!query) return true

      return [
        course.name,
        course.primaryTrail,
        course.trail,
        course.supervisorName,
        course.coordinatorName,
      ].some((value) => (value || '').toLowerCase().includes(query))
    })
  }, [courses, filters, search])

  const handleSave = async (form) => {
    setSavingCourse(true)
    setSaveError(null)

    try {
      await saveCourse(form)
      setModalOpen(false)
      setEditCourse(null)
    } catch (error) {
      setSaveError(error.message || 'Erro ao salvar curso.')
    } finally {
      setSavingCourse(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      trails: [],
      primaryTrails: [],
      courses: [],
      supervisors: [],
      coordinators: [],
    })
    setSearch('')
  }

  const openNew = () => {
    setEditCourse(null)
    setSaveError(null)
    setModalOpen(true)
  }

  const openEdit = (course) => {
    setEditCourse(course)
    setSaveError(null)
    setModalOpen(true)
  }

  const totalCompleted = courses.reduce((total, course) => {
    const courseMaterials = materials.filter((material) => material.course === course.name)
    return total + courseMaterials.filter((material) => ['concluido', 'aprovado'].includes(material.status)).length
  }, 0)

  const totalSessions = courses.reduce((total, course) => total + Number(course.totalSessions || 0), 0)
  const overallProgress = totalSessions > 0 ? Math.round((totalCompleted / totalSessions) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Cursos</h1>
          <p className="page-subtitle">Cadastre os cursos por trilha e acompanhe o progresso de producao.</p>
        </div>
        {canManage && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={15} />
            Novo curso
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
            <BookOpen size={16} className="text-brand-700" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{courses.length}</div>
            <div className="text-xs text-gray-500">Cursos ativos</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <span className="text-sm font-black text-purple-700">{overallProgress}%</span>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{overallProgress}%</div>
            <div className="text-xs text-gray-500">Progresso geral</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <span className="text-sm font-black text-green-700">{totalCompleted}</span>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{totalCompleted}/{totalSessions}</div>
            <div className="text-xs text-gray-500">Sessoes concluidas</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <Users size={16} className="text-amber-700" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{filterOptions.supervisors.length}</div>
            <div className="text-xs text-gray-500">Supervisores mapeados</div>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <SlidersHorizontal size={16} className="text-gray-400" />
          Filtros
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
          <MultiSelectFilter
            label="Trilha principal"
            placeholder="Todas as trilhas principais"
            options={filterOptions.primaryTrails}
            values={filters.primaryTrails}
            onChange={(values) => setFilters((current) => ({ ...current, primaryTrails: values }))}
          />
          <MultiSelectFilter
            label="Trilha secundaria"
            placeholder="Todas as trilhas secundarias"
            options={filterOptions.trails}
            values={filters.trails}
            onChange={(values) => setFilters((current) => ({ ...current, trails: values }))}
          />
          <MultiSelectFilter
            label="Curso"
            placeholder="Todos os cursos"
            options={filterOptions.courses}
            values={filters.courses}
            onChange={(values) => setFilters((current) => ({ ...current, courses: values }))}
          />
          <MultiSelectFilter
            label="Supervisor"
            placeholder="Todos os supervisores"
            options={filterOptions.supervisors}
            values={filters.supervisors}
            onChange={(values) => setFilters((current) => ({ ...current, supervisors: values }))}
          />
          <MultiSelectFilter
            label="Coordenador"
            placeholder="Todos os coordenadores"
            options={filterOptions.coordinators}
            values={filters.coordinators}
            onChange={(values) => setFilters((current) => ({ ...current, coordinators: values }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar curso, trilha, supervisor ou coordenador..."
              className="input-field pl-9 pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button type="button" onClick={clearFilters} className="btn-secondary">
            Limpar filtros
          </button>
        </div>
      </div>

      {coursesError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {coursesError}
        </div>
      )}

      {coursesLoading ? (
        <div className="card p-12 text-center text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-40 animate-pulse" />
          <p className="text-sm">Carregando cursos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum curso encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} materials={materials} onEdit={openEdit} />
          ))}
        </div>
      )}

      <CourseModal
        key={editCourse?.id ?? 'new'}
        course={editCourse}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={savingCourse}
        error={saveError}
      />
    </div>
  )
}
