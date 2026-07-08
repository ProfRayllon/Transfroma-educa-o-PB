import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Users, UserCheck, Search, Plus, X, Edit2, Trash2, Eye, EyeOff, Lock } from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import api, { getApiErrorMessage } from '../lib/api'

const MANAGED_ROLES = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'professor', label: 'Professor' },
  { value: 'tecnico', label: 'Apoio tecnico' },
  { value: 'revisor', label: 'Revisor(a)' },
]

const FILTER_ROLES = [
  { value: '', label: 'Todos os perfis' },
  { value: 'administrador', label: 'Administrador' },
  ...MANAGED_ROLES,
]

const ROLE_LABELS = {
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tecnico: 'Apoio tecnico',
  tutor: 'Tutor',
  gestao: 'Gestao de Pessoas',
  revisor: 'Revisor(a)',
}

const ROLE_FUNCTIONS = {
  coordenador: ['Coordenador de area'],
  professor: [
    'Professor produtor de conteudo',
    'Professor Interprete de Libras',
  ],
  supervisor: [
    'Supervisor de producao de conteudo',
    'Supervisor de Revisao Linguistica',
  ],
  tecnico: [
    'Apoio Tecnico de Tutoria',
    'Apoio Tecnico Supervisor de Tutoria',
  ],
  revisor: [
    'Revisor(a) de conteudo',
  ],
}

const COORDINATOR_AREAS = [
  'Educacao Socioemocional',
  'Educacao, Ciencia e Tecnologia',
  'Gestao Pedagogica',
  'Educacao Inclusiva, Equidade e Diversidade',
  'BNCC - Linguagens',
  'BNCC - Ciencias Humanas',
  'BNCC - Matematica',
  'BNCC - Ciencias da Natureza',
  'Interprete de Libras',
]

const PROFESSOR_AREAS = COORDINATOR_AREAS

const SUPERVISOR_AREAS = [
  'Educacao Socioemocional / Educacao Inclusiva, Equidade e Diversidade',
  'Educacao, Ciencia e Tecnologia / Gestao Pedagogica',
  'BNCC - Linguagens',
  'BNCC - Ciencias Humanas',
  'BNCC - Ciencias da Natureza e Matematica',
  'Revisao Linguistica',
  'Tutoria',
]

const TECH_AREAS = [
  'Tutoria',
  'Pedagogia',
  'Tecnologia da Informacao',
  'Analise de Dados',
  'Design Grafico',
]

const PERMISSIONS_MAP = {
  administrador: ['Acessa tudo', 'Cria usuarios', 'Edita permissoes', 'Visualiza todas as telas', 'Edita todos os registros'],
  coordenador: ['Acessa cursos vinculados', 'Cria e edita cursos vinculados', 'Atribui atividades', 'Acompanha producao dos seus cursos'],
  supervisor: ['Acessa Producao', 'Aprova materiais', 'Edita ocorrencias', 'Registra frequencia', 'Visualiza relatorios'],
  professor: ['Acessa Producao', 'Cadastra materiais', 'Edita os proprios materiais', 'Visualiza status da revisao'],
  tecnico: ['Acesso somente leitura aos dados vinculados'],
  revisor: ['Acessa Producao dos cursos vinculados', 'Aprova ou pede ajuste nos conteudos atribuidos', 'Nao pode excluir conteudos ou modulos'],
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function getAreaOptions(role) {
  if (role === 'coordenador') return COORDINATOR_AREAS
  if (role === 'professor') return PROFESSOR_AREAS
  if (role === 'supervisor') return SUPERVISOR_AREAS
  if (role === 'tecnico') return TECH_AREAS
  return []
}

function buildDefaultForm(editUser) {
  if (editUser) {
    const functionOptions = ROLE_FUNCTIONS[editUser.role] || []
    const currentFunction = functionOptions.includes(editUser.function)
      ? editUser.function
      : functionOptions[0] || editUser.function || ''

    return {
      ...editUser,
      password: '',
      function: currentFunction,
      area: editUser.area || '',
    }
  }

  return {
    name: '',
    email: '',
    role: 'professor',
    function: ROLE_FUNCTIONS.professor[0],
    area: '',
    status: 'ativo',
    password: '',
  }
}

function Avatar({ user, size = 'sm' }) {
  const sizeClass = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${sizeClass} rounded-full object-cover border border-white/50 shadow-sm flex-shrink-0`}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full bg-brand-700 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0`}>
      {getInitials(user.name)}
    </div>
  )
}

function UserFormModal({ user: editUser, open, onClose, onSave, saving, error }) {
  const isNew = !editUser?.id
  const [form, setForm] = useState(buildDefaultForm(editUser))
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setForm(buildDefaultForm(editUser))
    setShowPassword(false)
  }, [editUser, open])

  const functionOptions = ROLE_FUNCTIONS[form.role] || []
  const areaOptions = getAreaOptions(form.role)
  const roleOptions = editUser?.role === 'administrador'
    ? [{ value: 'administrador', label: 'Administrador' }, ...MANAGED_ROLES]
    : MANAGED_ROLES

  const handleChange = (e) => {
    const { name, value } = e.target

    setForm((current) => {
      if (name === 'role') {
        return {
          ...current,
          role: value,
          function: ROLE_FUNCTIONS[value]?.[0] || '',
          area: '',
        }
      }

      return { ...current, [name]: value }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const saved = await onSave({
      ...form,
      registration: form.registration || null,
      function: form.function || null,
      area: form.area || null,
    })
    if (saved) onClose()
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
          <button type="submit" form="user-form" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome completo</label>
          <input name="name" value={form.name || ''} onChange={handleChange} className="input-field" placeholder="Nome do usuario" required />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail</label>
          <input name="email" value={form.email || ''} onChange={handleChange} type="email" className="input-field" placeholder="email@exemplo.com" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Perfil</label>
            <select name="role" value={form.role || 'professor'} onChange={handleChange} className="select-field">
              {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
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

        {functionOptions.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Atuacao</label>
            <select name="function" value={form.function || functionOptions[0]} onChange={handleChange} className="select-field">
              {functionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        )}

        {areaOptions.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Area</label>
            <select name="area" value={form.area || ''} onChange={handleChange} className="select-field">
              <option value="">Selecionar area...</option>
              {areaOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">{isNew ? 'Senha inicial' : 'Nova senha (opcional)'}</label>
          <div className="relative">
            <input
              name="password"
              value={form.password || ''}
              onChange={handleChange}
              type={showPassword ? 'text' : 'password'}
              className="input-field pr-10"
              placeholder="Minimo de 8 caracteres"
              minLength={8}
              required={isNew}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-600"
              aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function UserDetailsModal({ user, open, onClose, canResetPassword }) {
  const perms = PERMISSIONS_MAP[user?.role] || ['Permissoes especificas do perfil']

  if (!user) return null

  return (
    <Modal open={open} onClose={onClose} title="Dados do usuario" size="xl">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-5">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
              <p className="text-sm text-gray-500 truncate">{user.email}</p>
              <div className="mt-2">
                <Badge status={user.role} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="text-xs font-medium text-gray-500">Status</div>
              <div className="mt-1 font-semibold text-gray-800">{user.status || '-'}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="text-xs font-medium text-gray-500">Area</div>
              <div className="mt-1 font-semibold text-gray-800">{user.area || '-'}</div>
            </div>
            <div className="rounded-xl bg-gray-50 p-3 sm:col-span-2">
              <div className="text-xs font-medium text-gray-500">Atuacao</div>
              <div className="mt-1 font-semibold text-gray-800">{user.function || '-'}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Permissoes</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {perms.map((permission) => (
                <li key={permission} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">OK</span>
                  {permission}
                </li>
              ))}
            </ul>
          </div>

          {canResetPassword && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Lock size={15} className="text-brand-700" />
                  Senha de acesso
                </h4>
                <p className="mt-1 text-xs text-gray-500">
                  A senha atual nao pode ser visualizada nem copiada porque fica protegida por hash no banco.
                  Para alterar, use o icone de editar e informe uma nova senha.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function UserRow({ user, onEdit, onDelete, onViewUser, canManage }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="table-cell">
        <div className="flex items-center gap-2.5">
          <Avatar user={user} />
          <span className="text-sm font-medium text-gray-800">{user.name}</span>
        </div>
      </td>
      <td className="table-cell text-xs text-gray-600 hidden lg:table-cell">{user.email}</td>
      <td className="table-cell"><Badge status={user.role} /></td>
      <td className="table-cell text-xs text-gray-600 hidden xl:table-cell">{user.area || '-'}</td>
      <td className="table-cell">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.status === 'ativo' ? 'text-green-700' : 'text-gray-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ativo' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
        </span>
      </td>
      <td className="table-cell">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewUser(user)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
            title="Ver usuario"
          >
            <Eye size={15} />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onEdit(user)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                title="Editar usuario"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={() => onDelete(user)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                title="Remover usuario"
              >
                <Trash2 size={15} />
              </button>
            </>
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
  const [detailsUser, setDetailsUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

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
          || (listedUser.area || '').toLowerCase().includes(query)
      }
      return true
    })
  }, [users, filterRole, filterStatus, search])

  const stats = {
    total: users.length,
    admins: users.filter((listedUser) => listedUser.role === 'administrador').length,
    coordinators: users.filter((listedUser) => listedUser.role === 'coordenador').length,
    supervisors: users.filter((listedUser) => listedUser.role === 'supervisor').length,
    professors: users.filter((listedUser) => listedUser.role === 'professor').length,
    technicians: users.filter((listedUser) => listedUser.role === 'tecnico').length,
  }

  const handleSave = async (form) => {
    try {
      setSaving(true)
      setError('')
      setFormError('')

      if (form.id) {
        const { data } = await api.put(`/users/${form.id}`, form)
        setUsers((current) => current.map((listedUser) => (listedUser.id === form.id ? data : listedUser)))
        setDetailsUser((current) => (current?.id === form.id ? data : current))
        setEditUser((current) => (current?.id === form.id ? data : current))
        return true
      }

      const { data } = await api.post('/users', form)
      setUsers((current) => [...current, data])
      return true
    } catch (err) {
      const message = getApiErrorMessage(err, 'Nao foi possivel salvar o usuario.')
      setError(message)
      setFormError(message)
      return false
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
          <button onClick={() => { setEditUser(null); setFormError(''); setEditOpen(true) }} className="btn-primary">
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

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={Users} iconBg="bg-brand-100" iconColor="text-brand-700" value={stats.total} label="Total de usuarios" />
        <StatCard icon={ShieldCheck} iconBg="bg-purple-100" iconColor="text-purple-700" value={stats.admins} label="Administradores" />
        <StatCard icon={UserCheck} iconBg="bg-violet-100" iconColor="text-violet-700" value={stats.coordinators} label="Coordenadores" />
        <StatCard icon={UserCheck} iconBg="bg-blue-100" iconColor="text-blue-700" value={stats.supervisors} label="Supervisores" />
        <StatCard icon={Users} iconBg="bg-indigo-100" iconColor="text-indigo-700" value={stats.professors} label="Professores" />
        <StatCard icon={UserCheck} iconBg="bg-cyan-100" iconColor="text-cyan-700" value={stats.technicians} label="Apoio tecnico" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou area..."
              className="input-field pl-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={13} />
              </button>
            )}
          </div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="select-field w-44">
            {FILTER_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
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
                <th className="table-header w-36">Perfil</th>
                <th className="table-header hidden xl:table-cell">Area</th>
                <th className="table-header w-20">Status</th>
                <th className="table-header w-24">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-10 text-gray-400 text-sm">
                    Carregando usuarios...
                  </td>
                </tr>
              )}
              {!loading && filtered.map((listedUser) => (
                <UserRow
                  key={listedUser.id}
                  user={listedUser}
                  onEdit={(userItem) => { setEditUser(userItem); setFormError(''); setEditOpen(true) }}
                  onDelete={(userItem) => setDeleteUser(userItem)}
                  onViewUser={(userItem) => setDetailsUser(userItem)}
                  canManage={isAdmin}
                />
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-10 text-gray-400 text-sm">
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
        error={formError}
      />
      <UserDetailsModal
        user={detailsUser}
        open={!!detailsUser}
        onClose={() => setDetailsUser(null)}
        canResetPassword={isAdmin}
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
