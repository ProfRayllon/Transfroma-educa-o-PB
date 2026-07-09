import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Lock, Calendar, CheckCircle, TrendingUp, Filter, Search, X,
  ChevronDown, ChevronUp, Eye, Pencil, Users, FileText, Clock,
  AlertTriangle, Info, LayoutGrid, ListChecks, History,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import api, { getApiErrorMessage } from '../lib/api'
import { MiniAvatar } from '../components/producao/shared'

const FREQUENCIA_ROLE_LABELS = {
  supervisor: 'Supervisor',
  revisor: 'Revisor(a)',
  tecnico: 'Apoio tecnico',
  supervisor_tutoria: 'Supervisor de tutoria',
  professor: 'Professor(a)',
}
const FREQUENCIA_ROLES_ORDER = ['supervisor', 'revisor', 'tecnico', 'supervisor_tutoria', 'professor']

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
  if (avgFill >= 100) return { label: 'Concluído', cls: 'bg-green-50 text-green-700 border border-green-200', Icon: CheckCircle }
  if (avgFill >= 70) return { label: 'Alto', cls: 'bg-green-50 text-green-700 border border-green-200', Icon: CheckCircle }
  if (avgFill > 0) return { label: 'Em atenção', cls: 'bg-orange-50 text-orange-700 border border-orange-200', Icon: AlertTriangle }
  return { label: 'Pendente', cls: 'bg-gray-100 text-gray-500 border border-gray-200', Icon: Clock }
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

const EMPTY_CRITERIO_FORM = { role: '', title: '', type: 'quantitativo', unit: '', target: '' }

function NovoCriterioModal({ open, onClose, onSaved, showToast, allowedRoles, month }) {
  const [form, setForm] = useState(EMPTY_CRITERIO_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ ...EMPTY_CRITERIO_FORM, role: allowedRoles[0] || '' })
    setError('')
  }, [open, allowedRoles])

  const handleSubmit = async () => {
    if (!form.role) { setError('Selecione o perfil avaliado.'); return }
    if (!form.title.trim()) { setError('Informe o titulo do criterio.'); return }
    if (form.type === 'quantitativo' && !form.unit.trim()) { setError('Informe a unidade.'); return }
    if (form.type === 'quantitativo' && !(Number(form.target) > 0)) { setError('Informe uma meta valida.'); return }

    setSaving(true)
    try {
      await api.post('/frequencia/criterios', {
        role: form.role,
        title: form.title.trim(),
        type: form.type,
        unit: form.type === 'quantitativo' ? form.unit.trim() : null,
        target: form.type === 'quantitativo' ? Number(form.target) : null,
        referenceMonth: month,
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

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Título do critério <span className="text-red-500">*</span></label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder="Ex: Produzir materiais do mês" />
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

        {form.type === 'quantitativo' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Unidade <span className="text-red-500">*</span></label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-field" placeholder="Ex: produções, visitas" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Meta padrão <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} className="input-field" placeholder="Ex: 10" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Vigência</label>
          <div className="input-field bg-gray-50 text-gray-500">{formatMonthLabel(month)} — {monthRangeLabel(month)}</div>
        </div>
      </div>
    </Modal>
  )
}

/* ─── Critérios do mês ─── */

function CriteriosTab({ allowedRoles, reloadToken, showToast }) {
  const [month, setMonth] = useState(currentMonth())
  const [roleFilter, setRoleFilter] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(() => new Set())
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data: response } = await api.get('/frequencia/overview', {
          params: { month, ...(roleFilter ? { role: roleFilter } : {}) },
        })
        if (!active) return
        setData(response)
        setSelected(null)
        setExpanded(prev => {
          if (prev.size > 0) return prev
          const firstNonEmpty = response.groups.find(g => g.userCount > 0)
          return firstNonEmpty ? new Set([firstNonEmpty.role]) : prev
        })
      } catch (err) {
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar critérios.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, roleFilter, reloadToken])

  const toggleExpanded = (role) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role); else next.add(role)
      return next
    })
  }

  if (loading && !data) {
    return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" /></div>
  }
  if (!data) return null

  const visibleGroups = data.groups.filter(g => g.userCount > 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Calendar} iconBg="bg-brand-100" iconColor="text-brand-700"
          value={formatMonthLabel(month)} label="Mês atual" sublabel={`Período: ${monthRangeLabel(month)}`} />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600"
          value={data.stats.criteriosRealizados} label="Critérios realizados" sublabel="Ativos no mês" />
        <StatCard icon={TrendingUp} iconBg="bg-purple-100" iconColor="text-purple-700"
          value={`${data.stats.frequenciaMedia}%`} label="Frequência média" sublabel="Média geral do mês" />
      </div>

      <div className="card p-4">
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Usuários e critérios por perfil</h3>
          </div>
          {visibleGroups.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">Nenhum usuário encontrado para os filtros selecionados.</div>
          ) : (
            visibleGroups.map(group => {
              const isExpanded = expanded.has(group.role)
              return (
                <div key={group.role} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => toggleExpanded(group.role)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <Users size={15} className="text-brand-600 flex-shrink-0" />
                      <span className="font-semibold text-gray-800">{group.label}</span>
                      <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{group.userCount} usuário{group.userCount !== 1 ? 's' : ''}</span>
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{group.criteriaCount} critérios vinculados</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500 whitespace-nowrap">Média de preenchimento: <strong className="text-gray-700">{group.avgFill}%</strong></span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="table-container">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="table-header px-2">Usuário</th>
                            <th className="table-header px-2 w-32">Critérios vinculados</th>
                            <th className="table-header px-2">Critérios (prévia)</th>
                            <th className="table-header px-2 w-28">Média de preenchimento</th>
                            <th className="table-header px-2 w-28">Status</th>
                            <th className="table-header px-2 w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.users.map(u => {
                            const status = fillStatusInfo(u.avgFill)
                            const isSelected = selected?.id === u.id && selected?.role === group.role
                            return (
                              <tr
                                key={u.id}
                                onClick={() => setSelected({ ...u, role: group.role, roleLabel: group.label })}
                                className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-brand-50/60' : 'hover:bg-gray-50/50'}`}
                              >
                                <td className="table-cell px-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <MiniAvatar name={u.name} roleLabel={group.label} avatar={u.avatar} />
                                    <div className="min-w-0">
                                      <div className="font-medium text-gray-800 truncate max-w-[160px]">{u.name}</div>
                                      <div className="text-[11px] text-gray-400 truncate max-w-[160px]">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="table-cell px-2">{u.criteria.length} critério{u.criteria.length !== 1 ? 's' : ''}</td>
                                <td className="table-cell px-2">
                                  <div className="flex flex-wrap gap-1">
                                    {u.criteria.slice(0, 2).map(c => (
                                      <span key={c.lancamentoId} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full truncate max-w-[140px]">{c.title}</span>
                                    ))}
                                    {u.criteria.length > 2 && <span className="text-[11px] text-gray-400">+{u.criteria.length - 2}</span>}
                                    {u.criteria.length === 0 && <span className="text-gray-300 text-xs">—</span>}
                                  </div>
                                </td>
                                <td className="table-cell px-2 font-medium text-gray-700">{u.avgFill}%</td>
                                <td className="table-cell px-2">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                                    <status.Icon size={11} />
                                    {status.label}
                                  </span>
                                </td>
                                <td className="table-cell px-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelected({ ...u, role: group.role, roleLabel: group.label }) }}
                                    className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                  >
                                    <Eye size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          {selected ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Critérios do usuário selecionado</h3>
                <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={15} /></button>
              </div>
              <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-50">
                <MiniAvatar name={selected.name} roleLabel={selected.roleLabel} avatar={selected.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-800 truncate">{selected.name}</div>
                  <div className="text-xs text-gray-400 truncate">{selected.email}</div>
                </div>
                <Badge status={selected.role} />
              </div>
              <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                {selected.criteria.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">Nenhum critério vinculado neste mês.</div>
                )}
                {selected.criteria.map(c => (
                  <div key={c.lancamentoId} className="px-5 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800 text-sm truncate">{c.title}</span>
                      <Badge status={c.status} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                      <span>Criado por: {c.createdBy}</span>
                      <span>Vigência: {c.vigencia}</span>
                    </div>
                    {c.frequencyPct !== null && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, c.frequencyPct)}%` }} />
                        </div>
                        <span className="text-[11px] font-medium text-gray-600">{Math.round(c.frequencyPct)}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center gap-1.5">
                <Info size={12} /> {selected.criteria.length} critérios vinculados
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-14 gap-2 px-5">
              <Users size={22} className="text-gray-300" />
              <p className="text-sm text-gray-400">Selecione um usuário para ver os critérios vinculados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Lançamentos ─── */

function RegistrarLancamentoPanel({ items, selected, onSelect, onSave, saving }) {
  const [responsavelId, setResponsavelId] = useState('')
  const [criterioId, setCriterioId] = useState('')
  const [form, setForm] = useState(null)

  const responsaveis = useMemo(() => {
    const map = new Map()
    items.forEach(item => {
      if (!map.has(item.userId)) map.set(item.userId, { id: item.userId, name: item.userName, avatar: item.userAvatar, role: item.role })
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  const criteriosDoResponsavel = useMemo(
    () => items.filter(i => i.userId === Number(responsavelId)),
    [items, responsavelId]
  )

  useEffect(() => {
    if (!selected) return
    setResponsavelId(String(selected.userId))
    setCriterioId(String(selected.criterioId))
  }, [selected])

  useEffect(() => {
    const item = items.find(i => i.userId === Number(responsavelId) && i.criterioId === Number(criterioId))
    if (!item) { setForm(null); return }
    setForm({
      id: item.id,
      target: item.target ?? '',
      realized: item.realized ?? '',
      status: item.status || 'pendente',
      notes: item.notes || '',
      attachmentNote: item.attachmentNote || '',
      registeredAt: item.registeredAt || new Date().toISOString().slice(0, 10),
      criterioType: item.criterioType,
      criterioUnit: item.criterioUnit,
      canEdit: item.canEdit,
    })
  }, [responsavelId, criterioId, items])

  const frequenciaCalculada = form && form.criterioType === 'quantitativo' && Number(form.target) > 0 && form.realized !== ''
    ? Math.round((Number(form.realized) / Number(form.target)) * 10000) / 100
    : null

  const handleResponsavelChange = (id) => {
    setResponsavelId(id)
    setCriterioId('')
    setForm(null)
  }

  const handleCancel = () => {
    setResponsavelId('')
    setCriterioId('')
    setForm(null)
    onSelect(null)
  }

  const responsavelAtual = responsaveis.find(r => r.id === Number(responsavelId))

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Registrar lançamento</h3>
        <p className="text-xs text-gray-400 mt-0.5">Selecione o responsável e preencha o resultado do critério do mês.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsável <span className="text-red-500">*</span></label>
        <select value={responsavelId} onChange={e => handleResponsavelChange(e.target.value)} className="select-field">
          <option value="">Selecionar responsável...</option>
          {responsaveis.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {responsavelId && (
        <>
          <div className="flex items-center gap-2 -mt-1">
            <MiniAvatar name={responsavelAtual?.name} avatar={responsavelAtual?.avatar} roleLabel={FREQUENCIA_ROLE_LABELS[responsavelAtual?.role]} />
            <Badge status={responsavelAtual?.role} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Critério mensal <span className="text-red-500">*</span></label>
            <select value={criterioId} onChange={e => setCriterioId(e.target.value)} className="select-field">
              <option value="">Selecionar critério...</option>
              {criteriosDoResponsavel.map(c => <option key={c.criterioId} value={c.criterioId}>{c.criterioTitle}</option>)}
            </select>
          </div>
        </>
      )}

      {form && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de lançamento</label>
              <div className="input-field bg-gray-50 text-gray-500 capitalize">{form.criterioType}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Unidade</label>
              <div className="input-field bg-gray-50 text-gray-500">{form.criterioUnit || '—'}</div>
            </div>
          </div>

          {form.criterioType === 'quantitativo' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Meta definida</label>
                <input
                  type="number" min="0" value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  disabled={!form.canEdit}
                  className="input-field disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Quantidade realizada</label>
                <input
                  type="number" min="0" value={form.realized}
                  onChange={e => setForm(f => ({ ...f, realized: e.target.value }))}
                  disabled={!form.canEdit}
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
              disabled={!form.canEdit}
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
              disabled={!form.canEdit}
              className="input-field disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Observação</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              disabled={!form.canEdit}
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
              disabled={!form.canEdit}
              className="input-field disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="Link ou referência do comprovante"
            />
          </div>

          {!form.canEdit && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertTriangle size={12} /> Você não tem permissão para editar este lançamento.</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={handleCancel} className="btn-secondary text-sm" disabled={saving}>Cancelar</button>
            <button onClick={() => onSave(form)} className="btn-primary text-sm" disabled={saving || !form.canEdit}>
              <CheckCircle size={14} /> {saving ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </>
      )}

      {!responsavelId && (
        <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
          <FileText size={22} className="text-gray-300" />
          <p className="text-sm text-gray-400">Selecione um responsável para começar.</p>
        </div>
      )}
    </div>
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
  const [expanded, setExpanded] = useState(() => new Set())
  const [selectedLancamento, setSelectedLancamento] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/frequencia/lancamentos', {
          params: {
            month,
            ...(roleFilter ? { role: roleFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(search ? { search } : {}),
          },
        })
        if (!active) return
        setItems(data)
        setExpanded(prev => {
          if (prev.size > 0) return prev
          const roles = [...new Set(data.map(i => i.role))]
          return roles.length ? new Set([roles[0]]) : prev
        })
      } catch (err) {
        if (active) showToast(getApiErrorMessage(err, 'Erro ao carregar lançamentos.'), 'error')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [month, roleFilter, statusFilter, search, tick])

  const grouped = useMemo(() => {
    const map = new Map()
    items.forEach(item => {
      if (!map.has(item.role)) map.set(item.role, [])
      map.get(item.role).push(item)
    })
    return [...map.entries()].map(([role, list]) => ({
      role,
      label: FREQUENCIA_ROLE_LABELS[role] || role,
      users: new Set(list.map(i => i.userId)).size,
      list,
    }))
  }, [items])

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter(i => i.status === 'pendente').length,
    preenchidos: items.filter(i => i.status === 'concluido').length,
    emRevisao: items.filter(i => i.status === 'em_revisao').length,
  }), [items])

  const toggleExpanded = (role) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(role)) next.delete(role); else next.add(role)
      return next
    })
  }

  const handleSaveLancamento = async (form) => {
    setSaving(true)
    try {
      await api.put(`/frequencia/lancamentos/${form.id}`, {
        target: form.target === '' ? null : Number(form.target),
        realized: form.realized === '' ? null : Number(form.realized),
        status: form.status,
        notes: form.notes,
        attachmentNote: form.attachmentNote,
        registeredAt: form.registeredAt || null,
      })
      showToast('Lançamento registrado!')
      setTick(t => t + 1)
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar lançamento.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && items.length === 0 && !search && !statusFilter && !roleFilter) {
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

      <div className="card p-4">
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
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar responsável ou critério..." className="input-field pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Lançamentos por perfil</h3>
          </div>
          {grouped.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">Nenhum lançamento encontrado para os filtros selecionados.</div>
          ) : (
            grouped.map(group => {
              const isExpanded = expanded.has(group.role)
              return (
                <div key={group.role} className="border-b border-gray-100 last:border-0">
                  <button
                    onClick={() => toggleExpanded(group.role)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                      <Users size={15} className="text-brand-600 flex-shrink-0" />
                      <span className="font-semibold text-gray-800">{group.label}</span>
                      <span className="text-[11px] font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{group.users} usuário{group.users !== 1 ? 's' : ''}</span>
                      <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{group.list.length} critérios</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </button>
                  {isExpanded && (
                    <div className="table-container">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="table-header px-2">Usuário</th>
                            <th className="table-header px-2">Critério</th>
                            <th className="table-header px-2 w-20">Meta</th>
                            <th className="table-header px-2 w-24">Realizado</th>
                            <th className="table-header px-2 w-24">Unidade</th>
                            <th className="table-header px-2 w-20">Frequência</th>
                            <th className="table-header px-2 w-28">Status</th>
                            <th className="table-header px-2 w-20">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.list.map(item => {
                            const isSelected = selectedLancamento?.id === item.id
                            return (
                              <tr key={item.id} className={`border-b border-gray-50 transition-colors ${isSelected ? 'bg-brand-50/60' : 'hover:bg-gray-50/50'}`}>
                                <td className="table-cell px-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <MiniAvatar name={item.userName} roleLabel={group.label} avatar={item.userAvatar} />
                                    <span className="font-medium text-gray-700 truncate max-w-[130px]">{item.userName}</span>
                                  </div>
                                </td>
                                <td className="table-cell px-2 truncate max-w-[160px]" title={item.criterioTitle}>{item.criterioTitle}</td>
                                <td className="table-cell px-2">{item.target ?? '—'}</td>
                                <td className="table-cell px-2">{item.realized ?? '—'}</td>
                                <td className="table-cell px-2 text-gray-500">{item.criterioUnit || '—'}</td>
                                <td className="table-cell px-2 font-medium text-gray-700">{item.frequencyPct !== null ? `${Math.round(item.frequencyPct)}%` : '—'}</td>
                                <td className="table-cell px-2"><Badge status={item.status} /></td>
                                <td className="table-cell px-2">
                                  <div className="flex items-center gap-0.5">
                                    <button onClick={() => setSelectedLancamento(item)} title="Visualizar" className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                      <Eye size={14} />
                                    </button>
                                    {item.canEdit && (
                                      <button onClick={() => setSelectedLancamento(item)} title="Registrar" className="p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                                        <Pencil size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <RegistrarLancamentoPanel
          items={items}
          selected={selectedLancamento}
          onSelect={setSelectedLancamento}
          onSave={handleSaveLancamento}
          saving={saving}
        />
      </div>
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
          <p className="page-subtitle">Defina critérios mensais por perfil e acompanhe o preenchimento da frequência.</p>
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
        month={currentMonth()}
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
