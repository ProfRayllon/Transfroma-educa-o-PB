import { Link, NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
  }`

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#ded6ea] bg-white">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-[22px]">
        <Link to="/" className="flex items-center gap-3">
          <div>
            <p className="text-xl font-black leading-tight text-brand-800">Transforma</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#c14aa0]">Educacao PB</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" className={navLinkClass} end>Home</NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>Cursos</NavLink>
          <NavLink to="/login" className={navLinkClass}>Login</NavLink>
        </nav>
      </div>
    </header>
  )
}
