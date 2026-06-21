import { Link, NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-white/20 text-white'
      : 'text-white/75 hover:bg-white/15 hover:text-white'
  }`

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-40 bg-[#3b1d7a] shadow-[0_2px_16px_rgba(30,10,60,.35)]">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-[22px]">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <span className="text-base font-black text-white leading-none">T</span>
          </div>
          <div>
            <p className="text-[17px] font-black leading-tight text-white tracking-tight">Transforma</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-300 leading-none">Educacao PB</p>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" className={navLinkClass} end>Home</NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>Cursos</NavLink>
          <NavLink to="/login" className="ml-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-[#3b1d7a] transition hover:bg-purple-100">
            Login
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
