import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, CheckCircle, Send, Rocket, Trash2, Pencil, Eye,
  Link2, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, MoreVertical, Filter, Info,
  Layers, FileText, X, MessageSquare, ChevronUp, Columns, ClipboardCopy,
} from 'lucide-react'
import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useTheme } from '../../context/ThemeContext'
import api, { getApiErrorMessage } from '../../lib/api'
import {
  PROFESSOR_STATUS_OPTIONS,
  SUPERVISOR_STATUS_OPTIONS,
  COORDINATOR_STATUS_OPTIONS,
  REVISOR_STATUS_OPTIONS,
  MATERIAL_TYPE_OPTIONS,
  getMaterialResponsibles,
  TYPE_LABELS,
  TypeBadge,
  LinkChip,
  LinkIconOnly,
  CopyField,
  copyToClipboard,
  MiniAvatar,
  StackedAvatars,
  InlineStatusSelect,
} from './shared'

// Colunas da tabela "Estrutura do curso". Ordem/Item/Ações sao estruturais e nao podem
// ser ocultadas; as demais entram no menu "Colunas" e ficam salvas por usuario.
const STRUCTURE_COLUMNS = [
  { key: 'ordem', label: 'Ordem', fixed: true, width: 'w-20' },
  { key: 'item', label: 'Item', fixed: true, width: '' },
  { key: 'tipo', label: 'Tipo', width: 'w-14' },
  { key: 'professor', label: 'Professor(a)', width: 'w-32' },
  { key: 'link', label: 'Link', width: 'w-16' },
  { key: 'linkFinal', label: 'Link final', width: 'w-20' },
  { key: 'supervisor', label: 'Supervisor(a)', width: 'w-32' },
  { key: 'revisor', label: 'Revisor(a)', width: 'w-32' },
  { key: 'coordenador', label: 'Coordenador(a)', width: 'w-32' },
  { key: 'ti', label: 'Status AVA', width: 'w-36' },
  { key: 'acoes', label: 'Ações', fixed: true, width: 'w-24' },
]

const HIDDEN_COLUMNS_KEY = 'transforma:producao:hidden-columns'

// Cor de cada tipo de conteudo no card "Arquivos do curso" (contagem por tipo).
const TYPE_COLORS = {
  videoaula: '#7c3aed',
  apresentacao: '#2563eb',
  ebook: '#0891b2',
  pdf: '#dc2626',
  material_complementar: '#64748b',
  atividade_escrita: '#16a34a',
  atividade_interativa: '#f59e0b',
  atividade_objetiva: '#d946ef',
  avaliacao_final: '#e11d48',
  forum: '#0d9488',
  podcast: '#8b5cf6',
  outro: '#f97316',
}
const TYPE_FALLBACK_COLOR = '#94a3b8'

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
  description: '',
  duration: '',
  deliveryDate: '',
  responsibles: [],
  originalLink: '',
  adjustedLink: '',
  status: 'nao_iniciado',
  reviewNotes: '',
  revisorId: '',
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
    revisorApproved: contents.filter(c => c.revisorStatus === 'aprovado').length,
    anyNeedsAttention: contents.some(c =>
      c.supervisorStatus === 'ajustes' || c.coordinatorStatus === 'ajustes' || c.coordinatorStatus === 'reprovado' ||
      c.revisorStatus === 'ajustes' || c.revisorStatus === 'reprovado'
    ),
  }
}

// So exige aprovacao do(a) revisor(a) em cursos que tem revisor(es) configurado(s) na equipe
// (mesma regra condicional aplicada no backend em PATCH /modules/:id/status, acao "publicar").
function getModuleStatusKey(m, contents = [], hasRevisors = false) {
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
  const coordinatorDone = summary.coordinatorApproved === summary.total
  const revisorDone = !hasRevisors || summary.revisorApproved === summary.total
  if (coordinatorDone && revisorDone) return 'aprovado'
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
        description: editing.description || '',
        duration: editing.duration || '',
        deliveryDate: editing.deliveryDate || '',
        responsibles: getMaterialResponsibles(editing),
        originalLink: editing.originalLink || '',
        adjustedLink: editing.adjustedLink || '',
        status: editing.status || 'nao_iniciado',
        reviewNotes: editing.reviewNotes || '',
        revisorId: editing.revisorId || '',
      })
    } else {
      setForm({ ...EMPTY_CONTENT_FORM, moduleId: defaultModuleId || '' })
    }
    setError('')
  }, [open, editing, defaultModuleId])

  const producers = course.producers || []
  const revisorsPool = course.revisors || []

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
      revisorId: form.revisorId || null,
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

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Descrição do conteúdo
            <span className="font-normal text-gray-400"> — texto usado na publicação do AVA</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-field resize-none"
            rows={3}
            placeholder="Escreva a descrição que aparecerá para o cursista no AVA..."
          />
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

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Revisor(a)</label>
          <select value={form.revisorId} onChange={e => setForm(f => ({ ...f, revisorId: e.target.value }))} className="select-field">
            <option value="">Nenhum revisor(a) selecionado</option>
            {revisorsPool.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          {revisorsPool.length === 0 && <p className="text-xs text-gray-400 mt-1">Nenhum(a) revisor(a) vinculado ao curso. Opcional.</p>}
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

// Donut de progresso em SVG puro (o projeto nao usa lib de grafico).
// Trilha e textos vem do tema: em SVG as cores sao atributos, entao as classes
// utilitarias do modo escuro nao alcancam este desenho.
function ProgressDonut({ segments, total, percent }) {
  const { dark } = useTheme()
  const size = 132
  const stroke = 16
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const trackColor = dark ? '#30185A' : '#f1f5f9'
  const valueColor = dark ? '#F5F1FF' : '#111827'
  const captionColor = dark ? '#A594CE' : '#9ca3af'

  let cursor = 0
  const arcs = segments
    .filter(segment => segment.value > 0)
    .map(segment => {
      const length = (segment.value / total) * circumference
      const arc = { ...segment, length, offset: cursor }
      cursor += length
      return arc
    })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        {total > 0 && arcs.map(arc => (
          <circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
      </g>
      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fill={valueColor} style={{ fontSize: 27, fontWeight: 800 }}>
        {percent}%
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fill={captionColor} style={{ fontSize: 11 }}>
        Concluído
      </text>
    </svg>
  )
}

function TeamMember({ label, name, avatar, icon: Icon, extra = 0, subtitle }) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const caption = subtitle ?? name

  return (
    <div className="flex-1 min-w-[88px] rounded-xl border border-gray-100 bg-gray-50/60 px-2 py-3 flex flex-col items-center gap-2 text-center">
      <div className="relative">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden select-none ${
          Icon ? 'bg-brand-50 text-brand-600' : 'bg-brand-700 text-white font-semibold'
        }`}>
          {Icon
            ? <Icon size={20} />
            : avatar
              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
              : (initials || <span className="text-white/60">—</span>)}
        </div>
        {extra > 0 && (
          <span
            title={`+${extra} ${label.toLowerCase()}(es)`}
            className="absolute -right-1 bottom-0 px-1.5 h-5 min-w-5 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
          >
            +{extra}
          </span>
        )}
      </div>
      <div className="min-w-0 w-full">
        <div className="text-xs font-semibold text-gray-800 leading-tight">{label}</div>
        <div className="text-[11px] text-brand-600 truncate leading-tight mt-0.5" title={caption || undefined}>
          {caption || '—'}
        </div>
      </div>
    </div>
  )
}

// Avatares empilhados dos professores produtores, menores que os cards de papel.
function ProducerAvatars({ producers = [], max = 6 }) {
  if (producers.length === 0) return <span className="text-xs text-gray-400">Nenhum professor vinculado</span>
  const visible = producers.slice(0, max)
  const extra = producers.length - visible.length

  return (
    <div className="flex items-center">
      {visible.map((producer, index) => {
        const initials = (producer.name || '').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
        return (
          <div key={producer.id || index} className={`relative group ${index > 0 ? '-ml-2' : ''}`} style={{ zIndex: visible.length - index }}>
            <div className="w-8 h-8 rounded-full bg-brand-700 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white overflow-hidden select-none">
              {producer.avatar
                ? <img src={producer.avatar} alt={producer.name} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">{producer.name}</div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
            </div>
          </div>
        )
      })}
      {extra > 0 && (
        <div className="-ml-2 w-8 h-8 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center border-2 border-white flex-shrink-0">
          +{extra}
        </div>
      )}
    </div>
  )
}

export default function ModulosWorkspace({ course }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { materials, materialAssignees, saveMaterial, deleteMaterial, updateMaterialStatus, updateMaterialPublished, updateMaterialSession, loadCourses } = useData()

  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsedModuleIds, setCollapsedModuleIds] = useState(() => new Set())
  const [structureSearch, setStructureSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [hiddenColumns, setHiddenColumns] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_COLUMNS_KEY) || '[]')
      return new Set(Array.isArray(stored) ? stored : [])
    } catch {
      return new Set()
    }
  })
  const [reorderingId, setReorderingId] = useState(null)
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
  const [revisorNoteTarget, setRevisorNoteTarget] = useState(null)
  const [revisorNoteText, setRevisorNoteText] = useState('')
  const [savingRevisorNote, setSavingRevisorNote] = useState(false)
  const [pendingRevisorStatus, setPendingRevisorStatus] = useState(null)

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
  // Revisor(a) so enxerga cursos onde esta no pool de revisores do curso; o campo de
  // status por conteudo so fica editavel para quem e o revisor atribuido aquele conteudo
  // especifico (verificado por material, nao aqui).
  const isRevisor = user?.role === 'revisor'
  const isCourseRevisor = isRevisor && course.revisors?.some(r => Number(r.id) === Number(user.id))
  const hasRevisors = (course.revisors?.length || 0) > 0
  // Status no AVA: so TI e administrador editam (mesma regra do backend).
  const isTI = user?.role === 'ti'
  const canSetStatusAva = isTI || isAdmin
  const canManageModules = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  // Admin e coordenacao do curso podem sempre alterar qualquer status de qualquer perfil,
  // sem passar pelo gate sequencial (professor -> supervisor -> coordenacao).
  const isPrivileged = isAdmin || isCourseCoordinator

  // Revisor(a) nunca entra aqui de proposito: ele nao pode editar/excluir conteudo ou
  // modulo, so tem acesso ao proprio campo de status por conteudo (ver coluna Revisor(a)).
  const canEditContent = isAdmin || isProducer || isCourseSupervisor || isCourseCoordinator
  const canReviewContent = isAdmin || isCourseSupervisor || isCourseCoordinator

  // Editar qualquer modulo em producao; excluir e do supervisor do curso (so em producao),
  // ou de admin/coordenacao do curso, que podem excluir sempre.
  const canEditThisModule = (m) => !!m && (isAdmin || (canManageModules && m.stage === 'producao'))
  const canDeleteThisModule = (m) => !!m && (isPrivileged || (isCourseSupervisor && m.stage === 'producao'))
  // So exige aprovacao do(a) revisor(a) em cursos que tem revisor(es) configurado(s) --
  // mesma regra condicional do backend em PATCH /modules/:id/status, acao "publicar".
  const canPublishThisModule = (m, summary) => (isAdmin || isCourseCoordinator) && m.stage === 'supervisao'
    && summary.total > 0 && summary.coordinatorApproved === summary.total
    && (!hasRevisors || summary.revisorApproved === summary.total)

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

  // Progresso geral por CONTEUDO (nao por modulo), seguindo o fluxo
  // professor -> supervisor -> coordenacao (-> revisor, quando o curso tem revisores).
  // As quatro faixas sao mutuamente exclusivas para o donut fechar em 100%.
  const progress = useMemo(() => {
    const total = courseMaterials.length
    let concluidos = 0
    let emRevisao = 0
    let emProducao = 0
    let pendentes = 0

    courseMaterials.forEach(m => {
      const aprovado = m.supervisorStatus === 'aprovado'
        && m.coordinatorStatus === 'aprovado'
        && (!hasRevisors || m.revisorStatus === 'aprovado')
      if (aprovado) { concluidos += 1; return }
      // Entregue pelo professor, aguardando supervisao/coordenacao/revisao.
      if (m.status === 'concluido') { emRevisao += 1; return }
      if (m.status === 'em_execucao' || m.status === 'em_ajustes') { emProducao += 1; return }
      pendentes += 1
    })

    const pct = (value) => (total > 0 ? Math.round((value / total) * 100) : 0)

    return {
      total,
      concluidos,
      emRevisao,
      emProducao,
      pendentes,
      percent: pct(concluidos),
      segments: [
        { key: 'concluidos', label: 'Concluídos', value: concluidos, pct: pct(concluidos), color: '#16a34a' },
        { key: 'emProducao', label: 'Em produção', value: emProducao, pct: pct(emProducao), color: '#eab308' },
        { key: 'emRevisao', label: 'Em revisão', value: emRevisao, pct: pct(emRevisao), color: '#4f46e5' },
        { key: 'pendentes', label: 'Pendentes', value: pendentes, pct: pct(pendentes), color: '#f97316' },
      ],
    }
  }, [courseMaterials, hasRevisors])

  // Contagem por tipo de conteudo, exatamente como esta na coluna "tipo":
  // so aparecem os tipos que o curso realmente usa, do mais frequente para o menos.
  const files = useMemo(() => {
    const counts = new Map()

    courseMaterials.forEach(m => {
      const type = (Array.isArray(m.type) ? m.type.filter(Boolean)[0] : m.type) || 'outro'
      counts.set(type, (counts.get(type) || 0) + 1)
    })

    const total = courseMaterials.length
    const items = [...counts.entries()]
      .map(([type, value]) => ({
        key: type,
        label: TYPE_LABELS[type] || type,
        color: TYPE_COLORS[type] || TYPE_FALLBACK_COLOR,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

    return { total, items }
  }, [courseMaterials])

  const sortedModules = useMemo(() => [...modules].sort((a, b) => (a.order || 0) - (b.order || 0)), [modules])

  const reorderingAllowed = !structureSearch.trim() && !statusFilter

  const structureRows = useMemo(() => {
    const q = structureSearch.trim().toLowerCase()
    return sortedModules
      .map(m => {
        const allContents = (contentsByModuleId[m.id] || []).slice().sort((a, b) => Number(a.session) - Number(b.session))
        if (statusFilter && getModuleStatusKey(m, allContents, hasRevisors) !== statusFilter) return null
        if (!q) return { module: m, allContents, visibleContents: allContents, forceExpand: false }
        const moduleMatches = m.title?.toLowerCase().includes(q)
        const matchingContents = allContents.filter(c => c.theme?.toLowerCase().includes(q))
        if (moduleMatches) return { module: m, allContents, visibleContents: allContents, forceExpand: true }
        if (matchingContents.length > 0) return { module: m, allContents, visibleContents: matchingContents, forceExpand: true }
        return null
      })
      .filter(Boolean)
  }, [sortedModules, contentsByModuleId, structureSearch, statusFilter, hasRevisors])

  const visibleColumns = useMemo(
    () => STRUCTURE_COLUMNS.filter(col => col.fixed || !hiddenColumns.has(col.key)),
    [hiddenColumns]
  )
  const isColumnVisible = (key) => visibleColumns.some(col => col.key === key)
  // A linha do modulo funde as colunas do meio: sem isso o titulo (longo e sem quebra)
  // esticava a coluna Item e abria o vao entre Item e Tipo.
  const moduleTitleColSpan = Math.max(1, visibleColumns.length - 2)

  const toggleColumn = (key) => {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const resetColumns = () => {
    setHiddenColumns(new Set())
    try { localStorage.removeItem(HIDDEN_COLUMNS_KEY) } catch {}
  }

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

  const handleTogglePublished = async (mat, published) => {
    try {
      await updateMaterialPublished(mat.id, published)
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar publicação no AVA.', 'error')
    }
  }

  /* ── reordenacao por setas (a numeracao e posicional, entao se atualiza sozinha) ── */

  const moveModule = async (m, direction) => {
    const idx = sortedModules.findIndex(x => x.id === m.id)
    const targetIdx = idx + direction
    if (idx === -1 || targetIdx < 0 || targetIdx >= sortedModules.length) return

    const previous = sortedModules
    const reordered = [...sortedModules]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, moved)
    const renumbered = reordered.map((x, i) => ({ ...x, order: i + 1 }))

    setModules(renumbered)
    setReorderingId(`module-${m.id}`)
    try {
      await Promise.all(
        renumbered
          .filter(x => (previous.find(o => o.id === x.id)?.order || 0) !== x.order)
          .map(x => api.patch(`/modules/${x.id}/order`, { order: x.order }))
      )
    } catch (err) {
      setModules(previous)
      showToast(getApiErrorMessage(err, 'Erro ao reordenar módulos.'), 'error')
    } finally {
      setReorderingId(null)
    }
  }

  const moveContent = async (mat, direction, siblings) => {
    const idx = siblings.findIndex(c => c.id === mat.id)
    const targetIdx = idx + direction
    if (idx === -1 || targetIdx < 0 || targetIdx >= siblings.length) return

    const reordered = [...siblings]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, moved)

    setReorderingId(`content-${mat.id}`)
    try {
      // Renumera as sessoes na nova ordem (1..N) e envia so o que mudou -- assim a
      // numeracao nao depende de os valores antigos estarem sequenciais.
      await Promise.all(
        reordered
          .map((c, i) => ({ content: c, session: i + 1 }))
          .filter(({ content, session }) => Number(content.session) !== session)
          .map(({ content, session }) => updateMaterialSession(content.id, session))
      )
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao reordenar conteúdos.'), 'error')
    } finally {
      setReorderingId(null)
    }
  }

  // Revisor(a) nao tem acesso ao formulario completo de edicao de conteudo (so pode ver,
  // aprovar/pedir ajuste e comentar) -- por isso o parecer dele(a) usa este modal enxuto
  // em vez do ContentModal, que exigiria permissao de editar/excluir que o revisor nao tem.
  const openRevisorNote = (mat, status) => {
    setRevisorNoteTarget(mat)
    setPendingRevisorStatus(status)
    setRevisorNoteText(mat.reviewNotes || '')
  }

  const handleSaveRevisorNote = async () => {
    if (!revisorNoteTarget) return
    setSavingRevisorNote(true)
    try {
      await updateMaterialStatus(revisorNoteTarget.id, {
        revisorStatus: pendingRevisorStatus,
        reviewNotes: revisorNoteText,
      })
      setRevisorNoteTarget(null)
      setPendingRevisorStatus(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar parecer.'), 'error')
    } finally {
      setSavingRevisorNote(false)
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
      {/* Header: identificacao do curso + busca, colunas, filtros e acoes */}
      <div className="flex items-start justify-between flex-wrap gap-3">
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {modules.length > 0 && (
            <>
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
                <button onClick={() => setColumnsOpen(v => !v)} className="btn-secondary text-sm">
                  <Columns size={14} />
                  Colunas{hiddenColumns.size ? ` (${hiddenColumns.size})` : ''}
                </button>
                {columnsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColumnsOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-50 text-left">
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-700">Exibir colunas</div>
                      <div className="max-h-72 overflow-y-auto">
                        {STRUCTURE_COLUMNS.filter(col => !col.fixed).map(col => (
                          <label
                            key={col.key}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-xs text-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={!hiddenColumns.has(col.key)}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={resetColumns}
                        disabled={hiddenColumns.size === 0}
                        className="w-full mt-1 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Mostrar todas
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setFiltersOpen(v => !v)} className="btn-secondary text-sm">
                  <Filter size={14} />
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
            </>
          )}
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

      {/* Equipe envolvida + Progresso geral + Arquivos do curso */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Equipe envolvida</h3>
          <div className="flex items-stretch gap-2">
            <TeamMember label="Coordenador" name={course.coordinatorName} avatar={course.coordinatorAvatar} />
            <TeamMember label="Supervisor" name={course.supervisorName} avatar={course.supervisorAvatar} />
            <TeamMember
              label="Revisor"
              name={course.revisors?.[0]?.name}
              avatar={course.revisors?.[0]?.avatar}
              extra={Math.max(0, (course.revisors?.length || 0) - 1)}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <div className="text-xs text-gray-500 mb-2">
              Professores no curso · <span className="font-bold text-gray-900">{course.producers?.length || 0}</span>
            </div>
            <div className="flex justify-center">
              <ProducerAvatars producers={course.producers || []} max={8} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Progresso geral</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <ProgressDonut segments={progress.segments} total={progress.total} percent={progress.percent} />
            <div className="flex-1 min-w-[170px] space-y-2">
              {progress.segments.map(segment => (
                <div key={segment.key} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: segment.color }} />
                  <span className="flex-1 text-gray-600">{segment.label}</span>
                  <span className="font-semibold text-gray-800">{segment.value}</span>
                  <span className="text-gray-400 w-11 text-right">({segment.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-gray-100 text-xs text-gray-500">
            {progress.concluidos} de {progress.total} conteúdo{progress.total !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Arquivos do curso</h3>
          {/* Duas colunas onde ha largura; uma so na faixa em que o card fica estreito. */}
          <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-3 flex-1 content-start">
            {files.items.map(item => (
              <div key={item.key}>
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <span className="text-gray-600 truncate" title={item.label}>{item.label}</span>
                  <span className="flex-shrink-0">
                    <span className="font-semibold text-gray-800">{item.value}</span>
                    <span className="text-gray-400"> ({item.pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
            {files.items.length === 0 && (
              <span className="text-xs text-gray-400">Nenhum conteúdo cadastrado ainda.</span>
            )}
          </div>
          <div className="pt-3 mt-3 border-t border-gray-100 text-xs text-gray-500">
            {files.total} arquivo{files.total !== 1 ? 's' : ''} no total · {files.items.length} tipo{files.items.length !== 1 ? 's' : ''}
          </div>
        </div>
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
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Estrutura do curso</h3>
          </div>

          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {visibleColumns.map(col => (
                    <th key={col.key} className={`table-header px-2 ${col.width}`}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {structureRows.map(({ module: m, allContents, visibleContents, forceExpand }, moduleIndex) => {
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
                        <td className="table-cell px-2">
                          <div className="flex items-center justify-center gap-0.5">
                            {canManageModules && reorderingAllowed && (
                              <div className="flex flex-col -space-y-1">
                                <button
                                  onClick={() => moveModule(m, -1)}
                                  disabled={moduleIndex === 0 || !!reorderingId}
                                  title="Mover módulo para cima"
                                  className="p-0.5 text-gray-300 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                                >
                                  <ChevronUp size={13} />
                                </button>
                                <button
                                  onClick={() => moveModule(m, 1)}
                                  disabled={moduleIndex === structureRows.length - 1 || !!reorderingId}
                                  title="Mover módulo para baixo"
                                  className="p-0.5 text-gray-300 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                                >
                                  <ChevronDown size={13} />
                                </button>
                              </div>
                            )}
                            <span className="font-semibold text-gray-600">{m.order}</span>
                          </div>
                        </td>
                        <td className="table-cell px-2" colSpan={moduleTitleColSpan}>
                          <div className="flex items-center gap-2 min-w-0">
                            <button onClick={() => toggleModuleCollapsed(m.id)} className="p-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                              <Layers size={14} />
                            </div>
                            <span className="font-bold text-gray-900 whitespace-nowrap">{m.title}</span>
                            <Badge status={getModuleStatusKey(m, allContents, hasRevisors)} />
                            <span className="text-xs text-gray-400 whitespace-nowrap">{allContents.length} conteúdo{allContents.length !== 1 ? 's' : ''}</span>
                          </div>
                        </td>
                        <td className="table-cell px-2">
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
                        // Reordenar conteudo passa por PATCH /materials/:id/session, que no backend
                        // exige admin/supervisor/coordenacao -- professor arrasta mas nao renumera.
                        const canReorderThisContent = canReviewContent && !rowLocked && reorderingAllowed
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
                            <td className="table-cell px-2 text-gray-400">
                              <div className="flex items-center justify-center gap-0.5">
                                {canReorderThisContent && (
                                  <div className="flex flex-col -space-y-1">
                                    <button
                                      onClick={() => moveContent(mat, -1, visibleContents)}
                                      disabled={idx === 0 || !!reorderingId}
                                      title="Mover conteúdo para cima"
                                      className="p-0.5 text-gray-300 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      onClick={() => moveContent(mat, 1, visibleContents)}
                                      disabled={idx === visibleContents.length - 1 || !!reorderingId}
                                      title="Mover conteúdo para baixo"
                                      className="p-0.5 text-gray-300 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                  </div>
                                )}
                                <span>{m.order}.{idx + 1}</span>
                                {/* Confirmacao visual de que o TI ja publicou este conteudo no AVA. */}
                                {mat.published && (
                                  <span title="Publicado no AVA" className="text-green-600 flex-shrink-0">
                                    <CheckCircle size={13} />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="table-cell px-2">
                              <div className="flex items-center gap-2 pl-7 min-w-0">
                                <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                                  <FileText size={12} />
                                </div>
                                <span className="text-gray-700 truncate" title={mat.theme}>{mat.theme}</span>
                              </div>
                            </td>
                            {isColumnVisible('tipo') && (
                              <td className="table-cell px-2"><TypeBadge type={mat.type} iconOnly /></td>
                            )}
                            {isColumnVisible('professor') && (
                              <td className="table-cell px-2">
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
                            )}
                            {isColumnVisible('link') && (
                              <td className="table-cell px-2"><LinkIconOnly url={mat.originalLink} label="Link" /></td>
                            )}
                            {isColumnVisible('linkFinal') && (
                              <td className="table-cell px-2"><LinkIconOnly url={mat.adjustedLink} label="Link final" /></td>
                            )}
                            {isColumnVisible('supervisor') && (
                              <td className="table-cell px-2">
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
                            )}
                            {isColumnVisible('revisor') && (
                              <td className="table-cell px-2">
                                <div className="flex items-center gap-1.5">
                                  <MiniAvatar
                                    name={mat.revisorName}
                                    roleLabel="Revisor(a)"
                                    avatar={course.revisors?.find(r => Number(r.id) === Number(mat.revisorId))?.avatar || null}
                                  />
                                  {(() => {
                                    const isAssignedRevisor = isRevisor && Number(mat.revisorId) === Number(user?.id)
                                    if (!isPrivileged && !isAssignedRevisor) {
                                      return <Badge status={mat.revisorStatus || ''} />
                                    }
                                    return (
                                      <>
                                        <InlineStatusSelect
                                          value={mat.revisorStatus || ''}
                                          options={REVISOR_STATUS_OPTIONS}
                                          onChange={val => {
                                            if (!isPrivileged && val === 'aprovado' && mat.coordinatorStatus !== 'aprovado') {
                                              showToast('Só é possível aprovar após a coordenação aprovar este conteúdo.', 'error')
                                              return
                                            }
                                            if (val === 'ajustes' || val === 'reprovado') {
                                              openRevisorNote(mat, val)
                                              return
                                            }
                                            handleContentStatusChange(mat, 'revisorStatus', val)
                                          }}
                                        />
                                        {isAssignedRevisor && (
                                          <button
                                            onClick={() => openRevisorNote(mat, mat.revisorStatus || '')}
                                            title="Deixar parecer/comentário"
                                            className="p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
                                          >
                                            <MessageSquare size={13} />
                                          </button>
                                        )}
                                      </>
                                    )
                                  })()}
                                </div>
                              </td>
                            )}
                            {isColumnVisible('coordenador') && (
                              <td className="table-cell px-2">
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
                            )}
                            {isColumnVisible('ti') && (
                              <td className="table-cell px-2">
                                {canSetStatusAva ? (
                                  <select
                                    value={mat.published ? 'publicado' : 'nao_publicado'}
                                    onChange={e => handleTogglePublished(mat, e.target.value === 'publicado')}
                                    className={`text-xs font-medium px-2 py-0.5 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-400 ${
                                      mat.published
                                        ? 'text-green-700 bg-green-50 border-green-200'
                                        : 'text-gray-600 bg-gray-50 border-gray-200'
                                    }`}
                                  >
                                    <option value="nao_publicado">Não publicado</option>
                                    <option value="publicado">Publicado</option>
                                  </select>
                                ) : (
                                  <Badge status={mat.published ? 'publicado' : 'nao_publicado'} />
                                )}
                              </td>
                            )}
                            <td className="table-cell px-2">
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
                          <td colSpan={visibleColumns.length} className="table-cell text-center py-6 text-gray-400 text-xs pl-10">
                            Nenhum conteúdo vinculado a este módulo ainda.
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {structureRows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="table-cell text-center py-10 text-gray-400 text-sm">
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
            Dica: use as setas na coluna Ordem (ou arraste os itens) para reordenar módulos e conteúdos.
          </div>
        </div>
      )}

      {/* Ficha do conteudo pronta para publicacao no AVA (Moodle): cada campo tem botao
          de copiar, alem do "Copiar tudo" com o bloco completo. */}
      {viewContent && (() => {
        const viewModule = modules.find(mod => Number(mod.id) === Number(viewContent.moduleId))
        const siblings = (contentsByModuleId[viewContent.moduleId] || [])
          .slice()
          .sort((a, b) => Number(a.session) - Number(b.session))
        const position = siblings.findIndex(c => c.id === viewContent.id)
        const orderLabel = viewModule && position >= 0 ? `${viewModule.order}.${position + 1}` : '—'
        const typeList = Array.isArray(viewContent.type) ? viewContent.type : [viewContent.type].filter(Boolean)
        const typeLabel = typeList.map(t => TYPE_LABELS[t] || t).join(', ')
        const professores = getMaterialResponsibles(viewContent).map(r => r.name).filter(Boolean).join(', ')
        const finalLink = viewContent.adjustedLink || viewContent.originalLink || ''

        const fullBlock = [
          `Curso: ${course.name}`,
          `Módulo: ${viewModule?.title || '—'}`,
          `Ordem: ${orderLabel}`,
          `Título: ${viewContent.theme || '—'}`,
          `Tipo: ${typeLabel || '—'}`,
          `Descrição: ${viewContent.description || '—'}`,
          `Objetivo: ${viewContent.objective || '—'}`,
          `Duração: ${viewContent.duration || '—'}`,
          `Link: ${viewContent.originalLink || '—'}`,
          `Link final: ${viewContent.adjustedLink || '—'}`,
        ].join('\n')

        return (
          <Modal open={!!viewContent} onClose={() => setViewContent(null)} title={viewContent.theme} size="lg">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge status={viewContent.published ? 'publicado' : 'nao_publicado'} showDot />
                  <span className="text-xs text-gray-600">
                    {viewContent.published ? 'Este conteúdo já está publicado no AVA.' : 'Ainda não publicado no AVA.'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canSetStatusAva && (
                    <button
                      onClick={() => {
                        const next = !viewContent.published
                        handleTogglePublished(viewContent, next)
                        setViewContent({ ...viewContent, published: next })
                      }}
                      className={viewContent.published ? 'btn-secondary text-xs py-1.5' : 'btn-primary text-xs py-1.5'}
                    >
                      <CheckCircle size={13} />
                      {viewContent.published ? 'Desmarcar publicado' : 'Marcar como publicado'}
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(fullBlock).then(ok => ok && showToast('Dados copiados para a área de transferência!'))}
                    className="btn-secondary text-xs py-1.5"
                  >
                    <ClipboardCopy size={13} />
                    Copiar tudo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CopyField label="Título" value={viewContent.theme} full />
                <CopyField label="Curso" value={course.name} />
                <CopyField label="Módulo" value={viewModule?.title} />
                <CopyField label="Ordem" value={orderLabel} />
                <CopyField label="Tipo" value={typeLabel} />
                <CopyField label="Descrição" value={viewContent.description} full />
                <CopyField label="Objetivo" value={viewContent.objective} full />
                <CopyField label="Link" value={viewContent.originalLink} mono />
                <CopyField label="Link final" value={viewContent.adjustedLink} mono />
                <CopyField label="Duração" value={viewContent.duration} />
                <CopyField label="Professor(es)" value={professores} />
              </div>

              {finalLink?.startsWith('http') && (
                <div className="flex items-center gap-2 text-xs">
                  <LinkChip url={finalLink} />
                  <span className="text-gray-400">— link que será usado no AVA</span>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Situação da validação</div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">Professor(a)</div>
                    <Badge status={viewContent.status || ''} />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">Supervisor(a)</div>
                    <Badge status={viewContent.supervisorStatus || ''} />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">Revisor(a)</div>
                    <Badge status={viewContent.revisorStatus || ''} />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1">Coordenador(a)</div>
                    <Badge status={viewContent.coordinatorStatus || ''} />
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 mt-3">
                  Prazo de entrega: {formatDateOnly(viewContent.deliveryDate)}
                </div>
              </div>

              {viewContent.reviewNotes && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Parecer / observações da revisão</div>
                  <div className="text-sm text-gray-800 bg-amber-50 border border-amber-100 rounded-lg p-3">{viewContent.reviewNotes}</div>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* Parecer do(a) revisor(a) */}
      {revisorNoteTarget && (
        <Modal
          open={!!revisorNoteTarget}
          onClose={() => { setRevisorNoteTarget(null); setPendingRevisorStatus(null) }}
          title="Parecer do(a) revisor(a)"
          size="md"
          footer={
            <>
              <button onClick={() => { setRevisorNoteTarget(null); setPendingRevisorStatus(null) }} className="btn-secondary" disabled={savingRevisorNote}>
                Cancelar
              </button>
              <button onClick={handleSaveRevisorNote} className="btn-primary" disabled={savingRevisorNote}>
                {savingRevisorNote ? 'Salvando...' : 'Salvar parecer'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Conteúdo: <span className="font-medium text-gray-800">{revisorNoteTarget.theme}</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Comentário para o professor(a)</label>
              <textarea
                value={revisorNoteText}
                onChange={e => setRevisorNoteText(e.target.value)}
                className="input-field resize-none"
                rows={3}
                placeholder="Explique o que precisa ser ajustado..."
                autoFocus
              />
            </div>
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
          canReview={canReviewContent || (isRevisor && Number(editingContent?.revisorId) === Number(user?.id))}
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
