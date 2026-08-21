import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LogIn } from 'lucide-react'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
  }`

const navBtnClass = 'rounded-lg px-3 py-2 text-sm font-bold transition text-slate-700 hover:bg-brand-50 hover:text-brand-800'

const logoFilter =
  'brightness(0) saturate(100%) invert(28%) sepia(88%) saturate(900%) hue-rotate(248deg) brightness(88%)'

export default function PublicNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const goToSection = (id) => {
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#ded6ea] bg-white">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-[22px]">
        <Link to="/">
          <img src="/logo.png" alt="Transforma Educação PB" className="h-10 w-auto" style={{ filter: logoFilter }} />
        </Link>

        <nav className="flex items-center gap-0.5">
          <NavLink to="/" className={navLinkClass} end>Home</NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>Cursos</NavLink>
          <button type="button" onClick={() => goToSection('programa')} className={navBtnClass}>O Programa</button>
          <button type="button" onClick={() => goToSection('guia')} className={navBtnClass}>Guia</button>
          {/* O login do menu e o do cursista: e ele o publico do portal. A equipe
              entra pelo rodape, em /login. */}
          <Link
            to="/area-do-cursista"
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-[#6f35b5] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5a2b94]"
          >
            <LogIn size={15} /> Área do Cursista
          </Link>
        </nav>
      </div>
    </header>
  )
}
