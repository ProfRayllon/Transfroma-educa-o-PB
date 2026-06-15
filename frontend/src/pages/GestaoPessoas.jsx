import { useState, useMemo } from 'react'
import { Users, Clock, CheckCircle, AlertCircle, Info, Filter, Calendar, MoreVertical, Plus, X } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import { mockPeople, mockOccurrences } from '../data/mockData'
import { useAuth } from '../context/AuthContext'

const ATTENDANCE_STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'registrada', label: 'Registrada' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'justificada', label: 'Justificada' },
]

function ProgressBar({ value }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8">{value}%</span>
    </div>
  )
}

function AttendanceBadge({ status, time }) {
  const icon = status === 'registrada' ? '✓' : status === 'pendente' ? '⏱' : status === 'ausente' ? '✗' : 'ℹ'
  const cls = {
    registrada: 'text-green-700',
    pendente: 'text-amber-600',
    ausente: 'text-red-600',
    justificada: 'text-blue-600',
  }[status] || 'text-gray-500'

  return (
    <div className="flex items-center gap-1">
      <span className={`text-sm ${cls}`}>{icon}</span>
      <div>
        <div className={`text-xs font-medium capitalize ${cls}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
        {time && <div className="text-[10px] text-gray-400">Hoje, {time}</div>}
        {!time && status === 'pendente' && <div className="text-[10px] text-gray-400">—</div>}
      </div>
    </div>
  )
}

function AvatarCircle({ name, size = 'md' }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} rounded-full bg-brand-700 text-white font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

function FunctionBadge({ fn }) {
  const cls = {
    'Professor/Produtor': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    'Tutor': 'bg-pink-50 text-pink-700 border border-pink-200',
    'Técnico': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    'Supervisor': 'bg-blue-50 text-blue-700 border border-blue-200',
    'Gestão de Pessoas': 'bg-teal-50 text-teal-800 border border-teal-200',
    'Administrador': 'bg-purple-50 text-purple-700 border border-purple-200',
  }[fn] || 'bg-gray-100 text-gray-700 border border-gray-200'

  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{fn}</span>
}

function RegisterAttendanceModal({ person, open, onClose, onSave }) {
  const [status, setStatus] = useState('registrada')
  const [notes, setNotes] = useState('')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Registrar frequência — ${person?.name}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { onSave(person?.id, status, notes); onClose() }} className="btn-primary">
            <CheckCircle size={14} />
            Registrar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Status da frequência</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="select-field">
            <option value="registrada">Registrada</option>
            <option value="ausente">Ausente</option>
            <option value="justificada">Justificada</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field resize-none" rows={3} placeholder="Observação sobre a frequência..." />
        </div>
      </div>
    </Modal>
  )
}

function OccurrenceModal({ person, open, onClose, onSave }) {
  const [form, setForm] = useState({ type: '', description: '', severity: 'baixa' })
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Nova ocorrência — ${person?.name || ''}`}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { onSave(form); onClose() }} className="btn-primary">
            <Plus size={14} />
            Registrar ocorrência
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de ocorrência</label>
          <input name="type" value={form.type} onChange={handleChange} className="input-field" placeholder="Ex: Falta injustificada, Atraso recorrente..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Descrição</label>
          <textarea name="description" value={form.description} onChange={handleChange} className="input-field resize-none" rows={3} placeholder="Descreva a ocorrência..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Severidade</label>
          <select name="severity" value={form.severity} onChange={handleChange} className="select-field">
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </div>
      </div>
    </Modal>
  )
}

// Frequência tab
function FrequenciaTab({ people, canRegister, onRegister }) {
  const [filter, setFilter] = useState('')

  const filtered = filter ? people.filter(p => p.attendanceStatus === filter) : people

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Acompanhe e registre a frequência da equipe. Você pode registrar a frequência em lote ou individualmente.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="select-field w-40 text-xs"
          >
            {ATTENDANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {canRegister && (
            <button className="btn-primary text-xs">
              <Calendar size={13} />
              Registrar frequência
            </button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-header">Nome</th>
              <th className="table-header w-36">Função</th>
              <th className="table-header">Supervisor</th>
              <th className="table-header w-32">Frequência hoje</th>
              <th className="table-header w-44">Ativ. concluídas (mês)</th>
              <th className="table-header w-20 text-center">Ocorrências</th>
              <th className="table-header w-20">Status</th>
              <th className="table-header w-20">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <AvatarCircle name={p.name} />
                    <span className="text-sm font-medium text-gray-800">{p.name}</span>
                  </div>
                </td>
                <td className="table-cell"><FunctionBadge fn={p.function} /></td>
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    {p.supervisorId ? (
                      <>
                        <AvatarCircle name={p.supervisorName} size="sm" />
                        <span className="text-xs text-gray-600">{p.supervisorName}</span>
                      </>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </div>
                </td>
                <td className="table-cell">
                  <AttendanceBadge status={p.attendanceStatus} time={p.attendanceTime} />
                </td>
                <td className="table-cell">
                  <ProgressBar value={p.completedActivities} />
                </td>
                <td className="table-cell text-center">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${p.openOccurrences > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                    {p.openOccurrences}
                  </span>
                </td>
                <td className="table-cell">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Ativo
                  </span>
                </td>
                <td className="table-cell">
                  {canRegister && (
                    <button
                      onClick={() => onRegister(p)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-700 transition-colors"
                    >
                      <MoreVertical size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
          Exibindo 1 a {filtered.length} de {people.length} profissionais
        </div>
      </div>
    </div>
  )
}

// Atividades tab
function AtividadesTab({ people }) {
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="table-header">Nome</th>
            <th className="table-header w-36">Função</th>
            <th className="table-header w-52">Progresso no mês</th>
            <th className="table-header w-28 text-center">Percentual</th>
            <th className="table-header w-24">Status</th>
          </tr>
        </thead>
        <tbody>
          {people.map(p => (
            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="table-cell">
                <div className="flex items-center gap-2.5">
                  <AvatarCircle name={p.name} />
                  <span className="text-sm font-medium text-gray-800">{p.name}</span>
                </div>
              </td>
              <td className="table-cell"><FunctionBadge fn={p.function} /></td>
              <td className="table-cell">
                <ProgressBar value={p.completedActivities} />
              </td>
              <td className="table-cell text-center">
                <span className={`text-sm font-bold ${
                  p.completedActivities >= 80 ? 'text-green-600' :
                  p.completedActivities >= 50 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {p.completedActivities}%
                </span>
              </td>
              <td className="table-cell">
                {p.completedActivities === 100 ? (
                  <Badge status="concluido" />
                ) : p.completedActivities >= 50 ? (
                  <Badge status="em_producao" />
                ) : (
                  <Badge status="pendente" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Ocorrências tab
function OcorrenciasTab({ occurrences, canEdit, onNew }) {
  const severityColors = {
    baixa: 'bg-yellow-50 text-yellow-700',
    media: 'bg-orange-50 text-orange-700',
    alta: 'bg-red-50 text-red-700',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
          <Info size={14} />
          Somente o supervisor pode editar ocorrências.
        </div>
        {canEdit && (
          <button onClick={onNew} className="btn-primary">
            <Plus size={14} />
            Nova ocorrência
          </button>
        )}
      </div>

      <div className="space-y-3">
        {occurrences.map(occ => (
          <div key={occ.id} className="card border border-gray-100">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={16} className="text-red-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-800 text-sm">{occ.type}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {occ.userName} · Registrado por {occ.createdBy} · {new Date(occ.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{occ.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${severityColors[occ.severity] || ''}`}>
                  {occ.severity}
                </span>
                <Badge status={occ.status} />
              </div>
            </div>
          </div>
        ))}
        {occurrences.length === 0 && (
          <div className="card text-center py-10 text-gray-400 text-sm">
            Nenhuma ocorrência registrada.
          </div>
        )}
      </div>
    </div>
  )
}

const TABS = [
  { id: 'frequencia', label: 'Frequência', icon: Calendar },
  { id: 'atividades', label: 'Atividades concluídas', icon: CheckCircle },
  { id: 'ocorrencias', label: 'Ocorrências', icon: AlertCircle },
]

export default function GestaoPessoas() {
  const { user, can } = useAuth()
  const [activeTab, setActiveTab] = useState('frequencia')
  const [people, setPeople] = useState(mockPeople)
  const [occurrences, setOccurrences] = useState(mockOccurrences)
  const [attendanceModal, setAttendanceModal] = useState(null)
  const [occurrenceModal, setOccurrenceModal] = useState(false)

  const canEdit = user?.role === 'administrador' || user?.role === 'supervisor'
  const canRegister = canEdit || user?.role === 'gestao'

  const stats = {
    total: people.length,
    pendingAttendance: people.filter(p => p.attendanceStatus === 'pendente').length,
    avgActivities: Math.round(people.reduce((s, p) => s + p.completedActivities, 0) / people.length),
    openOccurrences: occurrences.filter(o => ['aberta', 'em_analise'].includes(o.status)).length,
  }

  const handleRegisterAttendance = (personId, status, notes) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setPeople(prev => prev.map(p =>
      p.id === personId ? { ...p, attendanceStatus: status, attendanceTime: status === 'registrada' ? time : null } : p
    ))
  }

  const handleNewOccurrence = (form) => {
    setOccurrences(prev => [
      ...prev,
      {
        id: Date.now(),
        userId: 0,
        userName: 'Geral',
        ...form,
        status: 'aberta',
        createdBy: user?.name || 'Sistema',
        resolvedBy: null,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ])
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Gestão de Pessoas</h1>
        <p className="page-subtitle">Acompanhe a frequência, atividades e ocorrências da equipe do programa.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} iconBg="bg-brand-100" iconColor="text-brand-700"
          value={stats.total} label="Total de profissionais" sublabel="Ativos no programa" />
        <StatCard icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600"
          value={stats.pendingAttendance} label="Frequência pendente" sublabel="Registros pendentes" />
        <StatCard icon={CheckCircle} iconBg="bg-green-100" iconColor="text-green-600"
          value={`${stats.avgActivities}%`} label="Atividades concluídas" sublabel="Média da equipe" />
        <StatCard icon={AlertCircle} iconBg="bg-red-100" iconColor="text-red-600"
          value={stats.openOccurrences} label="Ocorrências abertas" sublabel="Abertas no período" />
      </div>

      {/* Tabs */}
      <div className="card p-0">
        <div className="flex items-center border-b border-gray-100 px-2 pt-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-brand-700 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
          {!canEdit && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs text-amber-700 bg-amber-50 rounded-lg mr-2 mb-2">
              <Info size={12} />
              Somente o supervisor pode editar ocorrências.
            </div>
          )}
        </div>

        <div className="p-5">
          {activeTab === 'frequencia' && (
            <FrequenciaTab
              people={people}
              canRegister={canRegister}
              onRegister={p => setAttendanceModal(p)}
            />
          )}
          {activeTab === 'atividades' && <AtividadesTab people={people} />}
          {activeTab === 'ocorrencias' && (
            <OcorrenciasTab
              occurrences={occurrences}
              canEdit={canEdit}
              onNew={() => setOccurrenceModal(true)}
            />
          )}
        </div>
      </div>

      <RegisterAttendanceModal
        person={attendanceModal}
        open={!!attendanceModal}
        onClose={() => setAttendanceModal(null)}
        onSave={handleRegisterAttendance}
      />
      <OccurrenceModal
        open={occurrenceModal}
        onClose={() => setOccurrenceModal(false)}
        onSave={handleNewOccurrence}
      />
    </div>
  )
}
