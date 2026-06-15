import { useState, useMemo } from 'react'
import { ShieldCheck, Users, UserCheck, Search, Plus, X, MoreVertical, Edit2, Trash2, Eye } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { mockUsers } from '../data/mockData'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: '', label: 'Todos os perfis' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'professor', label: 'Professor/Produtor' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'gestao', label: 'Gestão de Pessoas' },
]

const ROLE_LABELS = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  professor: 'Professor/Produtor',
  tutor: 'Tutor',
  tecnico: 'Técnico',
  gestao: 'Gestão de Pessoas',
}

const PERMISSIONS_MAP = {
  administrador: ['Acessa tudo', 'Cria usuários', 'Edita permissões', 'Visualiza todas as telas', 'Edita todos os registros'],
  supervisor: ['Acessa Produção', 'Acessa Gestão de Pessoas', 'Aprova materiais', 'Edita ocorrências', 'Registra frequência', 'Visualiza relatórios'],
  professor: ['Acessa Produção', 'Cadastra materiais', 'Edita os próprios materiais', 'Visualiza status da revisão'],
  tutor: ['Acessa Gestão de Pessoas', 'Atualiza atividades', 'Visualiza ocorrências'],
  tecnico: ['Acessa Gestão de Pessoas', 'Visualiza frequência/atividades/ocorrências', 'Atualiza atividades técnicas'],
  gestao: ['Acessa Gestão de Pessoas', 'Registra frequência', 'Atualiza informações funcionais', 'Visualiza ocorrências'],
}

function UserFormModal({ user: editUser, open, onClose, onSave }) {
  const isNew = !editUser?.id
  const [form, setForm] = useState(editUser || {
    name: '', email: '', registration: '', role: 'professor', function: 'Professor/Produtor', status: 'ativo', password: ''
  })

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo usuário' : 'Editar usuário'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={() => { onSave(form); onClose() }} className="btn-primary">
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
          <input name="name" value={form.name || ''} onChange={handleChange} className="input-field" placeholder="Nome do usuário" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
          <input name="email" value={form.email || ''} onChange={handleChange} type="email" className="input-field" placeholder="email@exemplo.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Matrícula</label>
            <input name="registration" value={form.registration || ''} onChange={handleChange} className="input-field" placeholder="ADM-001" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <select name="status" value={form.status || 'ativo'} onChange={handleChange} className="select-field">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil de acesso</label>
          <select name="role" value={form.role || 'professor'} onChange={handleChange} className="select-field">
            {ROLES.filter(r => r.value).map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
          <input name="function" value={form.function || ''} onChange={handleChange} className="input-field" placeholder="Professor/Produtor" />
        </div>
        {isNew && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha inicial</label>
            <input name="password" value={form.password || ''} onChange={handleChange} type="password" className="input-field" placeholder="Senha temporária" />
          </div>
        )}
      </div>
    </Modal>
  )
}

function PermissionsModal({ role, open, onClose }) {
  const perms = PERMISSIONS_MAP[role] || []
  return (
    <Modal open={open} onClose={onClose} title={`Permissões — ${ROLE_LABELS[role] || role}`}>
      <ul className="space-y-2">
        {perms.map(p => (
          <li key={p} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">✓</span>
            {p}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function UserRow({ user, onEdit, onDelete, onViewPerms, canManage }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-700 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
            {user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-800">{user.name}</span>
        </div>
      </td>
      <td className="table-cell text-xs text-gray-600 hidden lg:table-cell">{user.email}</td>
      <td className="table-cell text-xs font-mono text-gray-500 hidden md:table-cell">{user.registration}</td>
      <td className="table-cell"><Badge status={user.role} /></td>
      <td className="table-cell text-xs text-gray-600 hidden xl:table-cell">{user.function}</td>
      <td className="table-cell">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.status === 'ativo' ? 'text-green-700' : 'text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ativo' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
        </span>
      </td>
      <td className="table-cell text-xs text-gray-500 hidden lg:table-cell">
        {user.lastAccess ? new Date(user.lastAccess).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
      </td>
      <td className="table-cell">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewPerms(user.role)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
            title="Ver permissões"
          >
            <Eye size={14} />
          </button>

          {canManage && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                    <button onClick={() => { onEdit(user); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Edit2 size={13} /> Editar
                    </button>
                    <button onClick={() => { onDelete(user); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 size={13} /> Remover
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function Acessos() {
  const { user } = useAuth()
  const [users, setUsers] = useState(mockUsers.map(({ password: _, ...u }) => u))
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState(null)
  const [permsRole, setPermsRole] = useState(null)

  const isAdmin = user?.role === 'administrador'

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterRole && u.role !== filterRole) return false
      if (filterStatus && u.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.registration || '').toLowerCase().includes(q)
      }
      return true
    })
  }, [users, filterRole, filterStatus, search])

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'administrador').length,
    supervisors: users.filter(u => u.role === 'supervisor').length,
    others: users.filter(u => ['professor', 'tutor', 'tecnico', 'gestao'].includes(u.role)).length,
    active: users.filter(u => u.status === 'ativo').length,
  }

  const handleSave = (form) => {
    if (form.id) {
      setUsers(prev => prev.map(u => u.id === form.id ? { ...u, ...form } : u))
    } else {
      setUsers(prev => [...prev, { ...form, id: Date.now(), lastAccess: null, createdAt: new Date().toISOString().split('T')[0] }])
    }
  }

  const handleDelete = (u) => {
    setUsers(prev => prev.filter(x => x.id !== u.id))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Acessos</h1>
          <p className="page-subtitle">Gerencie usuários, perfis e permissões do sistema Transforma.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditUser(null); setEditOpen(true) }} className="btn-primary">
            <Plus size={15} />
            Novo usuário
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} iconBg="bg-brand-100" iconColor="text-brand-700"
          value={stats.total} label="Total de usuários" />
        <StatCard icon={ShieldCheck} iconBg="bg-purple-100" iconColor="text-purple-700"
          value={stats.admins} label="Administradores" />
        <StatCard icon={UserCheck} iconBg="bg-blue-100" iconColor="text-blue-700"
          value={stats.supervisors} label="Supervisores" />
        <StatCard icon={Users} iconBg="bg-indigo-100" iconColor="text-indigo-700"
          value={stats.others} label="Prod./Tutores/Téc." />
        <StatCard icon={UserCheck} iconBg="bg-green-100" iconColor="text-green-600"
          value={stats.active} label="Usuários ativos" />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou matrícula..."
              className="input-field pl-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={13} />
              </button>
            )}
          </div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="select-field w-44">
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-field w-36">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="pendente">Pendente</option>
          </select>
          {(search || filterRole || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('') }} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={13} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Nome</th>
                <th className="table-header hidden lg:table-cell">E-mail</th>
                <th className="table-header hidden md:table-cell w-24">Matrícula</th>
                <th className="table-header w-36">Perfil</th>
                <th className="table-header hidden xl:table-cell">Função</th>
                <th className="table-header w-20">Status</th>
                <th className="table-header hidden lg:table-cell w-36">Último acesso</th>
                <th className="table-header w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  onEdit={u => { setEditUser(u); setEditOpen(true) }}
                  onDelete={u => setDeleteUser(u)}
                  onViewPerms={role => setPermsRole(role)}
                  canManage={isAdmin}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
          Exibindo {filtered.length} de {users.length} usuários
        </div>
      </div>

      <UserFormModal
        user={editUser}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
      <PermissionsModal
        role={permsRole}
        open={!!permsRole}
        onClose={() => setPermsRole(null)}
      />
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => handleDelete(deleteUser)}
        title="Remover usuário"
        message={`Tem certeza que deseja remover o usuário "${deleteUser?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
      />
    </div>
  )
}
