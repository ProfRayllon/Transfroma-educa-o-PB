import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Users, UserCheck, Search, Plus, X, MoreVertical, Edit2, Trash2, Eye } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import api, { getApiErrorMessage } from '../lib/api'

const ROLES = [
  { value: '', label: 'Todos os perfis' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'professor', label: 'Professor/Produtor' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'tecnico', label: 'Tecnico' },
  { value: 'gestao', label: 'Gestao de Pessoas' },
]

const ROLE_LABELS = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  professor: 'Professor/Produtor',
  tutor: 'Tutor',
  tecnico: 'Tecnico',
  gestao: 'Gestao de Pessoas',
}

const PERMISSIONS_MAP = {
  administrador: ['Acessa tudo', 'Cria usuarios', 'Edita permissoes', 'Visualiza todas as telas', 'Edita todos os registros'],
  supervisor: ['Acessa Producao', 'Acessa Gestao de Pessoas', 'Aprova materiais', 'Edita ocorrencias', 'Registra frequencia', 'Visualiza relatorios'],
  professor: ['Acessa Producao', 'Cadastra materiais', 'Edita os proprios materiais', 'Visualiza status da revisao'],
  tutor: ['Acessa Gestao de Pessoas', 'Atualiza atividades', 'Visualiza ocorrencias'],
  tecnico: ['Acessa Gestao de Pessoas', 'Visualiza frequencia/atividades/ocorrencias', 'Atualiza atividades tecnicas'],
  gestao: ['Acessa Gestao de Pessoas', 'Registra frequencia', 'Atualiza informacoes funcionais', 'Visualiza ocorrencias'],
}

function UserFormModal({ user: editUser, open, onClose, onSave, saving }) {
  const isNew = !editUser?.id
  const [form, setForm] = useState(editUser || {
    name: '', email: '', registration: '', role: 'professor', function: 'Professor/Produtor', status: 'ativo', password: '',
  })

  useEffect(() => {
    setForm(editUser || {
      name: '', email: '', registration: '', role: 'professor', function: 'Professor/Produtor', status: 'ativo', password: '',
    })
  }, [editUser, open])

  const handleChange = (e) => setForm((current) => ({ ...current, [e.target.name]: e.target.value }))

  const handleSubmit = async () => {
    await onSave(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Novo usuario' : 'Editar usuario'}
      size="md"
      footer={(
        <>
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
          <input name="name" value={form.name || ''} onChange={handleChange} className="input-field" placeholder="Nome do usuario" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
          <input name="email" value={form.email || ''} onChange={handleChange} type="email" className="input-field" placeholder="email@exemplo.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Matricula</label>
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
            {ROLES.filter((role) => role.value).map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Funcao</label>
          <input name="function" value={form.function || ''} onChange={handleChange} className="input-field" placeholder="Professor/Produtor" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">{isNew ? 'Senha inicial' : 'Nova senha (opcional)'}</label>
          <input name="password" value={form.password || ''} onChange={handleChange} type="password" className="input-field" placeholder="Minimo de 8 caracteres" />
        </div>
      </div>
    </Modal>
  )
}

function PermissionsModal({ role, open, onClose }) {
  const perms = PERMISSIONS_MAP[role] || []
  return (
    <Modal open={open} onClose={onClose} title={`Permissoes - ${ROLE_LABELS[role] || role}`}>
      <ul className="space-y-2">
        {perms.map((permission) => (
          <li key={permission} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">OK</span>
            {permission}
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
            {user.name.split(' ').slice(0, 2).map((name) => name[0]).join('').toUpperCase()}
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
        {user.lastAccess ? new Date(user.lastAccess).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
      </td>
      <td className="table-cell">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewPerms(user.role)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
            title="Ver permissoes"
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
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState(null)
  const [permsRole, setPermsRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'administrador'
  const canViewUsers = ['administrador', 'supervisor'].includes(user?.role)

  useEffect(() => {
    let active = true

    async function loadUsers() {
      if (!canViewUsers) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const { data } = await api.get('/users')
        if (active) setUsers(data)
      } catch (err) {
        if (active) setError(getApiErrorMessage(err, 'Nao foi possivel carregar os usuarios.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadUsers()

    return () => {
      active = false
    }
  }, [canViewUsers])

  const filtered = useMemo(() => {
    return users.filter((listedUser) => {
      if (filterRole && listedUser.role !== filterRole) return false
      if (filterStatus && listedUser.status !== filterStatus) return false
      if (search) {
        const query = search.toLowerCase()
        return listedUser.name.toLowerCase().includes(query)
          || listedUser.email.toLowerCase().includes(query)
          || (listedUser.registration || '').toLowerCase().includes(query)
      }
      return true
    })
  }, [users, filterRole, filterStatus, search])

  const stats = {
    total: users.length,
    admins: users.filter((listedUser) => listedUser.role === 'administrador').length,
    supervisors: users.filter((listedUser) => listedUser.role === 'supervisor').length,
    others: users.filter((listedUser) => ['professor', 'tutor', 'tecnico', 'gestao'].includes(listedUser.role)).length,
    active: users.filter((listedUser) => listedUser.status === 'ativo').length,
  }

  const handleSave = async (form) => {
    try {
      setSaving(true)
      setError('')

      if (form.id) {
        const { data } = await api.put(`/users/${form.id}`, form)
        setUsers((current) => current.map((listedUser) => (listedUser.id === form.id ? data : listedUser)))
        return
      }

      const { data } = await api.post('/users', form)
      setUsers((current) => [...current, data])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel salvar o usuario.'))
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (listedUser) => {
    try {
      setSaving(true)
      setError('')
      await api.delete(`/users/${listedUser.id}`)
      setUsers((current) => current.filter((userItem) => userItem.id !== listedUser.id))
      setDeleteUser(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Nao foi possivel remover o usuario.'))
    } finally {
      setSaving(false)
    }
  }

  if (!canViewUsers) {
    return (
      <div className="card p-8 text-center text-gray-500">
        Voce nao tem permissao para visualizar os acessos do sistema.
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Acessos</h1>
          <p className="page-subtitle">Gerencie usuarios, perfis e permissoes do sistema Transforma.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditUser(null); setEditOpen(true) }} className="btn-primary">
            <Plus size={15} />
            Novo usuario
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard icon={Users} iconBg="bg-brand-100" iconColor="text-brand-700" value={stats.total} label="Total de usuarios" />
        <StatCard icon={ShieldCheck} iconBg="bg-purple-100" iconColor="text-purple-700" value={stats.admins} label="Administradores" />
        <StatCard icon={UserCheck} iconBg="bg-blue-100" iconColor="text-blue-700" value={stats.supervisors} label="Supervisores" />
        <StatCard icon={Users} iconBg="bg-indigo-100" iconColor="text-indigo-700" value={stats.others} label="Prod./Tutores/Tec." />
        <StatCard icon={UserCheck} iconBg="bg-green-100" iconColor="text-green-600" value={stats.active} label="Usuarios ativos" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou matricula..."
              className="input-field pl-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={13} />
              </button>
            )}
          </div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="select-field w-44">
            {ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field w-36">
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

      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Nome</th>
                <th className="table-header hidden lg:table-cell">E-mail</th>
                <th className="table-header hidden md:table-cell w-24">Matricula</th>
                <th className="table-header w-36">Perfil</th>
                <th className="table-header hidden xl:table-cell">Funcao</th>
                <th className="table-header w-20">Status</th>
                <th className="table-header hidden lg:table-cell w-36">Ultimo acesso</th>
                <th className="table-header w-20">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">
                    Carregando usuarios...
                  </td>
                </tr>
              )}
              {!loading && filtered.map((listedUser) => (
                <UserRow
                  key={listedUser.id}
                  user={listedUser}
                  onEdit={(userItem) => { setEditUser(userItem); setEditOpen(true) }}
                  onDelete={(userItem) => setDeleteUser(userItem)}
                  onViewPerms={(role) => setPermsRole(role)}
                  canManage={isAdmin}
                />
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center py-10 text-gray-400 text-sm">
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
          Exibindo {filtered.length} de {users.length} usuarios
        </div>
      </div>

      <UserFormModal
        user={editUser}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
        saving={saving}
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
        title="Remover usuario"
        message={`Tem certeza que deseja remover o usuario "${deleteUser?.name}"? Esta acao nao pode ser desfeita.`}
        confirmLabel={saving ? 'Removendo...' : 'Remover'}
      />
    </div>
  )
}
