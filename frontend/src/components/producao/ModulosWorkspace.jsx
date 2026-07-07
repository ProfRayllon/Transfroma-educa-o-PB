import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, GripVertical, CheckCircle, Send, Rocket, Trash2, Pencil, Eye,
  Link2, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, MoreVertical, Filter, Info,
  Layers, FileText, Clock, X,
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
  SUPERVISOR_STATUS_OPTIONS,
  COORDINATOR_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
  getMaterialResponsibles,
  TypeBadge,
  LinkChip,
  MiniAvatar,
  StackedAvatars,
  InlineStatusSelect,
} from './shared'

const MODULE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'em_producao', label: 'Em produção' },
  { value: 'em_validacao', label: 'Em validação' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'publicado', label: 'Publicado' },
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
  responsibles: [],
  originalLink: '',
  adjustedLink: '',
  status: 'nao_iniciado',
  reviewNotes: '',
}

function formatDateOnly(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
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

/* ─── content modal ─── */

function ContentModal({ open, onClose, onSave, saving, modules, defaultModuleId, course, editing, canReview, canEditStatus }) {
  const [form, setForm] = useState(EMPTY_CONTENT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        moduleId: editing.moduleId || '',
        type: Array.isArray(editing.type) ? (editing.type[0] || '') : (editing.type || ''),
        theme: editing.theme || '',
        objective: editing.objective || '',
        duration: editing.duration || '',
        deliveryDate: editing.deliveryDate || '',
        responsibles: getMaterialResponsibles(editing),
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

  const addResponsible = (e) => {
    const userId = Number(e.target.value)
    if (!userId) return
    const p = producers.find(p => Number(p.id) === userId)
    if (!p || form.responsibles.some(r => Number(r.id) === p.id)) return
    setForm(f => ({ ...f, responsibles: [...f.responsibles, { id: p.id, name: p.name, role: p.function || '' }] }))
    e.target.value = ''
  }

  const removeResponsible = (i) => {
    setForm(f => ({ ...f, responsibles: f.responsibles.filter((_, j) => j !== i) }))
  }

  const handleSubmit = () => {
    if (!form.moduleId) { setError('Selecione o módulo.'); return }
    if (!form.type) { setError('Selecione o tipo de material.'); return }
    if (!form.theme.trim()) { setError('Informe o título do conteúdo.'); return }
    if (!form.responsibles.length) { setError('Selecione ao menos um professor(a) responsável pelo conteúdo.'); return }

    const primary = form.responsibles[0]
    onSave({
      ...(editing ? { id: editing.id } : {}),
      ...form,
      responsibleId: primary.id,
      responsibleName: primary.name,
      responsibleRole: primary.role || '',
      responsibles: form.responsibles,
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Professor(a) responsável <span className="text-red-500">*</span></label>
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
          <select value="" onChange={addResponsible} className="select-field">
            <option value="">+ Adicionar professor(a)...</option>
            {producers.filter(p => !form.responsibles.some(r => Number(r.id) === Number(p.id))).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {producers.length === 0 && <p className="text-xs text-amber-600 mt-1">Nenhum professor(a)/produtor vinculado ao curso.</p>}
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do professor(a)</label>
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
  const navigate = useNavigate()
  const { materials, materialAssignees, saveMaterial, deleteMaterial, updateMaterialStatus, updateMaterialSession, loadCourses } = useData()

  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsedModuleIds, setCollapsedModuleIds] = useState(() => new Set())
  const [structureSearch, setStructureSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [openMenuKey, setOpenMenuKey] = useState(null)
  const [savingModule, setSavingModule] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [toast, setToast] = useState(null)
  const [newModuleOpen, setNewModuleOpen] = useState(false)
  const [editingModule, setEditingModule] = useState(null)
  const [confirmDeleteModule, setConfirmDeleteModule] = useState(null)
  const [contentModalOpen, setContentModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [contentModalDefaultModuleId, setContentModalDefaultModuleId] = useState(null)
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

  const isAdmin = user?.role === 'administrador'
  const isCoordinatorUser = user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')
  const isProducer = user?.role === 'professor' && course.producers?.some(p => Number(p.id) === Number(user.id))
  const isCourseSupervisor = user?.role === 'supervisor' && (course.supervisorId === user.id || course.supervisorName === user.name)
  const isCourseCoordinator = isCoordinatorUser && (course.coordinatorId === user.id || course.coordinatorName === user.name)
  const canManageModules = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  // Admin e coordenacao do curso podem sempre alterar qualquer status de qualquer perfil,
  // sem passar pelo gate sequencial (professor -> supervisor -> coordenacao).
  const isPrivileged = isAdmin || isCourseCoordinator

  const canEditContent = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  const canReviewContent = isAdmin || isCourseSupervisor || isCourseCoordinator

  // Editar qualquer modulo em producao; excluir e do supervisor do curso (so em producao),
  // ou de admin/coordenacao do curso, que podem excluir sempre.
  const canEditThisModule = (m) => !!m && (isAdmin || (canManageModules && m.stage === 'producao'))
  const canDeleteThisModule = (m) => !!m && (isPrivileged || (isCourseSupervisor && m.stage === 'producao'))
  const canPublishThisModule = (m, summary) => (isAdmin || isCourseCoordinator) && m.stage === 'supervisao' && summary.total > 0 && summary.coordinatorApproved === summary.total

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

  // Cards refletem o status de cada CONTEUDO (nao do modulo), acompanhando o mesmo
  // fluxo professor -> supervisor -> coordenacao usado na tabela abaixo.
  const stats = useMemo(() => ({
    modulos: modules.length,
    conteudos: courseMaterials.length,
    emProducao: courseMaterials.filter(m => m.status === 'em_execucao' || m.status === 'em_ajustes').length,
    aguardando: courseMaterials.filter(m =>
      (m.status === 'concluido' && m.supervisorStatus !== 'aprovado') ||
      (m.supervisorStatus === 'aprovado' && m.coordinatorStatus !== 'aprovado')
    ).length,
    aprovados: courseMaterials.filter(m => m.supervisorStatus === 'aprovado' && m.coordinatorStatus === 'aprovado').length,
  }), [modules, courseMaterials])

  const sortedModules = useMemo(() => [...modules].sort((a, b) => (a.order || 0) - (b.order || 0)), [modules])

  const reorderingAllowed = !structureSearch.trim() && !statusFilter

  const structureRows = useMemo(() => {
    const q = structureSearch.trim().toLowerCase()
    return sortedModules
      .map(m => {
        const allContents = (contentsByModuleId[m.id] || []).slice().sort((a, b) => Number(a.session) - Number(b.session))
        if (statusFilter && getModuleStatusKey(m, allContents) !== statusFilter) return null
        if (!q) return { module: m, allContents, visibleContents: allContents, forceExpand: false }
        const moduleMatches = m.title?.toLowerCase().includes(q)
        const matchingContents = allContents.filter(c => c.theme?.toLowerCase().includes(q))
        if (moduleMatches) return { module: m, allContents, visibleContents: allContents, forceExpand: true }
        if (matchingContents.length > 0) return { module: m, allContents, visibleContents: matchingContents, forceExpand: true }
        return null
      })
      .filter(Boolean)
  }, [sortedModules, contentsByModuleId, structureSearch, statusFilter])

  const toggleModuleCollapsed = (id) => {
    setCollapsedModuleIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const expandModule = (id) => {
    setCollapsedModuleIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

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

  const runAction = async (moduleObj, action) => {
    setOpenMenuKey(null)
    setBusyAction(`${moduleObj.id}:${action}`)
    try {
      const { data } = await api.patch(`/modules/${moduleObj.id}/status`, { action })
      setModules(prev => prev.map(m => m.id === data.id ? data : m))
      showToast('Status do módulo atualizado!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar módulo.'), 'error')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDeleteModule = async () => {
    if (!confirmDeleteModule) return
    try {
      await api.delete(`/modules/${confirmDeleteModule.id}`)
      setModules(prev => prev.filter(m => m.id !== confirmDeleteModule.id))
      // O modulo excluido leva junto os conteudos vinculados; recarrega para tirar os orfaos do estado global.
      await loadCourses()
      showToast('Módulo e conteúdos vinculados excluídos com sucesso!')
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

  const openNewContentFor = (moduleId) => {
    setEditingContent(null)
    setContentModalDefaultModuleId(moduleId)
    setContentModalOpen(true)
  }

  const openEditContent = (mat) => {
    setEditingContent(mat)
    setContentModalDefaultModuleId(mat.moduleId)
    setContentModalOpen(true)
  }

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
      expandModule(targetModuleId)
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

  const moveContentToModule = async (src, targetModuleId) => {
    const newSession = (contentsByModuleId[targetModuleId]?.length || 0) + 1
    try {
      await saveMaterial({ id: src.id, moduleId: targetModuleId, session: newSession })
      expandModule(targetModuleId)
      showToast('Conteúdo movido de módulo!')
    } catch (err) {
      showToast(err.message || 'Erro ao mover conteúdo entre módulos.', 'error')
    }
  }

  const handleContentDragStart = (e, mat) => { setDragContentId(mat.id); e.dataTransfer.effectAllowed = 'move' }
  const handleContentDragOver = (e, mat) => { e.preventDefault(); if (mat.id !== dragContentId) setDragOverContentId(mat.id) }
  const handleContentDragEnd = () => { setDragContentId(null); setDragOverContentId(null); setDragOverModuleId(null) }
  const handleContentDrop = async (e, target) => {
    e.preventDefault()
    setDragOverContentId(null)
    const contentId = dragContentId
    setDragContentId(null)
    if (!contentId || contentId === target.id) return
    const src = courseMaterials.find(m => m.id === contentId)
    if (!src) return

    if (Number(src.moduleId) === Number(target.moduleId)) {
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
      return
    }

    await moveContentToModule(src, Number(target.moduleId))
  }

  const handleContentDropOnModule = async (e, targetModule) => {
    e.preventDefault()
    setDragOverModuleId(null)
    const contentId = dragContentId
    setDragContentId(null)
    if (!contentId) return
    const src = courseMaterials.find(m => m.id === contentId)
    if (!src || Number(src.moduleId) === Number(targetModule.id)) return
    await moveContentToModule(src, targetModule.id)
  }

  const handleModuleRowDragOver = (e, m) => {
    if (dragContentId) {
      e.preventDefault()
      if (dragOverModuleId !== m.id) setDragOverModuleId(m.id)
      return
    }
    if (canManageModules && reorderingAllowed) handleModuleDragOver(e, m)
  }

  const handleModuleRowDrop = (e, m) => {
    if (dragContentId) return handleContentDropOnModule(e, m)
    if (canManageModules && reorderingAllowed) return handleModuleDrop(e, m)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button
            onClick={() => navigate('/cursos')}
            className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mb-1.5 group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            Voltar para Cursos
          </button>
          <h1 className="page-title">Produção do curso</h1>
          <p className="page-subtitle">Curso: {course.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageModules && (
            <button onClick={() => { setEditingModule(null); setNewModuleOpen(true) }} className="btn-secondary text-sm">
              <Plus size={14} />
              Novo módulo
            </button>
          )}
          {canEditContent && (
            <button
              onClick={() => openNewContentFor(sortedModules[0]?.id || '')}
              disabled={modules.length === 0}
              title={modules.length === 0 ? 'Crie um módulo antes de adicionar conteúdo.' : undefined}
              className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              Novo conteúdo
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Layers} iconBg="bg-brand-100" iconColor="text-brand-700" value={stats.modulos} label="Módulos" />
        <StatCard icon={FileText} iconBg="bg-blue-100" iconColor="text-blue-700" value={stats.conteudos} label="Conteúdos" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" value={stats.emProducao} label="Em produção" />
        <StatCard icon={Eye} iconBg="bg-purple-100" iconColor="text-purple-700" value={stats.aguardando} label="Aguardando validação" />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600" value={stats.aprovados} label="Aprovados" />
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
        <div className="card p-0 overflow-hidden">
          {/* Estrutura do curso: cabecalho com busca e filtro */}
          <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Estrutura do curso</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={structureSearch}
                  onChange={e => setStructureSearch(e.target.value)}
                  placeholder="Buscar por módulo ou conteúdo..."
                  className="input-field pl-8 text-xs py-2 w-64"
                />
              </div>
              <div className="relative">
                <button onClick={() => setFiltersOpen(v => !v)} className="btn-secondary text-xs py-2">
                  <Filter size={13} />
                  Filtros{statusFilter ? ' (1)' : ''}
                </button>
                {filtersOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50 text-left">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Status do módulo</label>
                      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-field text-xs">
                        {MODULE_STATUS_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header w-16">Ordem</th>
                  <th className="table-header">Item</th>
                  <th className="table-header w-14">Tipo</th>
                  <th className="table-header w-36">Professor(a)</th>
                  <th className="table-header w-28">Link</th>
                  <th className="table-header w-36">Supervisor(a)</th>
                  <th className="table-header w-36">Coordenador(a)</th>
                  <th className="table-header w-28">Ações</th>
                </tr>
              </thead>
              <tbody>
                {structureRows.map(({ module: m, allContents, visibleContents, forceExpand }) => {
                  const isExpanded = forceExpand || !collapsedModuleIds.has(m.id)
                  const isDraggingModule = dragModuleId === m.id
                  const isDragOverModule = dragOverModuleId === m.id
                  const moduleMenuKey = `module-${m.id}`
                  const summary = getContentApprovalSummary(allContents)
                  const canSend = m.stage === 'producao' && (isAdmin || isProducer)
                  const canPublishModule = canPublishThisModule(m, summary)
                  const hasMenuActions = canSend || canPublishModule || canDeleteThisModule(m)

                  return (
                    <Fragment key={m.id}>
                      <tr
                        draggable={canManageModules && reorderingAllowed}
                        onDragStart={canManageModules && reorderingAllowed ? e => handleModuleDragStart(e, m) : undefined}
                        onDragOver={e => handleModuleRowDragOver(e, m)}
                        onDrop={e => handleModuleRowDrop(e, m)}
                        onDragEnd={handleModuleDragEnd}
                        className={`border-b border-gray-100 bg-gray-50/60 transition-colors
                          ${isDraggingModule ? 'opacity-40' : ''}
                          ${isDragOverModule ? 'bg-brand-50/50 border-t-2 border-t-brand-400' : ''}
                        `}
                      >
                        <td className="table-cell text-center">
                          <div className="flex items-center justify-center gap-1">
                            {canManageModules && reorderingAllowed && <GripVertical size={13} className="text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />}
                            <span className="font-semibold text-gray-600">{m.order}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => toggleModuleCollapsed(m.id)} className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                              <Layers size={14} />
                            </div>
                            <span className="font-bold text-gray-900 whitespace-nowrap">{m.title}</span>
                            <Badge status={getModuleStatusKey(m, allContents)} />
                            <span className="text-xs text-gray-400 whitespace-nowrap">{allContents.length} conteúdo{allContents.length !== 1 ? 's' : ''}</span>
                          </div>
                        </td>
                        <td className="table-cell" />
                        <td className="table-cell" />
                        <td className="table-cell" />
                        <td className="table-cell" />
                        <td className="table-cell" />
                        <td className="table-cell">
                          <div className="flex items-center justify-end gap-1 relative">
                            {canEditContent && (
                              <button
                                onClick={() => openNewContentFor(m.id)}
                                className="btn-secondary text-xs py-1.5 px-2.5 whitespace-nowrap"
                              >
                                <Plus size={12} /> Conteúdo
                              </button>
                            )}
                            {canEditThisModule(m) && (
                              <button
                                onClick={() => { setEditingModule(m); setNewModuleOpen(true) }}
                                title="Editar módulo"
                                className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {hasMenuActions && (
                              <button
                                onClick={() => setOpenMenuKey(k => k === moduleMenuKey ? null : moduleMenuKey)}
                                title="Mais ações"
                                className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
                              >
                                <MoreVertical size={14} />
                              </button>
                            )}
                            {openMenuKey === moduleMenuKey && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuKey(null)} />
                                <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 text-left">
                                  {canSend && (
                                    <button
                                      onClick={() => runAction(m, 'enviar_supervisao')}
                                      disabled={busyAction === `${m.id}:enviar_supervisao` || summary.total === 0 || summary.professorConcluded < summary.total}
                                      title={summary.total === 0 ? 'Adicione ao menos um conteúdo antes de enviar' : summary.professorConcluded < summary.total ? 'Conclua todos os conteúdos antes de enviar' : undefined}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <Send size={14} /> Enviar para supervisão
                                    </button>
                                  )}
                                  {canPublishModule && (
                                    <button
                                      onClick={() => runAction(m, 'publicar')}
                                      disabled={busyAction === `${m.id}:publicar`}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                      <Rocket size={14} /> Publicar módulo
                                    </button>
                                  )}
                                  {canDeleteThisModule(m) && (
                                    <button
                                      onClick={() => { setOpenMenuKey(null); setConfirmDeleteModule(m) }}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 size={14} /> Excluir módulo
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && visibleContents.map((mat, idx) => {
                        const isDragging = dragContentId === mat.id
                        const isDragOver = dragOverContentId === mat.id
                        const rowLocked = m.stage !== 'producao' && !isAdmin
                        const canDrag = canEditContent && !rowLocked && reorderingAllowed
                        return (
                          <tr
                            key={`content-${mat.id}`}
                            draggable={canDrag}
                            onDragStart={canDrag ? e => handleContentDragStart(e, mat) : undefined}
                            onDragOver={canDrag ? e => handleContentDragOver(e, mat) : undefined}
                            onDrop={canDrag ? e => handleContentDrop(e, mat) : undefined}
                            onDragEnd={handleContentDragEnd}
                            className={`border-b border-gray-50 transition-colors
                              ${isDragging ? 'opacity-40' : ''}
                              ${isDragOver ? 'bg-brand-50/30 border-t-2 border-t-brand-400' : 'hover:bg-gray-50/50'}
                            `}
                          >
                            <td className="table-cell text-center text-gray-400">
                              <div className="flex items-center justify-center gap-1">
                                {canDrag && <GripVertical size={12} className="text-gray-200 cursor-grab active:cursor-grabbing flex-shrink-0" />}
                                <span>{m.order}.{idx + 1}</span>
                              </div>
                            </td>
                            <td className="table-cell">
                              <div className="flex items-center gap-2 pl-7 min-w-0">
                                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                  <FileText size={12} />
                                </div>
                                <span className="text-gray-700 truncate max-w-56" title={mat.theme}>{mat.theme}</span>
                              </div>
                            </td>
                            <td className="table-cell"><TypeBadge type={mat.type} iconOnly /></td>
                            <td className="table-cell">
                              <div className="flex items-center gap-1.5">
                                <StackedAvatars responsibles={getMaterialResponsibles(mat)} assignees={materialAssignees} />
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
                            <td className="table-cell"><LinkChip url={mat.adjustedLink || mat.originalLink} /></td>
                            <td className="table-cell">
                              <div className="flex items-center gap-1.5">
                                <MiniAvatar name={course.supervisorName} roleLabel="Supervisor(a)" avatar={course.supervisorAvatar} />
                                {(isPrivileged || isCourseSupervisor) ? (
                                  <InlineStatusSelect
                                    value={mat.supervisorStatus || ''}
                                    options={SUPERVISOR_STATUS_OPTIONS}
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
                                    options={COORDINATOR_STATUS_OPTIONS}
                                    onChange={val => handleContentStatusChange(mat, 'coordinatorStatus', val)}
                                  />
                                ) : (
                                  <Badge status={mat.coordinatorStatus || ''} />
                                )}
                              </div>
                            </td>
                            <td className="table-cell">
                              <div className="flex items-center justify-end gap-0.5">
                                <button onClick={() => setViewContent(mat)} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                  <Eye size={14} />
                                </button>
                                {canEditContent && (
                                  <button onClick={() => openEditContent(mat)} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                                    <Pencil size={14} />
                                  </button>
                                )}
                                {canEditContent && (
                                  <button onClick={() => setConfirmDeleteContent(mat)} title="Excluir" className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {isExpanded && visibleContents.length === 0 && (
                        <tr>
                          <td colSpan={8} className="table-cell text-center py-6 text-gray-400 text-xs pl-10">
                            Nenhum conteúdo vinculado a este módulo ainda.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {structureRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">
                      Nenhum módulo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canManageModules && (
            <button
              onClick={() => { setEditingModule(null); setNewModuleOpen(true) }}
              className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-dashed border-gray-200 text-xs font-medium text-gray-500 hover:text-brand-700 hover:bg-gray-50/50 transition-colors"
            >
              <Plus size={13} />
              Adicionar módulo
            </button>
          )}
          <div className="px-5 py-2.5 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-400">
            <Info size={12} />
            Dica: arraste os itens para reordenar módulos e conteúdos.
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
              <div className="text-xs font-medium text-gray-500 mb-1">Professor(a)</div>
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
              <div className="text-xs font-medium text-gray-500 mb-1">Supervisor(a)</div>
              <Badge status={viewContent.supervisorStatus || ''} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1">Coordenador(a)</div>
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
          modules={sortedModules}
          defaultModuleId={contentModalDefaultModuleId}
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
        message={
          moduleContentCounts[confirmDeleteModule?.id]
            ? `Tem certeza que deseja excluir "${confirmDeleteModule?.title}"? Os ${moduleContentCounts[confirmDeleteModule.id]} conteúdo(s) vinculado(s) a este módulo também serão excluídos permanentemente. Essa ação não pode ser desfeita.`
            : `Tem certeza que deseja excluir "${confirmDeleteModule?.title}"? Essa ação não pode ser desfeita.`
        }
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
