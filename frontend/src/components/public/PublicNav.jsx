import { Link, NavLink } from 'react-router-dom'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
  }`

const logoFilter =
  'brightness(0) saturate(100%) invert(28%) sepia(88%) saturate(900%) hue-rotate(248deg) brightness(88%)'

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#ded6ea] bg-white">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-[22px]">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Transforma Educação PB" className="h-9 w-auto" style={{ filter: logoFilter }} />
          <div>
            <p className="text-xl font-black leading-tight text-[#7336C0]">Transforma</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#c14aa0]">Educação PB</p>
          </div>
        </Link>

        <nav className="flex items-center gap-0.5">
          <NavLink to="/" className={navLinkClass} end>Home</NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>Cursos</NavLink>
          <NavLink to="/inscricoes" className={navLinkClass}>Inscrições</NavLink>
          <NavLink to="/guia" className={navLinkClass}>Guia</NavLink>
          <NavLink to="/login" className={navLinkClass}>Login</NavLink>
        </nav>
      </div>
    </header>
  )
}
