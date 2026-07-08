import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useAvatar } from '../../context/AvatarContext'
import {
  LayoutDashboard, BookOpen, FileText, Users, ShieldCheck,
  LogOut, ChevronLeft, ChevronRight, Camera, Sun, Moon, Globe,
} from 'lucide-react'

const isCoordinatorRole = (user) => user?.role === 'coordenador' || (user?.function || '').toLowerCase().includes('coordenador')

// Menu reduzido ao que cada perfil realmente usa no dia a dia: professor só
// acompanha os proprios cursos; supervisor/coordenador tambem cuidam da producao;
// Gestao de Pessoas e Acessos ficam restritos a quem administra o sistema
// (admin, e Gestao de Pessoas tambem para o perfil "gestao", dono dessa area).
const navItems = [
  { to: '/painel', icon: LayoutDashboard, label: 'Painel', visible: (user) => user?.role === 'administrador' },
  { to: '/cursos', icon: BookOpen, label: 'Cursos' },
  {
    to: '/producao',
    icon: FileText,
    label: 'Produção',
    visible: (user) => user?.role === 'administrador' || user?.role === 'supervisor' || user?.role === 'revisor' || isCoordinatorRole(user),
  },
  {
    to: '/gestao-pessoas',
    icon: Users,
    label: 'Gestão de Pessoas',
    visible: (user) => user?.role === 'administrador' || user?.role === 'gestao',
  },
  { to: '/acessos', icon: ShieldCheck, label: 'Acessos', visible: (user) => user?.role === 'administrador' },
  { to: '/', icon: Globe, label: 'Site', adminOnly: true },
]

const roleLabels = {
  administrador: 'Administrador',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio tecnico',
  gestao: 'Gestão de Pessoas',
  revisor: 'Revisor(a)',
}

function Tooltip({ label }) {
  return (
    <span className="absolute left-full ml-3 px-2.5 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
      {label}
    </span>
  )
}

export default function Sidebar({ collapsed, onToggle }) {
  const { logout, user } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const { photo } = useAvatar()
  const navigate = useNavigate()

  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'administrador') return false
    if (item.visible && !item.visible(user)) return false
    return true
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name?.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'

  const navClass = (isActive) =>
    `relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 group ${
      collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2.5'
    } ${
      isActive
        ? 'bg-white/20 text-white shadow-lg'
        : 'text-white/70 hover:text-white hover:bg-white/10'
    }`

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-30 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: dark
        ? 'linear-gradient(180deg, #0a0a14 0%, #0f0f1e 40%, #131326 100%)'
        : 'linear-gradient(180deg, #2D1B69 0%, #3B1D7A 40%, #4A2080 100%)'
      }}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center border-b border-white/10 py-4 ${collapsed ? 'justify-center px-2' : 'px-4 justify-between'}`}>
        {!collapsed && (
          <img
            src="/logo.png"
            alt="TransFOrma Educação PB"
            className="h-12 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <button
          onClick={onToggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className={`flex-1 px-2 py-4 space-y-1 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
        {visibleNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => navClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && isActive && <ChevronRight size={14} className="text-white/50" />}
                {collapsed && <Tooltip label={label} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-white/10" />

      {/* Profile + actions */}
      <div className="px-3 py-4">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            {/* Avatar */}
            <div className="relative group cursor-pointer" onClick={() => navigate('/perfil')}>
              {photo ? (
                <img src={photo} alt={user?.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </div>
              <Tooltip label="Meu Perfil" />
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="relative group w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
              <Tooltip label={dark ? 'Modo claro' : 'Modo escuro'} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="relative group w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={15} />
              <Tooltip label="Sair" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Avatar + name row */}
            <div className="flex items-center gap-3">
              <div
                className="relative group cursor-pointer flex-shrink-0"
                onClick={() => navigate('/perfil')}
                title="Ir para o perfil"
              >
                {photo ? (
                  <img src={photo} alt={user?.name} className="w-11 h-11 rounded-full object-cover ring-2 ring-white/20" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20">
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={13} className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm leading-tight truncate">{user?.name}</div>
                <div className="text-white/50 text-xs mt-0.5">{roleLabels[user?.role] || user?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/10 transition-all flex-shrink-0"
              >
                <LogOut size={15} />
              </button>
            </div>

            {/* Dark mode toggle row */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
            >
              {dark ? <Sun size={15} className="flex-shrink-0" /> : <Moon size={15} className="flex-shrink-0" />}
              <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>
            </button>
          </div>
        )}

      </div>

      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="text-white/20 text-[10px] text-center">© 2026 Transforma Educação PB</div>
        </div>
      )}
    </aside>
  )
}
