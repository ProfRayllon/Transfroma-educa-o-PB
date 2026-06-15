import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Calendar, ChevronRight, Search, Clock, X, Camera, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { mockUsers } from '../data/mockData'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const TRAIL_OPTIONS = [
  'Trilha Institucional',
  'Educação Socioemocional',
  'Educação, Ciência e Tecnologia',
  'Gestão Pedagógica',
  'Educação Inclusiva',
  'BNCC',
]

const TRAIL_COLORS = {
  'Trilha Institucional':            { pill: 'bg-purple-100 text-purple-700 border-purple-200', bar: '#7C3AED', grad: 'from-purple-500 to-purple-700', pct: 'text-purple-700' },
  'Educação Socioemocional':         { pill: 'bg-rose-100 text-rose-700 border-rose-200',       bar: '#E11D48', grad: 'from-rose-400 to-rose-600',     pct: 'text-rose-600'   },
  'Educação, Ciência e Tecnologia':  { pill: 'bg-blue-100 text-blue-700 border-blue-200',       bar: '#0369A1', grad: 'from-blue-500 to-blue-700',     pct: 'text-blue-700'   },
  'Gestão Pedagógica':               { pill: 'bg-amber-100 text-amber-700 border-amber-200',    bar: '#D97706', grad: 'from-amber-400 to-amber-600',   pct: 'text-amber-600'  },
  'Educação Inclusiva':              { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', bar: '#059669', grad: 'from-emerald-500 to-emerald-700', pct: 'text-emerald-700' },
  'BNCC':                            { pill: 'bg-teal-100 text-teal-700 border-teal-200',       bar: '#0D9488', grad: 'from-teal-500 to-teal-700',     pct: 'text-teal-700'   },
}

function getTrailColor(trail) {
  return TRAIL_COLORS[trail] || { pill: 'bg-gray-100 text-gray-700 border-gray-200', bar: '#6B7280', grad: 'from-gray-400 to-gray-600', pct: 'text-gray-700' }
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function deadlineBadge(deadline) {
  if (!deadline) return null
  const diff = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return { label: 'Prazo vencido', cls: 'text-red-600 bg-red-50 border border-red-200' }
  if (diff <= 14) return { label: 'Prazo próximo', cls: 'text-orange-600 bg-orange-50 border border-orange-200' }
  return null
}

function CourseCard({ course, materials, onEdit }) {
  const navigate = useNavigate()
  const color = getTrailColor(course.trail)
  const alert = deadlineBadge(course.deadline)

  const courseMaterials = materials.filter(m => m.course === course.name)
  const approved = courseMaterials.filter(m => ['concluido', 'aprovado'].includes(m.status)).length
  const progress = course.totalSessions > 0
    ? Math.round((approved / course.totalSessions) * 100)
    : 0

  return (
    <div className="card overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
      {/* Image / Placeholder */}
      <div className="relative h-32 overflow-hidden">
        {course.image ? (
          <img src={course.image} alt={course.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${color.grad} flex items-center justify-center`}>
            <span className="text-white/30 font-black text-6xl select-none leading-none">
              {course.name[0]}
            </span>
          </div>
        )}
        {/* Trail pill over image */}
        <div className="absolute bottom-2.5 left-3">
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm bg-white/90 ${color.pill.split(' ').filter(c => c.startsWith('text-')).join(' ')} border-white/60`}>
            {course.trail}
          </span>
        </div>
        {alert && (
          <div className="absolute top-2.5 right-2.5">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${alert.cls}`}>
              {alert.label}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Name */}
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{course.name}</h3>

        {/* Progress — destaque principal */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Progresso</span>
            <span className={`text-2xl font-black leading-none ${color.pct}`}>{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, backgroundColor: color.bar }}
            />
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            {approved} de {course.totalSessions} sessões concluídas
          </div>
        </div>

        {/* Coordinator + dates */}
        <div className="space-y-1.5 text-xs text-gray-500 pt-0.5">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
              style={{ backgroundColor: color.bar }}
            >
              {getInitials(course.responsibleName)}
            </div>
            <span className="truncate">{course.responsibleName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar size={11} className="text-gray-400" />
              <span>{formatDate(course.startDate)}</span>
            </div>
            <span className="text-gray-300">·</span>
            <div className={`flex items-center gap-1 ${alert ? 'text-orange-500 font-medium' : ''}`}>
              <Clock size={11} className={alert ? 'text-orange-400' : 'text-gray-400'} />
              <span>{formatDate(course.deadline)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
          <button
            onClick={() => navigate('/producao', { state: { course: course.name } })}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color.bar }}
          >
            Ver produção
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

function CourseModal({ course, open, onClose, onSave }) {
  const producers = mockUsers.filter(u => ['professor', 'supervisor', 'administrador'].includes(u.role))
  const fileRef = useRef(null)
  const [form, setForm] = useState(() => course || {
    name: '', trail: '', totalSessions: 12,
    responsibleId: '', responsibleName: '', startDate: '', deadline: '', image: null,
  })

  const handleChange = e => {
    const { name, value } = e.target
    if (name === 'responsibleId') {
      const user = producers.find(u => u.id === Number(value))
      setForm(f => ({ ...f, responsibleId: Number(value), responsibleName: user?.name || '' }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const handleImage = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, image: ev.target.result }))
    reader.readAsDataURL(file)
  }

  const handleSubmit = e => {
    e.preventDefault()
    onSave({ ...form, id: form.id || Date.now() })
    onClose()
  }

  const color = getTrailColor(form.trail)

  return (
    <Modal open={open} onClose={onClose} title={form.id ? 'Editar curso' : 'Novo curso'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image upload */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Foto do curso</label>
          <div
            className="relative h-28 rounded-xl overflow-hidden cursor-pointer group border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {form.image ? (
              <>
                <img src={form.image} alt="capa" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <span className="text-white text-xs font-medium flex items-center gap-1.5">
                    <Camera size={14} /> Trocar foto
                  </span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image: null })) }}
                    className="text-red-300 hover:text-red-200 text-xs flex items-center gap-1"
                  >
                    <Trash2 size={13} /> Remover
                  </button>
                </div>
              </>
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${form.trail ? color.grad : 'from-gray-300 to-gray-400'} flex flex-col items-center justify-center gap-1.5 group-hover:opacity-80 transition-opacity`}>
                <Camera size={20} className="text-white/70" />
                <span className="text-white/80 text-xs">Clique para adicionar foto</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome do curso *</label>
            <input name="name" value={form.name || ''} onChange={handleChange} required className="input-field" placeholder="Ex: Língua Portuguesa – 8º Ano" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Trilha *</label>
            <select name="trail" value={form.trail || ''} onChange={handleChange} required className="select-field">
              <option value="">Selecionar trilha...</option>
              {TRAIL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Total de sessões *</label>
            <input name="totalSessions" type="number" min={1} value={form.totalSessions || ''} onChange={handleChange} required className="input-field" placeholder="Ex: 12" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Coordenador responsável</label>
            <select name="responsibleId" value={form.responsibleId || ''} onChange={handleChange} className="select-field">
              <option value="">Selecionar...</option>
              {producers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de início</label>
            <input name="startDate" type="date" value={form.startDate || ''} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prazo de entrega</label>
            <input name="deadline" type="date" value={form.deadline || ''} onChange={handleChange} className="input-field" />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary">
            {form.id ? 'Salvar alterações' : 'Criar curso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Cursos() {
  const { user } = useAuth()
  const { materials, courses, setCourses } = useData()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editCourse, setEditCourse] = useState(null)

  const canManage = user?.role === 'administrador' || user?.role === 'supervisor'

  const filtered = useMemo(() => {
    if (!search.trim()) return courses
    const q = search.toLowerCase()
    return courses.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.trail || '').toLowerCase().includes(q) ||
      c.responsibleName.toLowerCase().includes(q)
    )
  }, [courses, search])

  const handleSave = (form) => {
    if (form.id && courses.find(c => c.id === form.id)) {
      setCourses(prev => prev.map(c => c.id === form.id ? form : c))
    } else {
      setCourses(prev => [...prev, form])
    }
  }

  const openNew = () => { setEditCourse(null); setModalOpen(true) }
  const openEdit = (course) => { setEditCourse(course); setModalOpen(true) }

  const totalApproved = courses.reduce((acc, c) => {
    const mats = materials.filter(m => m.course === c.name)
    return acc + mats.filter(m => ['concluido', 'aprovado'].includes(m.status)).length
  }, 0)
  const totalSessions = courses.reduce((acc, c) => acc + c.totalSessions, 0)
  const overallProgress = totalSessions > 0 ? Math.round((totalApproved / totalSessions) * 100) : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Cursos</h1>
          <p className="page-subtitle">Gerencie os cursos e acompanhe o progresso de produção.</p>
        </div>
        {canManage && (
          <button onClick={openNew} className="btn-primary">
            <Plus size={15} />
            Novo curso
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
            <span className="text-sm font-black text-green-700">{totalApproved}</span>
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900">{totalApproved}/{totalSessions}</div>
            <div className="text-xs text-gray-500">Sessões concluídas</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar curso ou trilha..."
          className="input-field pl-9 pr-8"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum curso encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              materials={materials}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      <CourseModal
        key={editCourse?.id ?? 'new'}
        course={editCourse}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
