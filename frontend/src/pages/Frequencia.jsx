import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Lock, Calendar, CheckCircle, TrendingUp, Filter, Search, X,
  Eye, Pencil, Trash2, Users, UserCheck, Headphones, UserCog, GraduationCap, BookOpen,
  FileText, Clock, AlertTriangle, LayoutGrid, ListChecks, History, Check,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import api, { getApiErrorMessage } from '../lib/api'

const FREQUENCIA_ROLE_LABELS = {
  supervisor: 'Supervisor',
  revisor: 'Revisor(a)',
  tecnico: 'Apoio tecnico',
  supervisor_tutoria: 'Supervisor de tutoria',
  professor: 'Professor(a)',
  tutor: 'Tutor(a)',
}
const FREQUENCIA_ROLES_ORDER = ['supervisor', 'revisor', 'tecnico', 'supervisor_tutoria', 'professor', 'tutor']

const PERFIL_ICONS = {
  supervisor: Users,
  revisor: UserCheck,
  tecnico: Headphones,
  supervisor_tutoria: UserCog,
  professor: GraduationCap,
  tutor: BookOpen,
}

const LANCAMENTO_STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'em_revisao', label: 'Em revisão' },
]

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function formatMonthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]}/${y}`
}

function monthRangeLabel(month) {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return `01/${mm} a ${lastDay}/${mm}`
}

function criterioTypeLabel(type) {
  return type === 'qualitativo' ? 'Manual' : 'Quantitativo'
}

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// Mesma regra de acesso do backend (canCreateFrequenciaCriterio/frequenciaRolesForActor em
// app.js) replicada aqui so para decidir o que mostrar na UI -- o backend e quem garante de
// verdade a permissao em cada rota.
function frequenciaRolesForUser(user) {
  const isCoord = user?.role === 'coordenador' || (user?.function || '').toLowerCase().includes('coordenador')
  if (user?.role === 'administrador' || isCoord) return FREQUENCIA_ROLES_ORDER
  if (user?.role === 'supervisor') return ['professor']
  return []
}

function fillStatusInfo(avgFill) {
  if (avgFill >= 100) return { label: 'Concluído', cls: 'bg-green-50 text-green-700 border border-green-200' }
  if (avgFill >= 70) return { label: 'Ativo', cls: 'bg-green-50 text-green-700 border border-green-200' }
  if (avgFill > 0) return { label: 'Em andamento', cls: 'bg-blue-50 text-blue-700 border border-blue-200' }
  return { label: 'Pendente', cls: 'bg-amber-50 text-amber-700 border border-amber-200' }
}

function PlaceholderTab({ title, description, icon: Icon }) {
  return (
    <div className="card flex flex-col items-center justify-center text-center py-14 gap-3">
      <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center">
        <Icon size={22} />
      </div>
      <div>
        <p className="font-semibold text-gray-800">{title}</p>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>
      </div>
    </div>
  )
}

function BigAvatar({ name, avatar, size = 44 }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-bold flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-white shadow-sm"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  )
}

/* ─── Novo critério mensal ─── */

const EMPTY_CRITERIO_FORM = {
  role: '', title: '', details: '', type: 'quantitativo', unit: '', target: '',
  activities: [{ title: '', weight: '' }, { title: '', weight: '' }],
  referenceMonth: currentMonth(),
}

function ActivitiesEditor({ activities, onChange }) {
  const total = activities.reduce((sum, a) => sum + (Number(a.weight) || 0), 0)

  const update = (idx, field, value) => {
    onChange(activities.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }
  const add = () => onChange([...activities, { title: '', weight: '' }])
  const remove = (idx) => onChange(activities.filter((_, i) => i !== idx))

  return (
    <div>
      <div className="space-y-1.5">
        {activities.map((a, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              value={a.title}
              onChange={e => update(idx, 'title', e.target.value)}
              className="input-field text-sm flex-1"
              placeholder={`Atividade ${idx + 1}`}
            />
            <input
              type="number" min="0" max="100" value={a.weight}
              onChange={e => update(idx, 'weight', e.target.value)}
              className="input-field text-sm w-20"
              placeholder="%"
            />
            <button type="button" onClick={() => remove(idx)} className="p-1.5 text-gray-300 hover:text-red-500 flex-shrink-0">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <button type="button" onClick={add} className="text-xs font-medium text-brand-600 hover:text-brand-800 flex items-center gap-1">
          <Plus size={12} /> Adicionar atividade
        </button>
        <span className={`text-xs font-semibold ${Math.abs(total - 100) > 0.5 ? 'text-red-500' : 'text-green-600'}`}>Total: {total}%</span>
      </div>
    </div>
  )
}

function NovoCriterioModal({ open, onClose, onSaved, showToast, allowedRoles }) {
  const [form, setForm] = useState(EMPTY_CRITERIO_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewUsers, setPreviewUsers] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [existingCriterio, setExistingCriterio] = useState(null)
  const [checkingExisting, setCheckingExisting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_CRITERIO_FORM, role: allowedRoles[0] || '', referenceMonth: currentMonth(), activities: [{ title: '', weight: '' }, { title: '', weight: '' }] })
    setError('')
  }, [open, allowedRoles])

  // Avisa ANTES de preencher o formulario inteiro se ja existe criterio pra esse perfil+mes
  // (regra de 1 criterio por perfil+mes), em vez do usuario so descobrir no 409 ao salvar.
  useEffect(() => {
    if (!open || !form.role || !form.referenceMonth) { setExistingCriterio(null); return }
    let active = true
    setCheckingExisting(true)
    api.get('/frequencia/criterios/existente', { params: { role: form.role, month: form.referenceMonth } })
      .then(({ data }) => { if (active) setExistingCriterio(data.criterio) })
      .catch(() => { if (active) setExistingCriterio(null) })
      .finally(() => { if (active) setCheckingExisting(false) })
    return () => { active = false }
  }, [open, form.role, form.referenceMonth])

  useEffect(() => {
    if (!open || !form.role) { setPreviewUsers([]); setSelectedUserIds(new Set()); return }
    let active = true
    setLoadingPreview(true)
    api.get('/frequencia/usuarios', { params: { role: form.role } })
      .then(({ data }) => {
        if (!active) return
        setPreviewUsers(data)
        // por padrao comeca com todos marcados, igual ao comportamento anterior (perfil inteiro)
        setSelectedUserIds(new Set(data.map(u => u.id)))
      })
      .catch(() => { if (active) setPreviewUsers([]) })
      .finally(() => { if (active) setLoadingPreview(false) })
    return () => { active = false }
  }, [open, form.role])

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  const toggleAllUsers = () => {
    setSelectedUserIds(prev => prev.size === previewUsers.length ? new Set() : new Set(previewUsers.map(u => u.id)))
  }

  const handleSubmit = async () => {
    if (!form.role) { setError('Selecione o perfil avaliado.'); return }
    if (existingCriterio) { setError(`Já existe o critério "${existingCriterio.title}" para esse perfil neste mês. Edite o critério existente em vez de criar outro.`); return }
    if (selectedUserIds.size === 0) { setError('Selecione ao menos um profissional desse perfil.'); return }
    if (!form.title.trim()) { setError('Informe o título do critério.'); return }
    if (!form.referenceMonth) { setError('Defina a vigência (mês).'); return }
    if (form.type === 'quantitativo' && !(Number(form.target) > 0)) { setError('Informe uma meta do mês válida.'); return }

    let activities = null
    if (form.type === 'qualitativo') {
      activities = form.activities.filter(a => a.title.trim())
      if (activities.length === 0) { setError('Adicione ao menos uma atividade.'); return }
      const total = activities.reduce((sum, a) => sum + (Number(a.weight) || 0), 0)
      if (Math.abs(total - 100) > 0.5) { setError(`A soma dos pesos das atividades deve ser 100% (atual: ${total}%).`); return }
    }

    setSaving(true)
    try {
      await api.post('/frequencia/criterios', {
        role: form.role,
        title: form.title.trim(),
        details: form.details.trim() || null,
        type: form.type,
        unit: form.type === 'quantitativo' ? form.unit.trim() || null : null,
        target: form.type === 'quantitativo' ? Number(form.target) : null,
        activities,
        referenceMonth: form.referenceMonth,
        userIds: Array.from(selectedUserIds),
      })
      showToast('Critério mensal criado!')
      onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erro ao criar critério.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo critério mensal"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving || !!existingCriterio}>
            <CheckCircle size={15} />
            {saving ? 'Salvando...' : 'Criar critério'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil avaliado <span className="text-red-500">*</span></label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="select-field">
            <option value="">Selecionar perfil...</option>
            {allowedRoles.map(role => (
              <option key={role} value={role}>{FREQUENCIA_ROLE_LABELS[role]}</option>
            ))}
          </select>
          {checkingExisting && <p className="text-xs text-gray-400 mt-1.5">Verificando critérios existentes...</p>}
          {!checkingExisting && existingCriterio && (
            <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Já existe o critério <span className="font-semibold">"{existingCriterio.title}"</span> para {FREQUENCIA_ROLE_LABELS[form.role]} em {form.referenceMonth}. Feche este modal e use "Editar regras" para ajustá-lo em vez de criar outro.
            </div>
          )}
          {allowedRoles.length === 0 && <p className="text-xs text-amber-600 mt-1">Você não tem permissão para criar critérios.</p>}
        </div>

        {form.role && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="text-[11px] font-medium text-gray-500">
                {loadingPreview
                  ? 'Carregando usuários...'
                  : `Selecionado${selectedUserIds.size !== 1 ? 's' : ''} ${selectedUserIds.size} de ${previewUsers.length} do perfil ${FREQUENCIA_ROLE_LABELS[form.role]}`}
              </div>
              {!loadingPreview && previewUsers.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllUsers}
                  className="text-[11px] font-medium text-brand-600 hover:text-brand-800 flex-shrink-0"
                >
                  {selectedUserIds.size === previewUsers.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
            </div>
            {!loadingPreview && (
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {previewUsers.map(u => {
                  const checked = selectedUserIds.has(u.id)
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center gap-1.5 border rounded-full pl-1 pr-2.5 py-0.5 transition-colors ${
                        checked ? 'bg-white border-brand-200' : 'bg-transparent border-gray-200 opacity-50 hover:opacity-80'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                        {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : getInitials(u.name)}
                      </span>
                      <span className="text-[11px] text-gray-700">{u.name}</span>
                      {checked && <CheckCircle size={12} className="text-green-600 flex-shrink-0" />}
                    </button>
                  )
                })}
                {previewUsers.length === 0 && <span className="text-[11px] text-gray-400">Nenhum usuário ativo nesse perfil ainda.</span>}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Título do critério <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder="Ex: Produzir materiais do mês" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Detalhes do critério (opcional)</label>
          <textarea
            value={form.details}
            onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
            rows={2}
            className="input-field resize-none"
            placeholder="Explique o que se espera nesse critério..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            {[{ value: 'quantitativo', label: 'Quantitativo' }, { value: 'qualitativo', label: 'Qualitativo' }].map(option => {
              const selected = form.type === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: option.value }))}
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

        {form.type === 'quantitativo' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Unidade</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-field" placeholder="Ex: produções, visitas" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Meta do mês <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="input-field" placeholder="Ex: 10" />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Atividades <span className="text-red-500">*</span></label>
            <p className="text-[11px] text-gray-400 mb-2">Cada atividade concluída soma o peso definido até fechar 100% da frequência.</p>
            <ActivitiesEditor activities={form.activities} onChange={activities => setForm(f => ({ ...f, activities }))} />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Vigência (mês) <span className="text-red-500">*</span></label>
          <input type="month" value={form.referenceMonth} onChange={e => setForm(f => ({ ...f, referenceMonth: e.target.value }))} className="input-field" />
          {form.referenceMonth && <p className="text-[11px] text-gray-400 mt-1">Período: {monthRangeLabel(form.referenceMonth)}</p>}
        </div>
      </div>
    </Modal>
  )
}

/* ─── popup de critérios do usuário (ver / editar) ─── */

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numeric)
}

function getCriteriaCompletion(criteria = []) {
  const total = criteria.length
  const completed = criteria.filter((criterio) => criterio.status === 'concluido').length
  return { total, completed, open: Math.max(0, total - completed) }
}

function getCriteriaTypeSummary(criteria = []) {
  const types = [...new Set(criteria.map((criterio) => criterio.type).filter(Boolean))]
  if (types.length === 0) return 'Sem criterio'
  if (types.length === 1) return criterioTypeLabel(types[0])
  return 'Misto'
}

function getCriterioProgressPct(criterio) {
  if (criterio.type === 'quantitativo') {
    return criterio.frequencyPct === null ? 0 : Math.max(0, Math.min(100, Number(criterio.frequencyPct) || 0))
  }
  if (criterio.status === 'concluido') return 100
  if (criterio.status === 'em_revisao') return 85
  if (criterio.status === 'em_andamento') return 60
  return 0
}

function getCriterioMetaLabel(criterio) {
  if (criterio.type === 'quantitativo') {
    const amount = formatAmount(criterio.target)
    return [amount === '—' ? null : amount, criterio.unit || null].filter(Boolean).join(' ') || '—'
  }
  const totalActivities = criterio.activities?.length || 0
  return `${totalActivities} atividade${totalActivities !== 1 ? 's' : ''}`
}

function getCriterioLaunchLabel(criterio) {
  if (criterio.type === 'quantitativo') {
    if (criterio.realized === null || criterio.realized === undefined || criterio.realized === '') return 'Sem quantidade'
    return [formatAmount(criterio.realized), criterio.unit || null].filter(Boolean).join(' ')
  }
  return criterio.status === 'concluido' ? 'Marcado como feito' : 'Aguardando marcacao'
}

function getQuickQuantitativeStatus(target, realized) {
  if (realized === '' || realized === null || realized === undefined) return 'pendente'
  const numericRealized = Number(realized)
  if (Number.isNaN(numericRealized)) return 'pendente'
  const numericTarget = Number(target)
  if (numericTarget > 0 && numericRealized >= numericTarget) return 'concluido'
  return numericRealized > 0 ? 'em_andamento' : 'pendente'
}

function CriterioEditCard({ criterio, mode, onSaved, showToast }) {
  const [ruleForm, setRuleForm] = useState(() => ({
    title: criterio.title || '',
    details: criterio.details || '',
    unit: criterio.unit || '',
    target: criterio.target ?? '',
    activities: criterio.activities?.length ? criterio.activities : [{ title: '', weight: '' }],
  }))
  const [launchForm, setLaunchForm] = useState(() => ({
    realized: criterio.realized ?? '',
    status: criterio.status || 'pendente',
    notes: criterio.notes || '',
    attachmentNote: criterio.attachmentNote || '',
    registeredAt: criterio.registeredAt || '',
  }))
  const [savingRule, setSavingRule] = useState(false)
  const [savingLaunch, setSavingLaunch] = useState(false)
  const [editingRule, setEditingRule] = useState(mode === 'edit')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const canEditRule = mode === 'edit'

  useEffect(() => {
    setRuleForm({
      title: criterio.title || '',
      details: criterio.details || '',
      unit: criterio.unit || '',
      target: criterio.target ?? '',
      activities: criterio.activities?.length ? criterio.activities : [{ title: '', weight: '' }],
    })
    setLaunchForm({
      realized: criterio.realized ?? '',
      status: criterio.status || 'pendente',
      notes: criterio.notes || '',
      attachmentNote: criterio.attachmentNote || '',
      registeredAt: criterio.registeredAt || '',
    })
    setEditingRule(mode === 'edit')
    setShowAdvanced(false)
  }, [criterio, mode])

  const handleSaveRule = async () => {
    if (criterio.type === 'qualitativo') {
      const activities = ruleForm.activities.filter((activity) => activity.title.trim())
      const total = activities.reduce((sum, activity) => sum + (Number(activity.weight) || 0), 0)
      if (activities.length === 0) { showToast('Adicione ao menos uma atividade.', 'error'); return }
      if (Math.abs(total - 100) > 0.5) { showToast(`A soma dos pesos deve ser 100% (atual: ${total}%).`, 'error'); return }
    }

    setSavingRule(true)
    try {
      await api.put(`/frequencia/criterios/${criterio.criterioId}`, {
        title: ruleForm.title.trim(),
        details: ruleForm.details.trim() || null,
        ...(criterio.type === 'quantitativo'
          ? { unit: ruleForm.unit.trim() || null, target: Number(ruleForm.target) || null }
          : { activities: ruleForm.activities.filter((activity) => activity.title.trim()) }),
      })
      showToast('Criterio atualizado!')
      onSaved()
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar criterio.'), 'error')
    } finally {
      setSavingRule(false)
    }
  }

  const saveLaunch = async (nextForm, successMessage) => {
    if (criterio.type === 'quantitativo' && nextForm.realized !== '' && Number.isNaN(Number(nextForm.realized))) {
      showToast('Informe uma quantidade valida.', 'error')
      return
    }

    setLaunchForm(nextForm)
    setSavingLaunch(true)
    try {
      await api.put(`/frequencia/lancamentos/${criterio.lancamentoId}`, {
        ...(criterio.type === 'quantitativo'
          ? {
              target: criterio.target === null || criterio.target === undefined ? null : Number(criterio.target),
              realized: nextForm.realized === '' ? null : Number(nextForm.realized),
            }
          : {}),
        status: nextForm.status,
        notes: nextForm.notes.trim() || null,
        attachmentNote: nextForm.attachmentNote.trim() || null,
        registeredAt: nextForm.registeredAt || null,
      })
      showToast(successMessage)
      onSaved()
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar lancamento.'), 'error')
    } finally {
      setSavingLaunch(false)
    }
  }

  const handleSaveQuantity = () => {
    const status = getQuickQuantitativeStatus(criterio.target, launchForm.realized)
    saveLaunch({
      ...launchForm,
      status,
      registeredAt: launchForm.realized === '' ? '' : (launchForm.registeredAt || todayDate()),
    }, status === 'concluido' ? 'Quantidade salva e criterio concluido.' : 'Quantidade salva.')
  }

  const handleClearQuantity = () => {
    saveLaunch({
      ...launchForm,
      realized: '',
      status: 'pendente',
      registeredAt: '',
    }, 'Quantidade removida.')
  }

  const handleMarkDone = () => {
    saveLaunch({
      ...launchForm,
      status: 'concluido',
      registeredAt: launchForm.registeredAt || todayDate(),
    }, 'Criterio marcado como feito.')
  }

  const handleResetLaunch = () => {
    saveLaunch({
      ...launchForm,
      status: 'pendente',
      registeredAt: '',
    }, 'Criterio voltou para pendente.')
  }

  const handleSaveAdvanced = () => {
    saveLaunch({
      ...launchForm,
      registeredAt: launchForm.status === 'pendente' && (criterio.type !== 'quantitativo' || launchForm.realized === '')
        ? ''
        : (launchForm.registeredAt || todayDate()),
    }, 'Lancamento atualizado.')
  }

  const progressPct = criterio.type === 'quantitativo' && launchForm.realized !== '' && Number(criterio.target) > 0
    ? Math.max(0, Math.min(100, (Number(launchForm.realized) / Number(criterio.target)) * 100))
    : getCriterioProgressPct(criterio)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {editingRule ? (
            <input value={ruleForm.title} onChange={e => setRuleForm(f => ({ ...f, title: e.target.value }))} className="input-field text-sm font-medium" />
          ) : (
            <span className="font-semibold text-gray-900 text-base">{criterio.title}</span>
          )}

          {editingRule ? (
            <textarea
              value={ruleForm.details}
              onChange={e => setRuleForm(f => ({ ...f, details: e.target.value }))}
              rows={2}
              className="input-field resize-none text-sm mt-2"
              placeholder="Detalhes do criterio (opcional)"
            />
          ) : criterio.details ? (
            <p className="text-sm text-gray-500 mt-1.5">{criterio.details}</p>
          ) : (
            <p className="text-sm text-gray-400 mt-1.5">Sem detalhes adicionais para este criterio.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge status={criterio.status} showDot />
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            {criterioTypeLabel(criterio.type)}
          </span>
          {canEditRule && (
            <button
              type="button"
              onClick={() => setEditingRule((value) => !value)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
            >
              <Pencil size={13} />
              {editingRule ? 'Fechar edicao' : 'Editar regra'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Meta</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">{getCriterioMetaLabel(criterio)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Lancamento atual</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">{getCriterioLaunchLabel(criterio)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Registro</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">{criterio.registeredAt || 'Nao lancado'}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Criado por</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">{criterio.createdBy}</div>
        </div>
      </div>

      {criterio.type === 'quantitativo' ? (
        editingRule && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Unidade</label>
              <input value={ruleForm.unit} onChange={e => setRuleForm(f => ({ ...f, unit: e.target.value }))} className="input-field text-sm" placeholder="Ex: aulas, atendimentos" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Meta do mes</label>
              <input type="number" min="0" value={ruleForm.target} onChange={e => setRuleForm(f => ({ ...f, target: e.target.value }))} className="input-field text-sm" placeholder="Ex: 10" />
            </div>
          </div>
        )
      ) : editingRule ? (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Atividades e pesos</label>
          <ActivitiesEditor activities={ruleForm.activities} onChange={activities => setRuleForm(f => ({ ...f, activities }))} />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white px-3 py-3 space-y-2">
          <div className="text-xs font-medium text-gray-500">Atividades previstas</div>
          {(criterio.activities || []).length === 0 && <div className="text-sm text-gray-400">Nenhuma atividade cadastrada.</div>}
          {(criterio.activities || []).map((activity, index) => (
            <div key={`${criterio.lancamentoId}-${index}`} className="flex items-center justify-between text-sm text-gray-700">
              <span>{activity.title}</span>
              <span className="font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full text-xs">{activity.weight}%</span>
            </div>
          ))}
        </div>
      )}

      {editingRule && (
        <div className="flex justify-end">
          <button onClick={handleSaveRule} disabled={savingRule} className="btn-primary text-sm py-2 px-3">
            {savingRule ? 'Salvando regra...' : 'Salvar regra'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-4 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Lancamento da frequencia</div>
            <div className="text-xs text-gray-500 mt-1">Marque como feito ou informe a quantidade nesta mesma tela.</div>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-brand-200 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <FileText size={13} />
            {showAdvanced ? 'Ocultar detalhes' : 'Mais opcoes'}
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
            <span>Andamento deste criterio</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white overflow-hidden border border-brand-100">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {criterio.type === 'quantitativo' ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Quantidade realizada</label>
              <input
                type="number"
                min="0"
                value={launchForm.realized}
                onChange={e => setLaunchForm(f => ({ ...f, realized: e.target.value }))}
                className="input-field"
                placeholder="Informe a quantidade do mes"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleSaveQuantity} disabled={savingLaunch} className="btn-primary text-sm">
                <CheckCircle size={14} />
                {savingLaunch ? 'Salvando...' : 'Salvar quantidade'}
              </button>
              <button onClick={handleClearQuantity} disabled={savingLaunch} className="btn-secondary text-sm">
                Limpar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={handleMarkDone} disabled={savingLaunch} className="btn-primary text-sm">
              <CheckCircle size={14} />
              {savingLaunch ? 'Salvando...' : 'Marcar como feito'}
            </button>
            <button onClick={handleResetLaunch} disabled={savingLaunch} className="btn-secondary text-sm">
              Deixar pendente
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-gray-200">Vigencia: {criterio.vigencia}</span>
          {criterio.type === 'quantitativo' && Number(criterio.target) <= 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle size={12} />
              Defina uma meta para calcular a frequencia automaticamente.
            </span>
          )}
        </div>

        {showAdvanced && (
          <div className="border-t border-brand-100 pt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <select
                  value={launchForm.status}
                  onChange={e => setLaunchForm(f => ({ ...f, status: e.target.value }))}
                  className="select-field"
                >
                  {LANCAMENTO_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Data do registro</label>
                <input
                  type="date"
                  value={launchForm.registeredAt}
                  onChange={e => setLaunchForm(f => ({ ...f, registeredAt: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Observacao</label>
                <textarea
                  value={launchForm.notes}
                  onChange={e => setLaunchForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Descreva o que foi entregue ou o que ficou pendente."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Comprovante (opcional)</label>
                <input
                  value={launchForm.attachmentNote}
                  onChange={e => setLaunchForm(f => ({ ...f, attachmentNote: e.target.value }))}
                  className="input-field"
                  placeholder="Link, protocolo ou referencia do comprovante"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleSaveAdvanced} disabled={savingLaunch} className="btn-primary text-sm">
                {savingLaunch ? 'Salvando...' : 'Salvar lancamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CriterioDetailModal({ open, onClose, target, mode, onSaved, showToast }) {
  if (!target) return null
  const summary = getCriteriaCompletion(target.criteria)

  return (
    <Modal open={open} onClose={onClose} title={mode === 'edit' ? 'Criterios e lancamento' : 'Criterios do usuario'} size="xl">
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-brand-50 via-white to-green-50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <BigAvatar name={target.name} avatar={target.avatar} size={60} />
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-lg truncate">{target.name}</div>
                <div className="text-sm text-gray-500 truncate">{target.email}</div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge status={target.role} />
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-brand-100 text-xs font-medium text-brand-700">
                    {summary.total} criterio{summary.total !== 1 ? 's' : ''} no mes
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
              <div className="rounded-xl bg-white/90 border border-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Total</div>
                <div className="text-lg font-bold text-gray-900 mt-1">{summary.total}</div>
              </div>
              <div className="rounded-xl bg-white/90 border border-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Concluidos</div>
                <div className="text-lg font-bold text-green-600 mt-1">{summary.completed}</div>
              </div>
              <div className="rounded-xl bg-white/90 border border-white px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Frequencia</div>
                <div className="text-lg font-bold text-brand-700 mt-1">{target.avgFill}%</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Visualize os criterios, marque o que foi feito e registre a quantidade sem sair desta tela.
          </p>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {target.criteria.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum criterio vinculado neste mes.</div>
          )}
          {target.criteria.map((criterio) => (
            <CriterioEditCard key={criterio.lancamentoId} criterio={criterio} mode={mode} onSaved={onSaved} showToast={showToast} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

/* ─── perfil tile ─── */

function PerfilTile({ icon: Icon, label, userCount, secondaryCount, secondaryLabel, badgeCount, badgeLabel, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 px-4 pt-4 pb-3 rounded-2xl border text-left transition-all ${
        active ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200' : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50'
      }`}
    >
      <span className="absolute -top-2.5 left-3 bg-white border border-brand-200 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
        {badgeCount} {badgeLabel}
      </span>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{label}</div>
        <div className="text-[11px] text-gray-500 whitespace-nowrap">{userCount} usuário{userCount !== 1 ? 's' : ''} · {secondaryCount} {secondaryLabel}</div>
      </div>
      {active && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}

/* ─── slider de lancamento direto na tabela ─── */

// So arrasta um criterio quantitativo por vez -- com mais de um vinculado ao mesmo
// usuario (dado legado de antes da trava de 1 criterio por perfil/mes) ou tipo
// qualitativo (nao da pra "arrastar" um checklist), cai pra barra somente leitura.
function FrequenciaSliderCell({ user, month, onSaved, showToast }) {
  const criterio = user.criteria.length === 1 ? user.criteria[0] : null
  const isQuantitativo = criterio?.type === 'quantitativo'
  const target = Math.max(Number(criterio?.target) || 0, 0)
  const [localValue, setLocalValue] = useState(Number(criterio?.realized) || 0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalValue(Number(criterio?.realized) || 0)
  }, [criterio?.lancamentoId, criterio?.realized])

  if (!criterio || !isQuantitativo) {
    return (
      <div>
        <div className="font-medium text-gray-700">{user.avgFill}%</div>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[160px]">
          <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, user.avgFill)}%` }} />
        </div>
        <div className="text-[11px] text-gray-400 mt-1">Periodo: {monthRangeLabel(month)}</div>
      </div>
    )
  }

  const commit = async (value) => {
    setSaving(true)
    try {
      const status = getQuickQuantitativeStatus(target, value)
      await api.put(`/frequencia/lancamentos/${criterio.lancamentoId}`, {
        target: target || null,
        realized: value,
        status,
        registeredAt: value > 0 ? todayDate() : null,
      })
      onSaved()
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar quantidade.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const pct = target > 0 ? Math.min(100, Math.round((localValue / target) * 100)) : 0

  return (
    <div className="min-w-[150px] max-w-[170px]">
      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span className="font-semibold text-gray-800">{localValue}{target > 0 ? `/${target}` : ''} {criterio.unit || ''}</span>
        <span className="text-gray-400">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(target, localValue, 1)}
        step={1}
        value={localValue}
        disabled={saving}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onMouseUp={(e) => commit(Number(e.target.value))}
        onTouchEnd={(e) => commit(Number(e.target.value))}
        onKeyUp={(e) => commit(Number(e.target.value))}
        className="w-full accent-brand-600 cursor-pointer disabled:opacity-50"
      />
      <div className="text-[11px] text-gray-400 mt-0.5">Arraste para lancar a quantidade</div>
    </div>
  )
}

/* ─── Critérios do mês ─── */

function CriteriosTab({ allowedRoles, reloadToken, showToast }) {
  const [month, setMonth] = useState(currentMonth())
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [detailTarget, setDetailTarget] = useState(null)
  const [detailMode, setDetailMode] = useState('view')
  const [innerReload, setInnerReload] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const perPage = 8

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data: response } = await api.get('/frequencia/overview', { params: { month } })
        if (!active) return
        setData(response)
      } catch (err) {
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar criterios.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, reloadToken, innerReload])

  useEffect(() => { setPage(1) }, [roleFilter, month, search])

  useEffect(() => {
    if (!data) return
    setDetailTarget((prev) => {
      if (!prev) return prev
      const group = data.groups.find((item) => item.role === prev.role)
      const fresh = group?.users.find((user) => user.id === prev.id)
      return fresh ? { ...fresh, role: prev.role, roleLabel: prev.roleLabel } : prev
    })
  }, [data])

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" /></div>
  }
  if (!data) return null

  const allUsers = data.groups.flatMap((group) => group.users.map((user) => ({ ...user, role: group.role, roleLabel: group.label })))
  const totalCriteria = data.groups.reduce((sum, group) => sum + group.criteriaCount, 0)
  const normalizedSearch = search.trim().toLowerCase()
  const visibleUsers = allUsers
    .filter((user) => !roleFilter || user.role === roleFilter)
    .filter((user) => {
      if (!normalizedSearch) return true
      return [user.name, user.email, ...user.criteria.map((criterio) => criterio.title)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  const visibleCriteriaCount = visibleUsers.reduce((sum, user) => sum + user.criteria.length, 0)
  const completedCriteriaCount = visibleUsers.reduce((sum, user) => sum + user.criteria.filter((criterio) => criterio.status === 'concluido').length, 0)
  const openCriteriaCount = Math.max(0, visibleCriteriaCount - completedCriteriaCount)
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / perPage))
  const paged = visibleUsers.slice((page - 1) * perPage, page * perPage)
  const selectedLabel = roleFilter ? FREQUENCIA_ROLE_LABELS[roleFilter] : 'Todos os perfis'

  const openDetail = (user, nextMode) => {
    setDetailTarget(user)
    setDetailMode(nextMode)
  }

  const handleDetailSaved = () => setInnerReload((tick) => tick + 1)

  const handleDeleteCriterio = async () => {
    const criterioId = deleteTarget?.criteria?.[0]?.criterioId
    if (!criterioId) { setDeleteTarget(null); return }
    try {
      await api.delete(`/frequencia/criterios/${criterioId}`)
      showToast('Critério excluído com sucesso!')
      setInnerReload((tick) => tick + 1)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao excluir critério.'), 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Calendar} iconBg="bg-brand-100" iconColor="text-brand-700" value={formatMonthLabel(month)} label="Mes atual" sublabel={`Periodo: ${monthRangeLabel(month)}`} />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600" value={visibleCriteriaCount} label="Criterios visiveis" sublabel="Itens do filtro atual" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" value={openCriteriaCount} label="Em aberto" sublabel="Precisam de marcacao ou quantidade" />
        <StatCard icon={TrendingUp} iconBg="bg-purple-100" iconColor="text-purple-700" value={`${data.stats.frequenciaMedia}%`} label="Frequencia media" sublabel={`${completedCriteriaCount} criterio${completedCriteriaCount !== 1 ? 's' : ''} concluido${completedCriteriaCount !== 1 ? 's' : ''}`} />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mes/Ano</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Perfil avaliado</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select-field">
              <option value="">Todos os perfis</option>
              {allowedRoles.map((role) => <option key={role} value={role}>{FREQUENCIA_ROLE_LABELS[role]}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Buscar usuario ou criterio</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" placeholder="Digite um nome, email ou titulo" />
            </div>
          </div>
          <button
            onClick={() => { setMonth(currentMonth()); setRoleFilter(''); setSearch('') }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <Filter size={14} /> Limpar filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <PerfilTile
            icon={Users}
            label="Todos"
            userCount={allUsers.length}
            secondaryCount={totalCriteria}
            secondaryLabel={`vinculado${totalCriteria !== 1 ? 's' : ''}`}
            badgeCount={data.stats.criteriosAtivos}
            badgeLabel={`criterio${data.stats.criteriosAtivos !== 1 ? 's' : ''} criado${data.stats.criteriosAtivos !== 1 ? 's' : ''}`}
            active={!roleFilter}
            onClick={() => setRoleFilter('')}
          />
          {data.groups.map((group) => (
            <PerfilTile
              key={group.role}
              icon={PERFIL_ICONS[group.role] || Users}
              label={group.label}
              userCount={group.userCount}
              secondaryCount={group.criteriaCount}
              secondaryLabel={`vinculado${group.criteriaCount !== 1 ? 's' : ''}`}
              badgeCount={group.criteriosCriados}
              badgeLabel={`criterio${group.criteriosCriados !== 1 ? 's' : ''} criado${group.criteriosCriados !== 1 ? 's' : ''}`}
              active={roleFilter === group.role}
              onClick={() => setRoleFilter(group.role)}
            />
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Profissionais do perfil selecionado: {selectedLabel}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">{visibleUsers.length} usuario{visibleUsers.length !== 1 ? 's' : ''}</span>
            <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{completedCriteriaCount} concluidos</span>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-3">Usuario</th>
                <th className="table-header px-3 w-44">Criterios do mes</th>
                <th className="table-header px-3 w-36">Andamento</th>
                <th className="table-header px-3 w-44">Frequencia prevista</th>
                <th className="table-header px-3 w-28">Status</th>
                <th className="table-header px-3 w-52">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((user) => {
                const status = fillStatusInfo(user.avgFill)
                const summary = getCriteriaCompletion(user.criteria)
                return (
                  <tr key={`${user.role}-${user.id}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell px-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <BigAvatar name={user.name} avatar={user.avatar} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate max-w-[200px]">{user.name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell px-3">
                      <div className="font-semibold text-gray-800">{user.criteria.length} criterio{user.criteria.length !== 1 ? 's' : ''}</div>
                      <div className="text-xs text-gray-400 mt-1">{getCriteriaTypeSummary(user.criteria)}</div>
                      <div className="text-xs text-gray-400 mt-1">Meta total: {user.metaTotal ? formatAmount(user.metaTotal) : '—'}</div>
                    </td>
                    <td className="table-cell px-3">
                      <div className="font-semibold text-gray-800">{summary.completed}/{summary.total} concluidos</div>
                      <div className="text-xs text-gray-400 mt-1">{summary.open} em aberto neste mes</div>
                    </td>
                    <td className="table-cell px-3">
                      <FrequenciaSliderCell user={user} month={month} onSaved={handleDetailSaved} showToast={showToast} />
                    </td>
                    <td className="table-cell px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="table-cell px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetail(user, 'view')}
                          title="Ver critérios"
                          className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        {allowedRoles.includes(user.role) && (
                          <>
                            <button
                              onClick={() => openDetail(user, 'edit')}
                              title="Editar regras"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(user)}
                              title="Excluir critério"
                              disabled={user.criteria.length !== 1}
                              className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-10 text-gray-400 text-sm">Nenhum usuario encontrado para os filtros selecionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visibleUsers.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Exibindo {Math.min((page - 1) * perPage + 1, visibleUsers.length)} a {Math.min(page * perPage, visibleUsers.length)} de {visibleUsers.length} resultados
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((item) => (
                <button key={item} onClick={() => setPage(item)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === item ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{item}</button>
              ))}
              <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">›</button>
            </div>
          </div>
        )}
      </div>

      <CriterioDetailModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        target={detailTarget}
        mode={detailMode}
        onSaved={handleDetailSaved}
        showToast={showToast}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteCriterio}
        title="Excluir critério"
        message={
          deleteTarget
            ? `Tem certeza que deseja excluir o critério "${deleteTarget.criteria[0]?.title}"? Isso remove o critério e o lançamento de todos os usuários do perfil ${deleteTarget.roleLabel} vinculados a ele (${allUsers.filter((u) => u.criteria.some((c) => c.criterioId === deleteTarget.criteria[0]?.criterioId)).length} no total). Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
      />
    </div>
  )
}

/* lancamentos */

function LancamentoModal({ open, onClose, item, mode, onSave, saving }) {
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (!open || !item) { setForm(null); return }
    setForm({
      target: item.target ?? '',
      realized: item.realized ?? '',
      status: item.status || 'pendente',
      notes: item.notes || '',
      attachmentNote: item.attachmentNote || '',
      registeredAt: item.registeredAt || new Date().toISOString().slice(0, 10),
    })
  }, [open, item])

  if (!item || !form) return null

  const editable = mode === 'edit' && item.canEdit
  const frequenciaCalculada = item.criterioType === 'quantitativo' && Number(form.target) > 0 && form.realized !== ''
    ? Math.round((Number(form.realized) / Number(form.target)) * 10000) / 100
    : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Registrar lançamento' : 'Lançamento'}
      size="md"
      footer={editable ? (
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary" disabled={saving}>
            <CheckCircle size={15} /> {saving ? 'Salvando...' : 'Salvar lançamento'}
          </button>
        </>
      ) : (
        <button onClick={onClose} className="btn-secondary">Fechar</button>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <BigAvatar name={item.userName} avatar={item.userAvatar} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 text-base truncate">{item.userName}</div>
            <div className="text-xs text-gray-400 truncate">{item.criterioTitle}</div>
          </div>
          <Badge status={item.role} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de lançamento</label>
            <div className="input-field bg-gray-50 text-gray-500">{criterioTypeLabel(item.criterioType)}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Unidade</label>
            <div className="input-field bg-gray-50 text-gray-500">{item.criterioUnit || '—'}</div>
          </div>
        </div>

        {item.criterioType === 'quantitativo' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Meta definida</label>
              <input
                type="number" min="0" value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                disabled={!editable}
                className="input-field disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Quantidade realizada</label>
              <input
                type="number" min="0" value={form.realized}
                onChange={e => setForm(f => ({ ...f, realized: e.target.value }))}
                disabled={!editable}
                className="input-field disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        )}

        {frequenciaCalculada !== null && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-medium text-brand-700">Frequência calculada</span>
            <span className="text-lg font-bold text-brand-800">{frequenciaCalculada}%</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            disabled={!editable}
            className="select-field disabled:bg-gray-50 disabled:text-gray-400"
          >
            {LANCAMENTO_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Data do registro</label>
          <input
            type="date" value={form.registeredAt}
            onChange={e => setForm(f => ({ ...f, registeredAt: e.target.value }))}
            disabled={!editable}
            className="input-field disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Observação</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            disabled={!editable}
            rows={2}
            className="input-field resize-none disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="Observações sobre o lançamento..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Anexar comprovante (opcional)</label>
          <input
            value={form.attachmentNote}
            onChange={e => setForm(f => ({ ...f, attachmentNote: e.target.value }))}
            disabled={!editable}
            className="input-field disabled:bg-gray-50 disabled:text-gray-400"
            placeholder="Link ou referência do comprovante"
          />
        </div>

        {mode === 'edit' && !item.canEdit && (
          <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle size={12} /> Você não tem permissão para editar este lançamento.</p>
        )}
      </div>
    </Modal>
  )
}

function LancamentosTab({ allowedRoles, showToast }) {
  const [month, setMonth] = useState(currentMonth())
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [tick, setTick] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [modalItem, setModalItem] = useState(null)
  const [modalMode, setModalMode] = useState('view')
  const [saving, setSaving] = useState(false)
  const perPage = 8

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/frequencia/lancamentos', {
          params: {
            month,
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search ? { search } : {}),
          },
        })
        if (!active) return
        setItems(data)
      } catch (err) {
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar lançamentos.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, statusFilter, search, tick])

  useEffect(() => { setPage(1) }, [roleFilter, month, statusFilter, search])

  // Mantem o popup com dados atualizados apos salvar.
  useEffect(() => {
    setModalItem(prev => {
      if (!prev) return prev
      const fresh = items.find(i => i.id === prev.id)
      return fresh || prev
    })
  }, [items])

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter(i => i.status === 'pendente').length,
    preenchidos: items.filter(i => i.status === 'concluido').length,
    emRevisao: items.filter(i => i.status === 'em_revisao').length,
  }), [items])

  const roleTileStats = useMemo(() => {
    const map = new Map()
    items.forEach(item => {
      if (!map.has(item.role)) map.set(item.role, { users: new Set(), criterios: new Set(), count: 0 })
      const entry = map.get(item.role)
      entry.users.add(item.userId)
      entry.criterios.add(item.criterioId)
      entry.count += 1
    })
    return map
  }, [items])

  const visibleItems = roleFilter ? items.filter(i => i.role === roleFilter) : items
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / perPage))
  const paged = visibleItems.slice((page - 1) * perPage, page * perPage)
  const selectedLabel = roleFilter ? (FREQUENCIA_ROLE_LABELS[roleFilter] || roleFilter) : 'Todos os perfis'

  const openModal = (item, mode) => {
    setModalItem(item)
    setModalMode(mode)
  }

  const handleSaveLancamento = async (form) => {
    setSaving(true)
    try {
      await api.put(`/frequencia/lancamentos/${modalItem.id}`, {
        target: form.target === '' ? null : Number(form.target),
        realized: form.realized === '' ? null : Number(form.realized),
        status: form.status,
        notes: form.notes,
        attachmentNote: form.attachmentNote,
        registeredAt: form.registeredAt || null,
      })
      showToast('Lançamento registrado!')
      setTick(t => t + 1)
      setModalItem(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar lançamento.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && items.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} iconBg="bg-brand-100" iconColor="text-brand-700" value={stats.total} label="Lançamentos do mês" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" value={stats.pendentes} label="Pendentes" />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600" value={stats.preenchidos} label="Preenchidos" />
        <StatCard icon={Eye} iconBg="bg-purple-100" iconColor="text-purple-700" value={stats.emRevisao} label="Em revisão" />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês/ano</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Perfil</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select-field">
              <option value="">Todos os perfis</option>
              {allowedRoles.map(role => <option key={role} value={role}>{FREQUENCIA_ROLE_LABELS[role]}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-field">
              <option value="">Todos os status</option>
              {LANCAMENTO_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setMonth(currentMonth()); setRoleFilter(''); setStatusFilter(''); setSearch('') }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <Filter size={14} /> Limpar filtros
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar responsável ou critério..." className="input-field pl-9" />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <PerfilTile
            icon={Users}
            label="Todos"
            userCount={new Set(items.map(i => i.userId)).size}
            secondaryCount={items.length}
            secondaryLabel={`lançamento${items.length !== 1 ? 's' : ''}`}
            badgeCount={new Set(items.map(i => i.criterioId)).size}
            badgeLabel={`critério${new Set(items.map(i => i.criterioId)).size !== 1 ? 's' : ''}`}
            active={!roleFilter}
            onClick={() => setRoleFilter('')}
          />
          {allowedRoles.map(role => {
            const entry = roleTileStats.get(role) || { users: new Set(), criterios: new Set(), count: 0 }
            return (
              <PerfilTile
                key={role}
                icon={PERFIL_ICONS[role] || Users}
                label={FREQUENCIA_ROLE_LABELS[role]}
                userCount={entry.users.size}
                secondaryCount={entry.count}
                secondaryLabel={`lançamento${entry.count !== 1 ? 's' : ''}`}
                badgeCount={entry.criterios.size}
                badgeLabel={`critério${entry.criterios.size !== 1 ? 's' : ''}`}
                active={roleFilter === role}
                onClick={() => setRoleFilter(role)}
              />
            )
          })}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Lançamentos do perfil selecionado: {selectedLabel}</h3>
          <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">{visibleItems.length} lançamento{visibleItems.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-3">Usuário</th>
                <th className="table-header px-3">Critério</th>
                <th className="table-header px-3 w-24">Meta</th>
                <th className="table-header px-3 w-24">Realizado</th>
                <th className="table-header px-3 w-24">Unidade</th>
                <th className="table-header px-3 w-24">Frequência</th>
                <th className="table-header px-3 w-28">Status</th>
                <th className="table-header px-3 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(item => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="table-cell px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <BigAvatar name={item.userName} avatar={item.userAvatar} />
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-800 truncate max-w-[180px]">{item.userName}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[180px]">{FREQUENCIA_ROLE_LABELS[item.role] || item.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell px-3 truncate max-w-[200px]" title={item.criterioTitle}>{item.criterioTitle}</td>
                  <td className="table-cell px-3">{item.target ?? '—'}</td>
                  <td className="table-cell px-3">{item.realized ?? '—'}</td>
                  <td className="table-cell px-3 text-gray-500">{item.criterioUnit || '—'}</td>
                  <td className="table-cell px-3 font-medium text-gray-700">{item.frequencyPct !== null ? `${Math.round(item.frequencyPct)}%` : '—'}</td>
                  <td className="table-cell px-3"><Badge status={item.status} /></td>
                  <td className="table-cell px-3">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => openModal(item, 'view')} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                        <Eye size={14} />
                      </button>
                      {item.canEdit && (
                        <button onClick={() => openModal(item, 'edit')} title="Registrar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">Nenhum lançamento encontrado para os filtros selecionados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {visibleItems.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Exibindo {Math.min((page - 1) * perPage + 1, visibleItems.length)} a {Math.min(page * perPage, visibleItems.length)} de {visibleItems.length} resultados
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === n ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">›</button>
            </div>
          </div>
        )}
      </div>

      <LancamentoModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        item={modalItem}
        mode={modalMode}
        onSave={handleSaveLancamento}
        saving={saving}
      />
    </div>
  )
}

/* ─── main page ─── */

const TABS = [
  { id: 'criterios', label: 'Criterios e lancamentos', icon: ListChecks },
  { id: 'historico', label: 'Historico', icon: History },
]

export default function Frequencia() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('criterios')
  const [novoCriterioOpen, setNovoCriterioOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [toast, setToast] = useState(null)

  const allowedRoles = useMemo(() => frequenciaRolesForUser(user), [user])
  const canCreateCriterio = allowedRoles.length > 0

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Frequência</h1>
          <p className="page-subtitle">Defina os criterios do mes, abra cada usuario e lance a frequencia sem sair desta tela.</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateCriterio && (
            <button onClick={() => setNovoCriterioOpen(true)} className="btn-primary text-sm">
              <Plus size={14} /> Novo critério mensal
            </button>
          )}
          <button onClick={() => showToast('Fechamento de mês em breve.')} className="btn-secondary text-sm">
            <Lock size={14} /> Fechar mês
          </button>
        </div>
      </div>

      <div className="card p-0">
        <div className="flex items-center border-b border-gray-100 px-2 pt-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                activeTab === tab.id ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'criterios' && (
            <CriteriosTab allowedRoles={allowedRoles} reloadToken={reloadToken} showToast={showToast} />
          )}
          {activeTab === 'historico' && (
            <PlaceholderTab
              icon={History}
              title="Histórico em breve"
              description="O histórico de meses fechados e a evolução da frequência ao longo do tempo vão aparecer aqui em uma próxima etapa."
            />
          )}
        </div>
      </div>

      <NovoCriterioModal
        open={novoCriterioOpen}
        onClose={() => setNovoCriterioOpen(false)}
        onSaved={() => setReloadToken(t => t + 1)}
        showToast={showToast}
        allowedRoles={allowedRoles}
      />

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

