import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, GripVertical, CheckCircle, Circle, Send, Rocket, Trash2, Pencil, Eye,
  Link2, ChevronRight, AlertTriangle, MessageSquare,
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
  enviar_supervisao: 'Enviou o módulo para supervisão',
  publicar: 'Publicou o módulo',
  concluir_conteudo_professor: 'Concluiu um conteúdo (produção)',
  ajustes_conteudo_professor: 'Colocou um conteúdo em ajustes (produção)',
  aprovar_conteudo_supervisor: 'Aprovou um conteúdo (supervisão)',
  ajustes_conteudo_supervisor: 'Solicitou ajustes em um conteúdo (supervisão)',
  aprovar_conteudo_coordenador: 'Aprovou um conteúdo (coordenação)',
  ajustes_conteudo_coordenador: 'Solicitou ajustes em um conteúdo (coordenação)',
  reprovar_conteudo_coordenador: 'Reprovou um conteúdo (coordenação)',
}

const CONTENT_SUPERVISOR_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'ajustes', label: 'Ajustes' },
]

const CONTENT_COORDINATOR_STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'ajustes', label: 'Ajustes' },
  { value: 'reprovado', label: 'Reprovado' },
]

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

const EMPTY_MODULE_FORM = {
  title: '',
  description: '',
  workload: '',
  deadline: '',
}

const EMPTY_CONTENT_FORM = {
  moduleId: '',
  type: '',
  theme: '',
  objective: '',
  duration: '',
  deliveryDate: '',
  responsibleId: '',
  originalLink: '',
  adjustedLink: '',
  status: 'nao_iniciado',
  reviewNotes: '',
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

function getContentApprovalSummary(contents) {
  return {
    total: contents.length,
    professorConcluded: contents.filter(c => c.status === 'concluido').length,
    supervisorApproved: contents.filter(c => c.supervisorStatus === 'aprovado').length,
    coordinatorApproved: contents.filter(c => c.coordinatorStatus === 'aprovado').length,
    anyNeedsAttention: contents.some(c => c.supervisorStatus === 'ajustes' || c.coordinatorStatus === 'ajustes' || c.coordinatorStatus === 'reprovado'),
  }
}

function getModuleStatusKey(m, contents = []) {
  if (!m) return 'rascunho'
  if (m.stage === 'publicado') return 'publicado'
  if (m.stage === 'producao') {
    if (m.professorStatus === 'em_producao') return 'em_producao'
    return 'rascunho'
  }
  // stage === 'supervisao': aprovacao agora e por conteudo
  const summary = getContentApprovalSummary(contents)
  if (summary.total === 0) return 'em_validacao'
  if (summary.anyNeedsAttention) return 'em_revisao'
  if (summary.coordinatorApproved === summary.total) return 'aprovado'
  return 'em_validacao'
}

function computeDisplayStageIndex(m, contents = []) {
  if (!m) return 0
  if (m.stage === 'publicado') return 3
  if (m.stage === 'producao') return 0
  const summary = getContentApprovalSummary(contents)
  if (summary.total > 0 && summary.supervisorApproved === summary.total) return 2
  return 1
}

/* ─── content modal ─── */

function ContentModal({ open, onClose, onSave, saving, modules, defaultModuleId, course, editing, canReview, canEditStatus }) {
  const [form, setForm] = useState(EMPTY_CONTENT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      const responsibles = getMaterialResponsibles(editing)
      setForm({
        moduleId: editing.moduleId || '',
        type: Array.isArray(editing.type) ? (editing.type[0] || '') : (editing.type || ''),
        theme: editing.theme || '',
        objective: editing.objective || '',
        duration: editing.duration || '',
        deliveryDate: editing.deliveryDate || '',
        responsibleId: responsibles[0]?.id || '',
        originalLink: editing.originalLink || '',
        adjustedLink: editing.adjustedLink || '',
        status: editing.status || 'nao_iniciado',
        reviewNotes: editing.reviewNotes || '',
      })
    } else {
      setForm({ ...EMPTY_CONTENT_FORM, moduleId: defaultModuleId || '' })
    }
    setError('')
  }, [open, editing, defaultModuleId])

  const producers = course.producers || []

  const handleSubmit = () => {
    if (!form.moduleId) { setError('Selecione o módulo.'); return }
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Módulo <span className="text-red-500">*</span></label>
          <select value={form.moduleId} onChange={e => setForm(f => ({ ...f, moduleId: e.target.value }))} className="select-field">
            <option value="">Selecionar módulo...</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>

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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do professor</label>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            disabled={!canEditStatus}
            className={`select-field ${!canEditStatus ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
          >
            {PROFESSOR_STATUS_OPTIONS.filter(o => o.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {(canReview || form.reviewNotes) && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Parecer / observações da revisão</label>
            <textarea
              value={form.reviewNotes}
              onChange={e => setForm(f => ({ ...f, reviewNotes: e.target.value }))}
              disabled={!canReview}
              className={`input-field resize-none ${!canReview ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              rows={2}
              placeholder="Observações do supervisor/coordenação para o produtor..."
            />
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── module modal (cria e edita) ─── */

function ModuleModal({ open, onClose, onSave, saving, editing }) {
  const [form, setForm] = useState(EMPTY_MODULE_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        title: editing.title || '',
        description: editing.description || '',
        workload: editing.workload || '',
        deadline: editing.deadline || '',
      })
    } else {
      setForm(EMPTY_MODULE_FORM)
    }
    setError('')
  }, [open, editing])

  const handleSubmit = () => {
    if (!form.title.trim()) { setError('Informe o título do módulo.'); return }
    onSave({ ...(editing ? { id: editing.id } : {}), ...form })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar módulo' : 'Novo módulo'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar módulo'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Título do módulo <span className="text-red-500">*</span></label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="input-field"
            placeholder="Ex: Módulo 1 - Comunicação e Rotina Digital"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && form.title.trim()) handleSubmit() }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição do módulo</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-field resize-none"
            rows={3}
            placeholder="Descreva o conteúdo e os objetivos deste módulo..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Carga horária</label>
            <input
              value={form.workload}
              onChange={e => setForm(f => ({ ...f, workload: e.target.value }))}
              className="input-field"
              placeholder="Ex: 10h"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prazo de entrega</label>
            <input
              type="date"
              value={form.deadline || ''}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="input-field"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ─── main component ─── */

export default function ModulosWorkspace({ course }) {
  const { user } = useAuth()
  const { materials, materialAssignees, saveMaterial, deleteMaterial, updateMaterialStatus, updateMaterialSession, loadCourses } = useData()

  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeModuleId, setActiveModuleId] = useState(null)
  const [moduleSearch, setModuleSearch] = useState('')
  const [contentSearch, setContentSearch] = useState('')
  const [savingModule, setSavingModule] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [toast, setToast] = useState(null)
  const [newModuleOpen, setNewModuleOpen] = useState(false)
  const [editingModule, setEditingModule] = useState(null)
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

  const isAdmin = user?.role === 'administrador'
  const isCoordinatorUser = user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')
  const isProducer = user?.role === 'professor' && course.producers?.some(p => Number(p.id) === Number(user.id))
  const isCourseSupervisor = user?.role === 'supervisor' && (course.supervisorId === user.id || course.supervisorName === user.name)
  const isCourseCoordinator = isCoordinatorUser && (course.coordinatorId === user.id || course.coordinatorName === user.name)
  const canManageModules = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  // Admin e coordenacao do curso podem sempre alterar qualquer status de qualquer perfil,
  // sem passar pelo gate sequencial (professor -> supervisor -> coordenacao).
  const isPrivileged = isAdmin || isCourseCoordinator

  const canEditModule = !!activeModule && (isAdmin || (canManageModules && activeModule.stage === 'producao'))
  const canEditContent = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  const canReviewContent = isAdmin || isCourseSupervisor || isCourseCoordinator
  const contentLocked = !!activeModule && activeModule.stage !== 'producao' && !isAdmin

  const courseMaterials = useMemo(
    () => materials.filter(m => Number(m.courseId) === Number(course.id) || m.course === course.name),
    [materials, course.id, course.name]
  )

  const contentsByModuleId = useMemo(() => {
    const map = {}
    courseMaterials.forEach(m => {
      if (!m.moduleId) return
      map[m.moduleId] = map[m.moduleId] || []
      map[m.moduleId].push(m)
    })
    return map
  }, [courseMaterials])

  const moduleContentCounts = useMemo(() => {
    const counts = {}
    Object.entries(contentsByModuleId).forEach(([moduleId, list]) => { counts[moduleId] = list.length })
    return counts
  }, [contentsByModuleId])

  const moduleContents = useMemo(() => {
    if (!activeModule) return []
    return courseMaterials
      .filter(m => Number(m.moduleId) === Number(activeModule.id))
      .filter(m => !contentSearch || m.theme?.toLowerCase().includes(contentSearch.toLowerCase()))
      .sort((a, b) => Number(a.session) - Number(b.session))
  }, [courseMaterials, activeModule, contentSearch])

  const moduleResponsibles = useMemo(() => {
    const map = new Map()
    moduleContents.forEach(mat => {
      getMaterialResponsibles(mat).forEach(r => { if (r?.id != null) map.set(r.id, r) })
    })
    return Array.from(map.values())
  }, [moduleContents])

  const stats = useMemo(() => ({
    modulos: modules.length,
    conteudos: courseMaterials.length,
    emProducao: modules.filter(m => m.stage === 'producao').length,
    aguardando: modules.filter(m => {
      if (m.stage !== 'supervisao') return false
      const summary = getContentApprovalSummary(contentsByModuleId[m.id] || [])
      return summary.total === 0 || summary.coordinatorApproved < summary.total
    }).length,
    aprovados: modules.filter(m => {
      if (m.stage === 'publicado') return true
      if (m.stage !== 'supervisao') return false
      const summary = getContentApprovalSummary(contentsByModuleId[m.id] || [])
      return summary.total > 0 && summary.coordinatorApproved === summary.total
    }).length,
  }), [modules, courseMaterials, contentsByModuleId])

  const filteredModules = useMemo(() => {
    if (!moduleSearch) return modules
    const q = moduleSearch.toLowerCase()
    return modules.filter(m => m.title?.toLowerCase().includes(q))
  }, [modules, moduleSearch])

  /* ── module actions ── */

  const handleSaveModule = async (payload) => {
    setSavingModule(true)
    try {
      if (payload.id) {
        const { data } = await api.put(`/modules/${payload.id}`, payload)
        setModules(prev => prev.map(m => m.id === data.id ? data : m))
        showToast('Módulo atualizado!')
      } else {
        const { data } = await api.post(`/courses/${course.id}/modules`, payload)
        setModules(prev => [...prev, data])
        setActiveModuleId(data.id)
        showToast('Módulo criado!')
      }
      setNewModuleOpen(false)
      setEditingModule(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar módulo.'), 'error')
    } finally {
      setSavingModule(false)
    }
  }

  const runAction = async (action) => {
    if (!activeModule) return
    setBusyAction(action)
    try {
      const { data } = await api.patch(`/modules/${activeModule.id}/status`, { action })
      setModules(prev => prev.map(m => m.id === data.id ? data : m))
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
    setSavingContent(true)
    try {
      const targetModuleId = Number(payload.moduleId)
      const isNew = !payload.id
      const prevModuleId = editingContent?.moduleId ? Number(editingContent.moduleId) : null
      if (isNew || prevModuleId !== targetModuleId) {
        payload.session = (contentsByModuleId[targetModuleId]?.length || 0) + 1
      }
      await saveMaterial({
        ...payload,
        course: course.name,
        courseId: course.id,
        moduleId: targetModuleId,
      })
      if (targetModuleId !== activeModuleId) setActiveModuleId(targetModuleId)
      showToast(payload.id ? 'Conteúdo atualizado!' : 'Conteúdo adicionado!')
      setContentModalOpen(false)
    } catch (err) {
      showToast(err.message || 'Erro ao salvar conteúdo.', 'error')
    } finally {
      setSavingContent(false)
    }
  }

  const handleContentStatusChange = async (mat, field, value) => {
    try {
      await updateMaterialStatus(mat.id, { [field]: value })
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

  const approvalSummary = getContentApprovalSummary(moduleContents)

  const checklist = activeModule ? [
    { label: 'Título preenchido', done: !!activeModule.title },
    { label: 'Descrição adicionada', done: !!activeModule.description },
    { label: 'Conteúdos vinculados', done: moduleContents.length > 0 },
    { label: 'Produção concluída pelo professor', done: approvalSummary.total > 0 && approvalSummary.professorConcluded === approvalSummary.total },
    { label: 'Revisão do supervisor', done: approvalSummary.total > 0 && approvalSummary.supervisorApproved === approvalSummary.total },
    { label: 'Aprovação da coordenação', done: approvalSummary.total > 0 && approvalSummary.coordinatorApproved === approvalSummary.total },
  ] : []

  const events = activeModule?.events || []
  const lastEvent = events.length ? events[events.length - 1] : null
  const canPublish = !!activeModule && isPrivileged && activeModule.stage === 'supervisao'
    && approvalSummary.total > 0 && approvalSummary.coordinatorApproved === approvalSummary.total
  const canDeleteModule = !!activeModule && canManageModules && (isAdmin || activeModule.stage === 'producao')
  const stageIndex = computeDisplayStageIndex(activeModule, moduleContents)

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

      <div className="flex items-center justify-end gap-2">
        {canManageModules && (
          <button onClick={() => { setEditingModule(null); setNewModuleOpen(true) }} className="btn-secondary text-sm">
            <Plus size={14} />
            Novo módulo
          </button>
        )}
        {canEditContent && (
          <button
            onClick={() => { setEditingContent(null); setContentModalOpen(true) }}
            disabled={modules.length === 0}
            title={modules.length === 0 ? 'Crie um módulo antes de adicionar conteúdo.' : undefined}
            className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Novo conteúdo
          </button>
        )}
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
            <button onClick={() => { setEditingModule(null); setNewModuleOpen(true) }} className="btn-primary mt-2">
              <Plus size={14} />
              Criar primeiro módulo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 items-start">
          {/* Sidebar: módulos */}
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
            <div className="space-y-2 max-h-[640px] overflow-y-auto">
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
                        <div className="mt-1.5"><Badge status={getModuleStatusKey(m, contentsByModuleId[m.id] || [])} /></div>
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
          </div>

          {/* Middle: tabela de conteúdos */}
          {activeModule ? (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Conteúdos do módulo</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{moduleContents.length} conteúdo{moduleContents.length !== 1 ? 's' : ''} em {activeModule.title}</p>
                </div>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={contentSearch}
                    onChange={e => setContentSearch(e.target.value)}
                    placeholder="Buscar conteúdo..."
                    className="input-field pl-8 text-xs py-2 w-48"
                  />
                </div>
              </div>

              <div className="table-container">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="table-header w-12">Ordem</th>
                      <th className="table-header">Conteúdo</th>
                      <th className="table-header w-24">Tipo</th>
                      <th className="table-header w-36">Professor</th>
                      <th className="table-header w-36">Supervisor</th>
                      <th className="table-header w-36">Coordenação</th>
                      <th className="table-header w-24">Prazo</th>
                      <th className="table-header w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleContents.map(mat => {
                      const isDragging = dragContentId === mat.id
                      const isDragOver = dragOverContentId === mat.id
                      const responsibleAvatar = materialAssignees.find(a => Number(a.id) === Number(mat.responsibleId))?.avatar
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
                            <div className="flex items-center gap-1.5">
                              <MiniAvatar name={mat.responsibleName} roleLabel="Professor" avatar={responsibleAvatar} />
                              {(isPrivileged || isProducer) ? (
                                <InlineStatusSelect
                                  value={mat.status || ''}
                                  options={PROFESSOR_STATUS_OPTIONS}
                                  onChange={val => handleContentStatusChange(mat, 'status', val)}
                                />
                              ) : (
                                <Badge status={mat.status || ''} />
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <MiniAvatar name={course.supervisorName} roleLabel="Supervisor" avatar={course.supervisorAvatar} />
                              {(isPrivileged || isCourseSupervisor) ? (
                                <InlineStatusSelect
                                  value={mat.supervisorStatus || ''}
                                  options={CONTENT_SUPERVISOR_STATUS_OPTIONS}
                                  onChange={val => {
                                    if (!isPrivileged && val === 'aprovado' && mat.status !== 'concluido') {
                                      showToast('Só é possível aprovar após o professor concluir este conteúdo.', 'error')
                                      return
                                    }
                                    handleContentStatusChange(mat, 'supervisorStatus', val)
                                  }}
                                />
                              ) : (
                                <Badge status={mat.supervisorStatus || ''} />
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <MiniAvatar name={course.coordinatorName} roleLabel="Coordenador(a)" avatar={course.coordinatorAvatar} />
                              {isPrivileged ? (
                                <InlineStatusSelect
                                  value={mat.coordinatorStatus || ''}
                                  options={CONTENT_COORDINATOR_STATUS_OPTIONS}
                                  onChange={val => handleContentStatusChange(mat, 'coordinatorStatus', val)}
                                />
                              ) : (
                                <Badge status={mat.coordinatorStatus || ''} />
                              )}
                            </div>
                          </td>
                          <td className="table-cell text-gray-500">{formatDateOnly(mat.deliveryDate)}</td>
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
                        <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">
                          Nenhum conteúdo vinculado a este módulo ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card flex items-center justify-center py-14 text-sm text-gray-400">
              Selecione um módulo para visualizar os conteúdos.
            </div>
          )}

          {/* Right: fluxo de validação */}
          <div className="space-y-4">
            {activeModule && (
              <>
                <div className="card p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">{activeModule.title}</h3>
                      <div className="mt-1"><Badge status={getModuleStatusKey(activeModule, moduleContents)} /></div>
                    </div>
                    {canEditModule && (
                      <button
                        onClick={() => { setEditingModule(activeModule); setNewModuleOpen(true) }}
                        title="Editar módulo"
                        className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>

                  {activeModule.description && (
                    <p className="text-xs text-gray-500 leading-relaxed">{activeModule.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-gray-400">Carga horária</div>
                      <div className="text-gray-700 font-medium">{activeModule.workload || '—'}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Prazo de entrega</div>
                      <div className="text-gray-700 font-medium">{formatDateOnly(activeModule.deadline)}</div>
                    </div>
                  </div>

                  {/* Stage stepper */}
                  <div className="flex items-center pt-1">
                    {STAGE_STEPS.map((s, i) => (
                      <div key={s.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0
                            ${i < stageIndex ? 'bg-brand-100 text-brand-700' : i === stageIndex ? 'bg-brand-800 text-white ring-2 ring-brand-200' : 'bg-gray-100 text-gray-400'}`}>
                            {i < stageIndex ? <CheckCircle size={12} /> : i + 1}
                          </div>
                          <span className={`text-[10px] font-medium whitespace-nowrap ${i <= stageIndex ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
                        </div>
                        {i < STAGE_STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < stageIndex ? 'bg-brand-300' : 'bg-gray-100'}`} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resumo de validação */}
                  <div className="space-y-2.5 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StackedAvatars responsibles={moduleResponsibles} assignees={materialAssignees} />
                        <div className="text-xs font-medium text-gray-700">Professor</div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 flex-shrink-0">{approvalSummary.professorConcluded}/{approvalSummary.total || 0} concluídos</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MiniAvatar name={course.supervisorName || 'Supervisor'} roleLabel="Supervisor" avatar={course.supervisorAvatar} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{course.supervisorName || '—'}</div>
                          <div className="text-[10px] text-gray-400">Supervisor</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 flex-shrink-0">{approvalSummary.supervisorApproved}/{approvalSummary.total || 0} aprovados</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MiniAvatar name={course.coordinatorName || 'Coordenador(a)'} roleLabel="Coordenador(a)" avatar={course.coordinatorAvatar} />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate">{course.coordinatorName || '—'}</div>
                          <div className="text-[10px] text-gray-400">Coordenador(a)</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 flex-shrink-0">{approvalSummary.coordinatorApproved}/{approvalSummary.total || 0} aprovados</span>
                    </div>
                    {lastEvent && (
                      <div className="pt-1 text-[11px] text-gray-400">
                        Última atualização: {formatDateTime(lastEvent.createdAt)} por {lastEvent.authorName}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="space-y-2 pt-3 border-t border-gray-100">
                    {activeModule.stage === 'producao' && (isAdmin || isProducer) && (
                      <button
                        onClick={() => runAction('enviar_supervisao')}
                        disabled={busyAction === 'enviar_supervisao' || approvalSummary.total === 0 || approvalSummary.professorConcluded < approvalSummary.total}
                        className="btn-primary w-full justify-center text-xs py-2"
                        title={
                          approvalSummary.total === 0
                            ? 'Adicione ao menos um conteúdo antes de enviar'
                            : approvalSummary.professorConcluded < approvalSummary.total
                              ? 'Conclua todos os conteúdos antes de enviar para supervisão'
                              : undefined
                        }
                      >
                        <Send size={13} />
                        {busyAction === 'enviar_supervisao' ? 'Enviando...' : 'Finalizar e enviar para supervisão'}
                      </button>
                    )}
                    {activeModule.stage !== 'producao' && activeModule.stage !== 'publicado' && (
                      <p className="text-xs text-green-700 flex items-center gap-1.5"><CheckCircle size={13} /> Enviado para supervisão</p>
                    )}
                    {canPublish && (
                      <button onClick={() => runAction('publicar')} disabled={!!busyAction} className="btn-primary w-full justify-center text-xs py-2">
                        <Rocket size={14} />
                        {busyAction === 'publicar' ? 'Publicando...' : 'Publicar módulo'}
                      </button>
                    )}
                    {activeModule.stage === 'publicado' && (
                      <p className="text-xs text-brand-700 flex items-center gap-1.5"><CheckCircle size={13} /> Módulo publicado</p>
                    )}
                    {canDeleteModule && (
                      <button
                        onClick={() => setConfirmDeleteModule(activeModule)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors pt-1"
                      >
                        <Trash2 size={13} /> Excluir módulo
                      </button>
                    )}
                  </div>
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

                <div className="card p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <MessageSquare size={13} /> Observações e comentários
                  </h3>
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
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
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

      {/* View content modal */}
      {viewContent && (
        <Modal open={!!viewContent} onClose={() => setViewContent(null)} title={viewContent.theme} size="lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Tipo</div>
              <TypeBadge type={viewContent.type} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Professor</div>
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
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Supervisor</div>
              <Badge status={viewContent.supervisorStatus || ''} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Coordenação</div>
              <Badge status={viewContent.coordinatorStatus || ''} />
            </div>
            {viewContent.reviewNotes && (
              <div className="col-span-2">
                <div className="text-xs font-medium text-gray-500 mb-1">Parecer / observações da revisão</div>
                <div className="text-sm text-gray-800 bg-amber-50 border border-amber-100 rounded-lg p-3">{viewContent.reviewNotes}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {contentModalOpen && (
        <ContentModal
          open={contentModalOpen}
          onClose={() => setContentModalOpen(false)}
          onSave={handleSaveContent}
          saving={savingContent}
          modules={modules}
          defaultModuleId={activeModuleId}
          course={course}
          editing={editingContent}
          canReview={canReviewContent}
          canEditStatus={isPrivileged || isProducer}
        />
      )}

      <ModuleModal
        open={newModuleOpen}
        onClose={() => { setNewModuleOpen(false); setEditingModule(null) }}
        onSave={handleSaveModule}
        saving={savingModule}
        editing={editingModule}
      />

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
