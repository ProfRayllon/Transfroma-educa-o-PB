import { Link, NavLink } from 'react-router-dom'
import { ArrowRight, BookOpen, LogIn } from 'lucide-react'

const navLinkClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-brand-800 text-white shadow-lg shadow-brand-900/20'
      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
  }`

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-fuchsia-600 text-white shadow-lg shadow-brand-900/25">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-lg font-black leading-tight text-brand-950">Transforma</p>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brand-700">Educacao PB</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>
            Cursos
          </NavLink>
          <NavLink to="/login" className={navLinkClass}>
            Login
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/catalogo-cursos"
            className="hidden items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm font-bold text-brand-800 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg sm:flex"
          >
            Ver cursos
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-brand-800 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-brand-900/20 transition hover:-translate-y-0.5 hover:bg-brand-900"
          >
            <LogIn size={16} />
            Entrar
          </Link>
        </div>
      </div>
    </header>
  )
}
