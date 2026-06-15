import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, LogOut, User, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const roleLabels = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  professor: 'Professor/Produtor',
  tutor: 'Tutor',
  tecnico: 'Técnico',
  gestao: 'Gestão de Pessoas',
}

function Avatar({ name, size = 'md' }) {
  const initials = name
    ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'U'
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div
      className={`${sizeClass} rounded-full bg-brand-700 text-white font-semibold flex items-center justify-center flex-shrink-0`}
    >
      {initials}
    </div>
  )
}

export { Avatar }

export default function Header({ searchPlaceholder = 'Buscar no sistema...', collapsed = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className={`fixed top-0 ${collapsed ? 'left-16' : 'left-60'} right-0 h-16 bg-white border-b border-gray-100 z-20 flex items-center justify-between px-6 transition-all duration-300`}>
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications bell */}
        <button
          onClick={() => navigate('/notificacoes')}
          className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Avatar name={user?.name} />
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</div>
              <div className="text-xs text-gray-500">{roleLabels[user?.role] || user?.role}</div>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800">{user?.name}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => { setDropdownOpen(false); navigate('/perfil') }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} />
                Meu Perfil
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
      )}
    </header>
  )
}
