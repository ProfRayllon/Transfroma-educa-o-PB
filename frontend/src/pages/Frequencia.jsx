import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Lock, Calendar, CheckCircle, TrendingUp, Filter, Search, X,
  Eye, Pencil, Users, UserCheck, Headphones, UserCog, GraduationCap, BookOpen,
  FileText, Clock, AlertTriangle, LayoutGrid, ListChecks, History, Check,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
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

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_CRITERIO_FORM, role: allowedRoles[0] || '', referenceMonth: currentMonth(), activities: [{ title: '', weight: '' }, { title: '', weight: '' }] })
    setError('')
  }, [open, allowedRoles])

  useEffect(() => {
    if (!open || !form.role) { setPreviewUsers([]); return }
    let active = true
    setLoadingPreview(true)
    api.get('/frequencia/usuarios', { params: { role: form.role } })
      .then(({ data }) => { if (active) setPreviewUsers(data) })
      .catch(() => { if (active) setPreviewUsers([]) })
      .finally(() => { if (active) setLoadingPreview(false) })
    return () => { active = false }
  }, [open, form.role])

  const handleSubmit = async () => {
    if (!form.role) { setError('Selecione o perfil avaliado.'); return }
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
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
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
          {allowedRoles.length === 0 && <p className="text-xs text-amber-600 mt-1">Você não tem permissão para criar critérios.</p>}
        </div>

        {form.role && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="text-[11px] font-medium text-gray-500 mb-1.5">
              {loadingPreview
                ? 'Carregando usuários...'
                : `Vai valer para ${previewUsers.length} usuário${previewUsers.length !== 1 ? 's' : ''} do perfil ${FREQUENCIA_ROLE_LABELS[form.role]}:`}
            </div>
            {!loadingPreview && (
              <div className="flex flex-wrap gap-1.5">
                {previewUsers.slice(0, 8).map(u => (
                  <span key={u.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-1 pr-2.5 py-0.5">
                    <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center overflow-hidden flex-shrink-0">
                      {u.avatar ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" /> : getInitials(u.name)}
                    </span>
                    <span className="text-[11px] text-gray-700">{u.name}</span>
                  </span>
                ))}
                {previewUsers.length > 8 && <span className="text-[11px] text-gray-400 self-center">+{previewUsers.length - 8}</span>}
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

function CriterioEditCard({ criterio, mode, onSaved, showToast }) {
  const [form, setForm] = useState(() => ({
    title: criterio.title || '',
    details: criterio.details || '',
    unit: criterio.unit || '',
    target: criterio.target ?? '',
    activities: criterio.activities?.length ? criterio.activities : [{ title: '', weight: '' }],
  }))
  const [saving, setSaving] = useState(false)
  const editable = mode === 'edit'

  const handleSave = async () => {
    if (criterio.type === 'qualitativo') {
      const activities = form.activities.filter(a => a.title.trim())
      const total = activities.reduce((sum, a) => sum + (Number(a.weight) || 0), 0)
      if (activities.length === 0) { showToast('Adicione ao menos uma atividade.', 'error'); return }
      if (Math.abs(total - 100) > 0.5) { showToast(`A soma dos pesos deve ser 100% (atual: ${total}%).`, 'error'); return }
    }

    setSaving(true)
    try {
      await api.put(`/frequencia/criterios/${criterio.criterioId}`, {
        title: form.title.trim(),
        details: form.details.trim() || null,
        ...(criterio.type === 'quantitativo'
          ? { unit: form.unit.trim() || null, target: Number(form.target) || null }
          : { activities: form.activities.filter(a => a.title.trim()) }),
      })
      showToast('Critério atualizado!')
      onSaved()
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar critério.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field text-sm font-medium flex-1" />
        ) : (
          <span className="font-medium text-gray-800 text-sm">{criterio.title}</span>
        )}
        <Badge status={criterio.status} />
      </div>

      {editable ? (
        <textarea
          value={form.details}
          onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
          rows={2}
          className="input-field resize-none text-xs"
          placeholder="Detalhes do critério (opcional)"
        />
      ) : criterio.details ? (
        <p className="text-xs text-gray-500">{criterio.details}</p>
      ) : null}

      {criterio.type === 'quantitativo' ? (
        editable ? (
          <div className="grid grid-cols-2 gap-2">
            <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-field text-xs" placeholder="Unidade" />
            <input type="number" min="0" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="input-field text-xs" placeholder="Meta do mês" />
          </div>
        ) : (
          <div className="text-xs text-gray-500">Meta: <strong className="text-gray-700">{criterio.target ?? '—'} {criterio.unit || ''}</strong></div>
        )
      ) : editable ? (
        <ActivitiesEditor activities={form.activities} onChange={activities => setForm(f => ({ ...f, activities }))} />
      ) : (
        <div className="space-y-1">
          {(criterio.activities || []).map((a, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-500">
              <span>{a.title}</span>
              <span className="font-medium text-gray-600">{a.weight}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50">
        <span>Criado por: {criterio.createdBy}</span>
        <span>Vigência: {criterio.vigencia}</span>
      </div>

      {criterio.frequencyPct !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, criterio.frequencyPct)}%` }} />
          </div>
          <span className="text-[11px] font-medium text-gray-600">{Math.round(criterio.frequencyPct)}%</span>
        </div>
      )}

      {editable && (
        <div className="flex justify-end pt-1">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      )}
    </div>
  )
}

function CriterioDetailModal({ open, onClose, target, mode, onSaved, showToast }) {
  if (!target) return null
  return (
    <Modal open={open} onClose={onClose} title={mode === 'edit' ? 'Editar critérios do usuário' : 'Critérios do usuário'} size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <BigAvatar name={target.name} avatar={target.avatar} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-gray-900 text-base truncate">{target.name}</div>
            <div className="text-xs text-gray-400 truncate">{target.email}</div>
          </div>
          <Badge status={target.role} />
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
          {target.criteria.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhum critério vinculado neste mês.</div>
          )}
          {target.criteria.map(c => (
            <CriterioEditCard key={c.lancamentoId} criterio={c} mode={mode} onSaved={onSaved} showToast={showToast} />
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

/* ─── Critérios do mês ─── */

function CriteriosTab({ allowedRoles, reloadToken, showToast }) {
  const [month, setMonth] = useState(currentMonth())
  const [roleFilter, setRoleFilter] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [detailTarget, setDetailTarget] = useState(null)
  const [detailMode, setDetailMode] = useState('view')
  const [innerReload, setInnerReload] = useState(0)
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
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar critérios.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, reloadToken, innerReload])

  useEffect(() => { setPage(1) }, [roleFilter, month])

  // Mantem o popup aberto com dados atualizados apos salvar um criterio dentro dele.
  useEffect(() => {
    if (!data) return
    setDetailTarget(prev => {
      if (!prev) return prev
      const group = data.groups.find(g => g.role === prev.role)
      const fresh = group?.users.find(u => u.id === prev.id)
      return fresh ? { ...fresh, role: prev.role, roleLabel: prev.roleLabel } : prev
    })
  }, [data])

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" /></div>
  }
  if (!data) return null

  const allUsers = data.groups.flatMap(g => g.users.map(u => ({ ...u, role: g.role, roleLabel: g.label })))
  const totalCriteria = data.groups.reduce((sum, g) => sum + g.criteriaCount, 0)
  const visibleUsers = roleFilter ? allUsers.filter(u => u.role === roleFilter) : allUsers
  const visibleCriteriaCount = visibleUsers.reduce((sum, u) => sum + u.criteria.length, 0)
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / perPage))
  const paged = visibleUsers.slice((page - 1) * perPage, page * perPage)
  const selectedLabel = roleFilter ? FREQUENCIA_ROLE_LABELS[roleFilter] : 'Todos os perfis'

  const openDetail = (user, mode) => {
    setDetailTarget(user)
    setDetailMode(mode)
  }

  const handleDetailSaved = () => setInnerReload(t => t + 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Calendar} iconBg="bg-brand-100" iconColor="text-brand-700"
          value={formatMonthLabel(month)} label="Mês atual" sublabel={`Período: ${monthRangeLabel(month)}`} />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600"
          value={data.stats.criteriosAtivos} label="Critérios ativos" sublabel="Vinculados no mês" />
        <StatCard icon={TrendingUp} iconBg="bg-purple-100" iconColor="text-purple-700"
          value={`${data.stats.frequenciaMedia}%`} label="Frequência média" sublabel="Média geral do mês" />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês/Ano</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Perfil avaliado</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="select-field">
              <option value="">Todos os perfis</option>
              {allowedRoles.map(role => <option key={role} value={role}>{FREQUENCIA_ROLE_LABELS[role]}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setMonth(currentMonth()); setRoleFilter('') }}
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
            badgeLabel={`critério${data.stats.criteriosAtivos !== 1 ? 's' : ''} criado${data.stats.criteriosAtivos !== 1 ? 's' : ''}`}
            active={!roleFilter}
            onClick={() => setRoleFilter('')}
          />
          {data.groups.map(g => (
            <PerfilTile
              key={g.role}
              icon={PERFIL_ICONS[g.role] || Users}
              label={g.label}
              userCount={g.userCount}
              secondaryCount={g.criteriaCount}
              secondaryLabel={`vinculado${g.criteriaCount !== 1 ? 's' : ''}`}
              badgeCount={g.criteriosCriados}
              badgeLabel={`critério${g.criteriosCriados !== 1 ? 's' : ''} criado${g.criteriosCriados !== 1 ? 's' : ''}`}
              active={roleFilter === g.role}
              onClick={() => setRoleFilter(g.role)}
            />
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Profissionais do perfil selecionado: {selectedLabel}</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">{visibleUsers.length} usuário{visibleUsers.length !== 1 ? 's' : ''}</span>
            <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">{visibleCriteriaCount} critérios vinculados</span>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-3">Usuário</th>
                <th className="table-header px-3 w-36">Critérios vinculados</th>
                <th className="table-header px-3 w-24">Meta total</th>
                <th className="table-header px-3 w-36">Tipo de lançamento</th>
                <th className="table-header px-3 w-40">Frequência prevista</th>
                <th className="table-header px-3 w-28">Status</th>
                <th className="table-header px-3 w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(u => {
                const status = fillStatusInfo(u.avgFill)
                const firstType = u.criteria[0]?.type
                return (
                  <tr key={`${u.role}-${u.id}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell px-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <BigAvatar name={u.name} avatar={u.avatar} />
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate max-w-[200px]">{u.name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell px-3">{u.criteria.length}</td>
                    <td className="table-cell px-3">{u.metaTotal || '—'}</td>
                    <td className="table-cell px-3 text-gray-500">{firstType ? criterioTypeLabel(firstType) : '—'}</td>
                    <td className="table-cell px-3">
                      <div className="font-medium text-gray-700">{u.avgFill}%</div>
                      <div className="text-[11px] text-gray-400">({monthRangeLabel(month)})</div>
                    </td>
                    <td className="table-cell px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="table-cell px-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openDetail(u, 'edit')} title="Editar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => openDetail(u, 'view')} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-10 text-gray-400 text-sm">Nenhum usuário encontrado para os filtros selecionados.</td>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === n ? 'bg-brand-800 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500">›</button>
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
    </div>
  )
}

/* ─── Lançamentos ─── */

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
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutGrid },
  { id: 'criterios', label: 'Critérios do mês', icon: ListChecks },
  { id: 'lancamentos', label: 'Lançamentos', icon: FileText },
  { id: 'historico', label: 'Histórico', icon: History },
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
          <p className="page-subtitle">Defina critérios mensais por perfil, vincule usuários e acompanhe a geração da frequência.</p>
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
          {activeTab === 'visao-geral' && (
            <PlaceholderTab
              icon={LayoutGrid}
              title="Visão geral em breve"
              description="Um resumo consolidado de todos os perfis e meses vai aparecer aqui em uma próxima etapa."
            />
          )}
          {activeTab === 'criterios' && (
            <CriteriosTab allowedRoles={allowedRoles} reloadToken={reloadToken} showToast={showToast} />
          )}
          {activeTab === 'lancamentos' && (
            <LancamentosTab allowedRoles={allowedRoles} showToast={showToast} />
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
