import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, GripVertical, CheckCircle, Circle, Send, Rocket, Trash2, Pencil, Eye,
  Link2, ChevronRight, ThumbsUp, ThumbsDown, AlertTriangle, MessageSquare,
  Layers, FileText, Clock,
} from 'lucide-react'
import Badge from '../ui/Badge'
import StatCard from '../ui/StatCard'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import api, { getApiErrorMessage } from '../../lib/api'
import {
  PROFESSOR_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
  getMaterialResponsibles,
  TypeBadge,
  LinkChip,
  StackedAvatars,
  MiniAvatar,
  InlineStatusSelect,
} from './shared'

const STAGE_STEPS = [
  { key: 'producao', label: 'Produção' },
  { key: 'supervisao', label: 'Supervisão' },
  { key: 'coordenacao', label: 'Coordenação' },
  { key: 'publicado', label: 'Publicado' },
]

const ACTION_LABELS = {
  enviar_supervisao: 'enviou o módulo para supervisão',
  aprovar_supervisor: 'aprovou o módulo na supervisão',
  ajustes_supervisor: 'solicitou ajustes na supervisão',
  aprovar_coordenador: 'aprovou o módulo na coordenação',
  ajustes_coordenador: 'solicitou ajustes na coordenação',
  reprovar_coordenador: 'reprovou o módulo na coordenação',
  publicar: 'publicou o módulo',
}

const ROLE_LABELS = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  coordenador: 'Coordenador(a)',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio técnico',
  gestao: 'Gestão de pessoas',
}

const FLUXO_SUGERIDO = [
  'Professor cria e estrutura os conteúdos do módulo.',
  'Envia para supervisão ao finalizar a produção.',
  'Supervisor analisa e aprova ou solicita ajustes.',
  'Após aprovação, envia para coordenação.',
  'Coordenadora realiza aprovação final.',
  'Módulo é publicado e disponível para o curso.',
]

const EMPTY_CONTENT_FORM = {
  type: '',
  theme: '',
  objective: '',
  duration: '',
  deliveryDate: '',
  responsibleId: '',
  originalLink: '',
  adjustedLink: '',
  status: 'nao_iniciado',
}

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '—'
}

function formatDateOnly(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function getModuleStatusKey(m) {
  if (!m) return 'rascunho'
  if (m.stage === 'publicado') return 'publicado'
  if (m.stage === 'producao') {
    if (m.coordinatorStatus === 'reprovado') return 'reprovado'
    if (m.supervisorStatus === 'ajustes' || m.coordinatorStatus === 'ajustes') return 'em_revisao'
    if (m.professorStatus === 'em_producao') return 'em_producao'
    return 'rascunho'
  }
  if (m.stage === 'supervisao') return 'em_validacao'
  if (m.stage === 'coordenacao') return m.coordinatorStatus === 'aprovado' ? 'aprovado' : 'em_validacao'
  return 'rascunho'
}

function professorStatusBadgeKey(status) {
  if (status === 'concluido') return 'concluido'
  if (status === 'em_producao') return 'em_producao'
  return 'rascunho'
}

/* ─── content modal ─── */

function ContentModal({ open, onClose, onSave, saving, module, course, editing }) {
  const [form, setForm] = useState(EMPTY_CONTENT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      const responsibles = getMaterialResponsibles(editing)
      setForm({
        type: Array.isArray(editing.type) ? (editing.type[0] || '') : (editing.type || ''),
        theme: editing.theme || '',
        objective: editing.objective || '',
        duration: editing.duration || '',
        deliveryDate: editing.deliveryDate || '',
        responsibleId: responsibles[0]?.id || '',
        originalLink: editing.originalLink || '',
        adjustedLink: editing.adjustedLink || '',
        status: editing.status || 'nao_iniciado',
      })
    } else {
      setForm({ ...EMPTY_CONTENT_FORM, responsibleId: module?.teacherId || '' })
    }
    setError('')
  }, [open, editing, module?.teacherId])

  const producers = course.producers || []

  const handleSubmit = () => {
    if (!form.type) { setError('Selecione o tipo de material.'); return }
    if (!form.theme.trim()) { setError('Informe o título do conteúdo.'); return }
    if (!form.responsibleId) { setError('Selecione o responsável pelo conteúdo.'); return }

    const responsible = producers.find(p => Number(p.id) === Number(form.responsibleId))
    onSave({
      ...(editing ? { id: editing.id } : {}),
      ...form,
      responsibleId: responsible?.id,
      responsibleName: responsible?.name,
      responsibleRole: responsible?.function || '',
      responsibles: responsible ? [{ id: responsible.id, name: responsible.name, role: responsible.function || '' }] : [],
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar conteúdo' : 'Novo conteúdo'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            <CheckCircle size={15} />
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Adicionar conteúdo'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {error && (
          <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de material <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {MATERIAL_TYPE_OPTIONS.map(option => {
              const selected = form.type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: selected ? '' : option.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selected ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-700'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Título <span className="text-red-500">*</span></label>
          <input value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} className="input-field" placeholder="Título do conteúdo" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Objetivo de aprendizagem</label>
          <textarea value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Descreva o objetivo de aprendizagem..." />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tempo estimado</label>
          <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="input-field" placeholder="Ex: 50 min" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de entrega</label>
          <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} className="input-field" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsável <span className="text-red-500">*</span></label>
          <select value={form.responsibleId} onChange={e => setForm(f => ({ ...f, responsibleId: e.target.value }))} className="select-field">
            <option value="">Selecionar responsável...</option>
            {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {producers.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum professor/produtor vinculado ao curso.</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Material original</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.originalLink} onChange={e => setForm(f => ({ ...f, originalLink: e.target.value }))} className="input-field pl-9" placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Material ajustado</label>
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.adjustedLink} onChange={e => setForm(f => ({ ...f, adjustedLink: e.target.value }))} className="input-field pl-9" placeholder="https://..." />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="select-field">
            {PROFESSOR_STATUS_OPTIONS.filter(o => o.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  )
}

/* ─── new module modal ─── */

function NewModuleModal({ open, onClose, onCreate, saving }) {
  const [title, setTitle] = useState('')

  useEffect(() => { if (open) setTitle('') }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo módulo"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={() => onCreate(title)} className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? 'Criando...' : 'Criar módulo'}
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-gray-600 mb-1.5">Título do módulo <span className="text-red-500">*</span></label>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="input-field"
        placeholder="Ex: Módulo 1 - Comunicação e Rotina Digital"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onCreate(title) }}
      />
      <p className="text-xs text-gray-400 mt-2">Você poderá completar descrição, responsáveis e prazo em seguida.</p>
    </Modal>
  )
}

/* ─── main component ─── */

export default function ModulosWorkspace({ course }) {
  const { user } = useAuth()
  const { materials, materialAssignees, courseParticipants, saveMaterial, deleteMaterial, updateMaterialStatus, updateMaterialSession, loadCourses } = useData()

  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeModuleId, setActiveModuleId] = useState(null)
  const [moduleSearch, setModuleSearch] = useState('')
  const [contentSearch, setContentSearch] = useState('')
  const [form, setForm] = useState(null)
  const [savingModule, setSavingModule] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [noteDrafts, setNoteDrafts] = useState({ supervisor: '', coordenador: '' })
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [toast, setToast] = useState(null)
  const [newModuleOpen, setNewModuleOpen] = useState(false)
  const [creatingModule, setCreatingModule] = useState(false)
  const [confirmDeleteModule, setConfirmDeleteModule] = useState(null)
  const [contentModalOpen, setContentModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [viewContent, setViewContent] = useState(null)
  const [confirmDeleteContent, setConfirmDeleteContent] = useState(null)
  const [savingContent, setSavingContent] = useState(false)
  const [dragModuleId, setDragModuleId] = useState(null)
  const [dragOverModuleId, setDragOverModuleId] = useState(null)
  const [dragContentId, setDragContentId] = useState(null)
  const [dragOverContentId, setDragOverContentId] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get(`/courses/${course.id}/modules`)
        if (!active) return
        setModules(data)
        setActiveModuleId(current => (current && data.some(m => m.id === current)) ? current : (data[0]?.id ?? null))
        // O backend pode ter acabado de vincular conteudos orfaos a um modulo padrao;
        // recarrega os materiais para refletir esse vinculo sem precisar recarregar a pagina.
        await loadCourses()
      } catch (err) {
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar módulos.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [course.id])

  const activeModule = useMemo(() => modules.find(m => m.id === activeModuleId) || null, [modules, activeModuleId])

  useEffect(() => {
    if (!activeModule) { setForm(null); return }
    setForm({
      title: activeModule.title || '',
      description: activeModule.description || '',
      workload: activeModule.workload || '',
      teacherId: activeModule.teacherId || '',
      supervisorId: activeModule.supervisorId || '',
      coordinatorId: activeModule.coordinatorId || '',
      deadline: activeModule.deadline || '',
    })
    setNoteDrafts({ supervisor: '', coordenador: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleId])

  const isAdmin = user?.role === 'administrador'
  const isCoordinatorUser = user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')
  const isProducer = user?.role === 'professor' && course.producers?.some(p => Number(p.id) === Number(user.id))
  const isCourseSupervisor = user?.role === 'supervisor' && (course.supervisorId === user.id || course.supervisorName === user.name)
  const isCourseCoordinator = isCoordinatorUser && (course.coordinatorId === user.id || course.coordinatorName === user.name)
  const canManageModules = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator

  const isModuleSupervisor = (m) => user?.role === 'supervisor' && (m?.supervisorId === user.id || m?.supervisorName === user.name)
  const isModuleCoordinator = (m) => isCoordinatorUser && (m?.coordinatorId === user.id || m?.coordinatorName === user.name)

  const canEditCore = !!activeModule && (isAdmin || ((isProducer || isCourseSupervisor || isCourseCoordinator) && activeModule.stage === 'producao'))
  const canActSupervisor = !!activeModule && (isAdmin || isModuleSupervisor(activeModule))
  const canActCoordinator = !!activeModule && (isAdmin || isModuleCoordinator(activeModule))
  const canEditContent = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  const contentLocked = !!activeModule && activeModule.stage !== 'producao' && !isAdmin

  const courseMaterials = useMemo(
    () => materials.filter(m => Number(m.courseId) === Number(course.id) || m.course === course.name),
    [materials, course.id, course.name]
  )

  const moduleContentCounts = useMemo(() => {
    const counts = {}
    courseMaterials.forEach(m => {
      if (!m.moduleId) return
      counts[m.moduleId] = (counts[m.moduleId] || 0) + 1
    })
    return counts
  }, [courseMaterials])

  const moduleContents = useMemo(() => {
    if (!activeModule) return []
    return courseMaterials
      .filter(m => Number(m.moduleId) === Number(activeModule.id))
      .filter(m => !contentSearch || m.theme?.toLowerCase().includes(contentSearch.toLowerCase()))
      .sort((a, b) => Number(a.session) - Number(b.session))
  }, [courseMaterials, activeModule, contentSearch])

  const stats = useMemo(() => ({
    modulos: modules.length,
    conteudos: courseMaterials.length,
    emProducao: modules.filter(m => m.stage === 'producao').length,
    aguardando: modules.filter(m => m.stage === 'supervisao' || (m.stage === 'coordenacao' && m.coordinatorStatus !== 'aprovado')).length,
    aprovados: modules.filter(m => (m.stage === 'coordenacao' && m.coordinatorStatus === 'aprovado') || m.stage === 'publicado').length,
  }), [modules, courseMaterials])

  const filteredModules = useMemo(() => {
    if (!moduleSearch) return modules
    const q = moduleSearch.toLowerCase()
    return modules.filter(m => m.title?.toLowerCase().includes(q))
  }, [modules, moduleSearch])

  /* ── module actions ── */

  const handleCreateModule = async (title) => {
    setCreatingModule(true)
    try {
      const { data } = await api.post(`/courses/${course.id}/modules`, { title: title.trim() })
      setModules(prev => [...prev, data])
      setActiveModuleId(data.id)
      setNewModuleOpen(false)
      showToast('Módulo criado! Complete os dados abaixo.')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao criar módulo.'), 'error')
    } finally {
      setCreatingModule(false)
    }
  }

  const handleSaveCore = async () => {
    if (!activeModule || !form) return
    if (!form.title.trim()) { showToast('Informe o título do módulo.', 'error'); return }
    setSavingModule(true)
    try {
      const { data } = await api.put(`/modules/${activeModule.id}`, form)
      setModules(prev => prev.map(m => m.id === data.id ? data : m))
      showToast('Módulo atualizado!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar módulo.'), 'error')
    } finally {
      setSavingModule(false)
    }
  }

  const runAction = async (action, noteKey) => {
    if (!activeModule) return
    const note = noteKey ? (noteDrafts[noteKey] || '').trim() : ''
    if (['ajustes_supervisor', 'ajustes_coordenador', 'reprovar_coordenador'].includes(action) && !note) {
      showToast('Escreva um parecer antes de continuar.', 'error')
      return
    }
    setBusyAction(action)
    try {
      const { data } = await api.patch(`/modules/${activeModule.id}/status`, { action, note })
      setModules(prev => prev.map(m => m.id === data.id ? data : m))
      if (noteKey) setNoteDrafts(prev => ({ ...prev, [noteKey]: '' }))
      showToast('Status do módulo atualizado!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar módulo.'), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePostComment = async () => {
    const message = commentDraft.trim()
    if (!message || !activeModule) return
    setPostingComment(true)
    try {
      const { data: event } = await api.post(`/modules/${activeModule.id}/comments`, { message })
      setModules(prev => prev.map(m => m.id === activeModule.id ? { ...m, events: [...(m.events || []), event] } : m))
      setCommentDraft('')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao comentar.'), 'error')
    } finally {
      setPostingComment(false)
    }
  }

  const handleDeleteModule = async () => {
    if (!confirmDeleteModule) return
    try {
      await api.delete(`/modules/${confirmDeleteModule.id}`)
      setModules(prev => prev.filter(m => m.id !== confirmDeleteModule.id))
      setActiveModuleId(prev => (prev === confirmDeleteModule.id ? null : prev))
      showToast('Módulo excluído com sucesso!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao excluir módulo.'), 'error')
    } finally {
      setConfirmDeleteModule(null)
    }
  }

  const handleModuleDragStart = (e, m) => { setDragModuleId(m.id); e.dataTransfer.effectAllowed = 'move' }
  const handleModuleDragOver = (e, m) => { e.preventDefault(); if (m.id !== dragModuleId) setDragOverModuleId(m.id) }
  const handleModuleDragEnd = () => { setDragModuleId(null); setDragOverModuleId(null) }
  const handleModuleDrop = async (e, target) => {
    e.preventDefault()
    setDragOverModuleId(null)
    if (!dragModuleId || dragModuleId === target.id) { setDragModuleId(null); return }
    const src = modules.find(m => m.id === dragModuleId)
    if (!src) { setDragModuleId(null); return }
    const srcOrder = src.order
    const tgtOrder = target.order
    setModules(prev => prev.map(m => {
      if (m.id === src.id) return { ...m, order: tgtOrder }
      if (m.id === target.id) return { ...m, order: srcOrder }
      return m
    }))
    try {
      await Promise.all([
        api.patch(`/modules/${src.id}/order`, { order: tgtOrder }),
        api.patch(`/modules/${target.id}/order`, { order: srcOrder }),
      ])
    } catch {
      showToast('Erro ao reordenar módulos.', 'error')
    }
    setDragModuleId(null)
  }

  /* ── content actions ── */

  const handleSaveContent = async (payload) => {
    if (!activeModule) return
    setSavingContent(true)
    try {
      const isNew = !payload.id
      if (isNew) {
        payload.session = moduleContents.length + 1
      }
      await saveMaterial({
        ...payload,
        course: course.name,
        courseId: course.id,
        moduleId: activeModule.id,
      })
      showToast(payload.id ? 'Conteúdo atualizado!' : 'Conteúdo adicionado!')
      setContentModalOpen(false)
    } catch (err) {
      showToast(err.message || 'Erro ao salvar conteúdo.', 'error')
    } finally {
      setSavingContent(false)
    }
  }

  const handleContentStatusChange = async (mat, value) => {
    try {
      await updateMaterialStatus(mat.id, { status: value })
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar status.'), 'error')
    }
  }

  const handleDeleteContent = async () => {
    if (!confirmDeleteContent) return
    try {
      await deleteMaterial(confirmDeleteContent.id)
      showToast('Conteúdo excluído com sucesso!')
    } catch {
      showToast('Erro ao excluir conteúdo.', 'error')
    } finally {
      setConfirmDeleteContent(null)
    }
  }

  const handleContentDragStart = (e, mat) => { setDragContentId(mat.id); e.dataTransfer.effectAllowed = 'move' }
  const handleContentDragOver = (e, mat) => { e.preventDefault(); if (mat.id !== dragContentId) setDragOverContentId(mat.id) }
  const handleContentDragEnd = () => { setDragContentId(null); setDragOverContentId(null) }
  const handleContentDrop = async (e, target) => {
    e.preventDefault()
    setDragOverContentId(null)
    if (!dragContentId || dragContentId === target.id) { setDragContentId(null); return }
    const src = moduleContents.find(m => m.id === dragContentId)
    if (!src) { setDragContentId(null); return }
    const srcSession = Number(src.session)
    const tgtSession = Number(target.session)
    try {
      await Promise.all([
        updateMaterialSession(src.id, tgtSession),
        updateMaterialSession(target.id, srcSession),
      ])
    } catch {
      showToast('Erro ao reordenar conteúdos.', 'error')
    }
    setDragContentId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  const checklist = activeModule ? [
    { label: 'Título preenchido', done: !!activeModule.title },
    { label: 'Descrição adicionada', done: !!activeModule.description },
    { label: 'Responsáveis definidos', done: !!(activeModule.teacherId && activeModule.supervisorId && activeModule.coordinatorId) },
    { label: 'Conteúdos vinculados', done: moduleContents.length > 0 },
    { label: 'Revisão do supervisor', done: activeModule.supervisorStatus === 'aprovado' },
    { label: 'Aprovação da coordenação', done: activeModule.coordinatorStatus === 'aprovado' },
  ] : []

  const events = activeModule?.events || []
  const lastEvent = events.length ? events[events.length - 1] : null
  const lastSendEvent = [...events].reverse().find(ev => ev.action === 'enviar_supervisao')
  const canPublish = !!activeModule && (isAdmin || canActCoordinator) && activeModule.stage === 'coordenacao' && activeModule.coordinatorStatus === 'aprovado'
  const canDeleteModule = !!activeModule && canManageModules && (isAdmin || activeModule.stage === 'producao')
  const stageIndex = activeModule ? STAGE_STEPS.findIndex(s => s.key === activeModule.stage) : 0

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Layers} iconBg="bg-brand-100" iconColor="text-brand-700" value={stats.modulos} label="Módulos" />
        <StatCard icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-700" value={stats.conteudos} label="Conteúdos" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" value={stats.emProducao} label="Em produção" />
        <StatCard icon={Eye} iconBg="bg-purple-100" iconColor="text-purple-700" value={stats.aguardando} label="Aguardando validação" />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600" value={stats.aprovados} label="Aprovados" />
      </div>

      <div className="flex items-center justify-end">
        <button onClick={() => setNewModuleOpen(true)} className="btn-secondary text-sm">
          <Plus size={14} />
          Novo módulo
        </button>
      </div>

      {modules.length === 0 ? (
        <div className="card flex flex-col items-center justify-center text-center py-14 gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Plus size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-800">Nenhum módulo cadastrado ainda</p>
            <p className="text-sm text-gray-500 mt-1">Crie o primeiro módulo para começar a estruturar o curso.</p>
          </div>
          {canManageModules && (
            <button onClick={() => setNewModuleOpen(true)} className="btn-primary mt-2">
              <Plus size={14} />
              Criar primeiro módulo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-4 items-start">
          {/* Sidebar */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Estrutura do curso</h3>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={moduleSearch}
                onChange={e => setModuleSearch(e.target.value)}
                placeholder="Buscar módulo..."
                className="input-field pl-8 text-xs py-2"
              />
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {filteredModules.map(m => {
                const isActive = m.id === activeModuleId
                const isDragOver = dragOverModuleId === m.id
                return (
                  <div
                    key={m.id}
                    draggable={canManageModules}
                    onDragStart={canManageModules ? e => handleModuleDragStart(e, m) : undefined}
                    onDragOver={canManageModules ? e => handleModuleDragOver(e, m) : undefined}
                    onDrop={canManageModules ? e => handleModuleDrop(e, m) : undefined}
                    onDragEnd={handleModuleDragEnd}
                    onClick={() => setActiveModuleId(m.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-colors
                      ${isActive ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
                      ${isDragOver ? 'ring-2 ring-brand-300' : ''}
                    `}
                  >
                    <div className="flex items-start gap-2">
                      {canManageModules && <GripVertical size={13} className="text-gray-300 mt-0.5 cursor-grab active:cursor-grabbing flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${isActive ? 'text-brand-900' : 'text-gray-700'}`}>{m.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{moduleContentCounts[m.id] || 0} conteúdos</div>
                        <div className="mt-1.5"><Badge status={getModuleStatusKey(m)} /></div>
                      </div>
                      <ChevronRight size={14} className={isActive ? 'text-brand-500' : 'text-gray-300'} />
                    </div>
                  </div>
                )
              })}
              {filteredModules.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum módulo encontrado.</p>
              )}
            </div>
            {canManageModules && (
              <button
                onClick={() => setNewModuleOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-700 transition-colors"
              >
                <Plus size={13} />
                Adicionar módulo
              </button>
            )}
          </div>

          {/* Center: cadastro e validação */}
          {activeModule && form ? (
            <div className="card p-0 overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Cadastro e validação do módulo</h3>
                <div className="flex items-center">
                  {STAGE_STEPS.map((s, i) => (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                          ${i < stageIndex ? 'bg-brand-100 text-brand-700' : i === stageIndex ? 'bg-brand-800 text-white ring-2 ring-brand-200' : 'bg-gray-100 text-gray-400'}`}>
                          {i < stageIndex ? <CheckCircle size={14} /> : i + 1}
                        </div>
                        <span className={`text-[11px] font-medium whitespace-nowrap ${i <= stageIndex ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
                      </div>
                      {i < STAGE_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < stageIndex ? 'bg-brand-300' : 'bg-gray-100'}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Form fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Título do módulo <span className="text-red-500">*</span></label>
                    <input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      disabled={!canEditCore}
                      className={`input-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição do módulo</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      disabled={!canEditCore}
                      rows={2}
                      className={`input-field resize-none ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Professor conteudista <span className="text-red-500">*</span></label>
                    <select
                      value={form.teacherId}
                      onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                      disabled={!canEditCore}
                      className={`select-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Selecionar...</option>
                      {(course.producers || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Supervisor <span className="text-red-500">*</span></label>
                    <select
                      value={form.supervisorId}
                      onChange={e => setForm(f => ({ ...f, supervisorId: e.target.value }))}
                      disabled={!canEditCore}
                      className={`select-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Selecionar...</option>
                      {(courseParticipants.supervisors || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Coordenador(a) <span className="text-red-500">*</span></label>
                    <select
                      value={form.coordinatorId}
                      onChange={e => setForm(f => ({ ...f, coordinatorId: e.target.value }))}
                      disabled={!canEditCore}
                      className={`select-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    >
                      <option value="">Selecionar...</option>
                      {(courseParticipants.coordinators || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Carga horária</label>
                    <input
                      value={form.workload}
                      onChange={e => setForm(f => ({ ...f, workload: e.target.value }))}
                      disabled={!canEditCore}
                      placeholder="Ex: 10h"
                      className={`input-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Prazo de entrega</label>
                    <input
                      type="date"
                      value={form.deadline || ''}
                      onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                      disabled={!canEditCore}
                      className={`input-field ${!canEditCore ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do módulo</label>
                    <div className="input-field bg-gray-50 flex items-center">
                      <Badge status={getModuleStatusKey(activeModule)} />
                    </div>
                  </div>
                </div>

                {/* Validação do fluxo */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Validação do fluxo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Card 1: professor */}
                    <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-brand-800 text-white text-[10px] flex items-center justify-center flex-shrink-0">1</span>
                          Produção do professor
                        </span>
                        <Badge status={professorStatusBadgeKey(activeModule.professorStatus)} />
                      </div>
                      <MiniAvatar name={activeModule.teacherName} roleLabel="Professor" avatar={activeModule.teacherAvatar} />
                      {activeModule.professorStatus === 'concluido' && lastSendEvent && (
                        <p className="text-[11px] text-gray-500">
                          Concluído em {formatDateTime(lastSendEvent.createdAt)} por {lastSendEvent.authorName}
                        </p>
                      )}
                      {activeModule.stage === 'producao' && (isAdmin || isProducer) ? (
                        <button
                          onClick={() => runAction('enviar_supervisao')}
                          disabled={busyAction === 'enviar_supervisao' || !form.teacherId || !form.supervisorId || !form.coordinatorId}
                          className="btn-primary w-full justify-center text-xs py-2"
                          title={(!form.teacherId || !form.supervisorId || !form.coordinatorId) ? 'Defina professor, supervisor e coordenador antes de enviar' : undefined}
                        >
                          <Send size={13} />
                          {busyAction === 'enviar_supervisao' ? 'Enviando...' : 'Finalizar e enviar para supervisão'}
                        </button>
                      ) : activeModule.stage !== 'producao' ? (
                        <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle size={13} /> Enviado para supervisão</p>
                      ) : (
                        <p className="text-xs text-gray-400">Aguardando o professor finalizar a produção.</p>
                      )}
                    </div>

                    {/* Card 2: supervisor */}
                    <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-brand-800 text-white text-[10px] flex items-center justify-center flex-shrink-0">2</span>
                          Validação do supervisor
                        </span>
                        <Badge status={activeModule.supervisorStatus} />
                      </div>
                      <MiniAvatar name={activeModule.supervisorName} roleLabel="Supervisor" avatar={activeModule.supervisorAvatar} />
                      {activeModule.stage === 'supervisao' && canActSupervisor ? (
                        <>
                          <div>
                            <textarea
                              value={noteDrafts.supervisor}
                              onChange={e => setNoteDrafts(d => ({ ...d, supervisor: e.target.value.slice(0, 250) }))}
                              placeholder="Digite seu parecer..."
                              rows={2}
                              maxLength={250}
                              className="input-field resize-none text-xs"
                            />
                            <div className="text-[10px] text-gray-400 text-right mt-0.5">{noteDrafts.supervisor.length}/250</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => runAction('aprovar_supervisor', 'supervisor')}
                              disabled={!!busyAction}
                              className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <ThumbsUp size={12} /> Aprovar
                            </button>
                            <button
                              onClick={() => runAction('ajustes_supervisor', 'supervisor')}
                              disabled={!!busyAction}
                              className="flex-1 flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Solicitar ajustes
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">
                          {activeModule.stage === 'producao' ? 'Aguardando envio do professor.' : 'Aguardando ação do supervisor.'}
                        </p>
                      )}
                    </div>

                    {/* Card 3: coordenacao */}
                    <div className="rounded-xl border border-gray-200 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-brand-800 text-white text-[10px] flex items-center justify-center flex-shrink-0">3</span>
                          Validação da coordenação
                        </span>
                        <Badge status={activeModule.coordinatorStatus} />
                      </div>
                      <MiniAvatar name={activeModule.coordinatorName} roleLabel="Coordenador(a)" avatar={activeModule.coordinatorAvatar} />
                      {activeModule.stage === 'coordenacao' && canActCoordinator ? (
                        <>
                          <div>
                            <textarea
                              value={noteDrafts.coordenador}
                              onChange={e => setNoteDrafts(d => ({ ...d, coordenador: e.target.value.slice(0, 250) }))}
                              placeholder="Digite seu parecer..."
                              rows={2}
                              maxLength={250}
                              className="input-field resize-none text-xs"
                            />
                            <div className="text-[10px] text-gray-400 text-right mt-0.5">{noteDrafts.coordenador.length}/250</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => runAction('aprovar_coordenador', 'coordenador')}
                              disabled={!!busyAction || activeModule.coordinatorStatus === 'aprovado'}
                              className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <ThumbsUp size={12} /> Aprovar
                            </button>
                            <button
                              onClick={() => runAction('reprovar_coordenador', 'coordenador')}
                              disabled={!!busyAction}
                              className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <ThumbsDown size={12} /> Reprovar
                            </button>
                          </div>
                          <button
                            onClick={() => runAction('ajustes_coordenador', 'coordenador')}
                            disabled={!!busyAction}
                            className="w-full flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Solicitar ajustes
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">
                          {activeModule.stage === 'publicado' ? 'Módulo publicado.' : activeModule.stage === 'coordenacao' ? 'Aguardando ação da coordenação.' : 'Aguardando aprovação do supervisor.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Comentários e histórico */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <MessageSquare size={13} /> Observações e comentários
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {events.length === 0 && <p className="text-xs text-gray-400">Nenhum comentário ou atualização ainda.</p>}
                    {events.map(ev => (
                      <div key={ev.id} className="flex gap-2.5">
                        <MiniAvatar name={ev.authorName} roleLabel={roleLabel(ev.authorRole)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-700">{ev.authorName}</span>
                            <span className="text-[10px] text-gray-400">({roleLabel(ev.authorRole)})</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ev.type === 'comment' ? 'bg-gray-100 text-gray-500' : 'bg-brand-50 text-brand-700'}`}>
                              {ev.type === 'comment' ? 'Comentário' : (ACTION_LABELS[ev.action] || 'Atualização')}
                            </span>
                            <span className="text-[10px] text-gray-400">{formatDateTime(ev.createdAt)}</span>
                          </div>
                          {ev.message && <p className="text-xs text-gray-600 mt-0.5">{ev.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-100">
                    <input
                      value={commentDraft}
                      onChange={e => setCommentDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && commentDraft.trim()) handlePostComment() }}
                      placeholder="Escreva um comentário..."
                      maxLength={500}
                      className="input-field flex-1 text-xs"
                    />
                    <button onClick={handlePostComment} disabled={!commentDraft.trim() || postingComment} className="btn-primary text-xs py-2">
                      Enviar
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                {canDeleteModule ? (
                  <button
                    onClick={() => setConfirmDeleteModule(activeModule)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} /> Excluir módulo
                  </button>
                ) : <span />}
                <div className="flex items-center gap-2">
                  {canEditCore && (
                    <button onClick={handleSaveCore} disabled={savingModule} className="btn-secondary">
                      {savingModule ? 'Salvando...' : 'Salvar alterações'}
                    </button>
                  )}
                  {canPublish && (
                    <button onClick={() => runAction('publicar')} disabled={!!busyAction} className="btn-primary">
                      <Rocket size={14} />
                      {busyAction === 'publicar' ? 'Publicando...' : 'Publicar módulo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex items-center justify-center py-14 text-sm text-gray-400">
              Selecione um módulo para visualizar os detalhes.
            </div>
          )}

          {/* Right column */}
          <div className="space-y-4">
            {activeModule && (
              <>
                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800">Resumo de validação</h3>
                  {[
                    { label: 'Professor', name: activeModule.teacherName, avatar: activeModule.teacherAvatar, status: professorStatusBadgeKey(activeModule.professorStatus) },
                    { label: 'Supervisor', name: activeModule.supervisorName, avatar: activeModule.supervisorAvatar, status: activeModule.supervisorStatus },
                    { label: 'Coordenador(a)', name: activeModule.coordinatorName, avatar: activeModule.coordinatorAvatar, status: activeModule.coordinatorStatus },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MiniAvatar name={row.name || row.label} roleLabel={row.label} avatar={row.avatar} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{row.name || '—'}</div>
                          <div className="text-[10px] text-gray-400">{row.label}</div>
                        </div>
                      </div>
                      <Badge status={row.status} />
                    </div>
                  ))}
                  {lastEvent && (
                    <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      Última atualização: {formatDateTime(lastEvent.createdAt)} por {lastEvent.authorName}
                    </div>
                  )}
                </div>

                <div className="card p-4 space-y-2.5">
                  <h3 className="text-sm font-semibold text-gray-800">Checklist do módulo</h3>
                  {checklist.map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      {item.done
                        ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                        : <Circle size={15} className="text-gray-300 flex-shrink-0" />}
                      <span className={`text-xs ${item.done ? 'text-gray-700' : 'text-gray-400'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="card p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-gray-800">Fluxo sugerido</h3>
              {FLUXO_SUGERIDO.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-xs text-gray-600 leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdos do módulo */}
      {activeModule && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Conteúdos do módulo</h3>
              <p className="text-xs text-gray-400 mt-0.5">{moduleContents.length} conteúdo{moduleContents.length !== 1 ? 's' : ''} em {activeModule.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={contentSearch}
                  onChange={e => setContentSearch(e.target.value)}
                  placeholder="Buscar conteúdo..."
                  className="input-field pl-8 text-xs py-2 w-48"
                />
              </div>
              {canEditContent && (
                <button
                  onClick={() => { setEditingContent(null); setContentModalOpen(true) }}
                  disabled={contentLocked}
                  title={contentLocked ? 'O módulo não está em produção.' : undefined}
                  className="btn-primary text-xs py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={13} />
                  Novo conteúdo
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header w-12">Ordem</th>
                  <th className="table-header">Conteúdo</th>
                  <th className="table-header w-24">Tipo</th>
                  <th className="table-header w-12">Resp.</th>
                  <th className="table-header w-12">Sup.</th>
                  <th className="table-header w-12">Coord.</th>
                  <th className="table-header w-24">Prazo</th>
                  <th className="table-header">Status</th>
                  <th className="table-header w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {moduleContents.map(mat => {
                  const isDragging = dragContentId === mat.id
                  const isDragOver = dragOverContentId === mat.id
                  return (
                    <tr
                      key={mat.id}
                      draggable={canEditContent && !contentLocked}
                      onDragStart={canEditContent ? e => handleContentDragStart(e, mat) : undefined}
                      onDragOver={canEditContent ? e => handleContentDragOver(e, mat) : undefined}
                      onDrop={canEditContent ? e => handleContentDrop(e, mat) : undefined}
                      onDragEnd={handleContentDragEnd}
                      className={`border-b border-gray-50 transition-colors
                        ${isDragging ? 'opacity-40' : ''}
                        ${isDragOver ? 'bg-brand-50/30 border-t-2 border-t-brand-400' : 'hover:bg-gray-50/50'}
                      `}
                    >
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEditContent && !contentLocked && <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />}
                          <span className="font-semibold text-gray-600">{mat.session}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="font-medium text-gray-700 truncate max-w-[220px]">{mat.theme}</div>
                      </td>
                      <td className="table-cell"><TypeBadge type={mat.type} /></td>
                      <td className="table-cell">
                        <StackedAvatars assignees={materialAssignees} responsibles={getMaterialResponsibles(mat)} />
                      </td>
                      <td className="table-cell"><MiniAvatar name={activeModule.supervisorName} roleLabel="Supervisor" avatar={activeModule.supervisorAvatar} /></td>
                      <td className="table-cell"><MiniAvatar name={activeModule.coordinatorName} roleLabel="Coordenador(a)" avatar={activeModule.coordinatorAvatar} /></td>
                      <td className="table-cell text-gray-500">{formatDateOnly(mat.deliveryDate)}</td>
                      <td className="table-cell">
                        {canEditContent ? (
                          <InlineStatusSelect value={mat.status || ''} options={PROFESSOR_STATUS_OPTIONS} onChange={val => handleContentStatusChange(mat, val)} />
                        ) : (
                          <Badge status={mat.status || ''} />
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setViewContent(mat)} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Eye size={14} />
                          </button>
                          {canEditContent && (
                            <button onClick={() => { setEditingContent(mat); setContentModalOpen(true) }} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                              <Pencil size={14} />
                            </button>
                          )}
                          {mat.originalLink && (
                            <a href={mat.originalLink} target="_blank" rel="noopener noreferrer" title="Abrir link original" className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors">
                              <Link2 size={14} />
                            </a>
                          )}
                          {canEditContent && (
                            <button onClick={() => setConfirmDeleteContent(mat)} title="Excluir" className="p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {moduleContents.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-10 text-gray-400 text-sm">
                      Nenhum conteúdo vinculado a este módulo ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View content modal */}
      {viewContent && (
        <Modal open={!!viewContent} onClose={() => setViewContent(null)} title={viewContent.theme} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Tipo</div>
              <TypeBadge type={viewContent.type} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Status</div>
              <Badge status={viewContent.status || ''} />
            </div>
            <div className="col-span-2">
              <div className="text-xs font-medium text-gray-500 mb-1">Objetivo</div>
              <div className="text-sm text-gray-800">{viewContent.objective || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Tempo estimado</div>
              <div className="text-sm text-gray-800">{viewContent.duration || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Prazo de entrega</div>
              <div className="text-sm text-gray-800">{formatDateOnly(viewContent.deliveryDate)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Link original</div>
              <LinkChip url={viewContent.originalLink} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Link ajustado</div>
              <LinkChip url={viewContent.adjustedLink} />
            </div>
          </div>
        </Modal>
      )}

      {contentModalOpen && activeModule && (
        <ContentModal
          open={contentModalOpen}
          onClose={() => setContentModalOpen(false)}
          onSave={handleSaveContent}
          saving={savingContent}
          module={activeModule}
          course={course}
          editing={editingContent}
        />
      )}

      <NewModuleModal open={newModuleOpen} onClose={() => setNewModuleOpen(false)} onCreate={handleCreateModule} saving={creatingModule} />

      <ConfirmDialog
        open={!!confirmDeleteModule}
        onClose={() => setConfirmDeleteModule(null)}
        onConfirm={handleDeleteModule}
        title="Excluir módulo"
        message={`Tem certeza que deseja excluir "${confirmDeleteModule?.title}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />

      <ConfirmDialog
        open={!!confirmDeleteContent}
        onClose={() => setConfirmDeleteContent(null)}
        onConfirm={handleDeleteContent}
        title="Excluir conteúdo"
        message={`Tem certeza que deseja excluir "${confirmDeleteContent?.theme}"?`}
        confirmLabel="Excluir"
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} className="text-red-200" /> : <CheckCircle size={16} className="text-green-400" />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
