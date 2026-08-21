import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, KeyRound, LayoutGrid, LogIn, LogOut, UserCog } from 'lucide-react'
import { useCursista } from '../../modules/cursista/CursistaContext'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition ${
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'
  }`

const navBtnClass = 'rounded-lg px-3 py-2 text-sm font-bold transition text-slate-700 hover:bg-brand-50 hover:text-brand-800'

const logoFilter =
  'brightness(0) saturate(100%) invert(28%) sepia(88%) saturate(900%) hue-rotate(248deg) brightness(88%)'

/** Menu do cursista logado: nome no topo, acoes da conta dentro. */
function MenuCursista({ cursista, aoSair }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  // Fecha ao clicar fora ou apertar Esc -- sem isso o menu fica preso aberto
  // quando a pessoa desiste e clica em outro lugar da pagina.
  useEffect(() => {
    if (!aberto) return
    const aoClicarFora = (evento) => {
      if (ref.current && !ref.current.contains(evento.target)) setAberto(false)
    }
    const aoTeclar = (evento) => { if (evento.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  const primeiroNome = String(cursista.name || '').split(' ')[0]
  const itemClass = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-brand-50 hover:text-brand-800'

  return (
    <div className="relative ml-2" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex items-center gap-2 rounded-lg bg-[#6f35b5] py-2 pl-3 pr-2.5 text-sm font-bold text-white transition hover:bg-[#5a2b94]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[11px] font-black uppercase">
          {primeiroNome.charAt(0)}
        </span>
        <span className="max-w-[140px] truncate">{primeiroNome}</span>
        <ChevronDown size={14} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#ded6ea] bg-white py-1.5 shadow-[0_12px_32px_rgba(42,24,70,.16)]">
          <div className="border-b border-[#f1ebf9] px-4 pb-2.5 pt-1">
            <p className="truncate text-sm font-black text-[#1c1033]">{cursista.name}</p>
            <p className="text-[11px] text-slate-500">Área do Cursista</p>
          </div>
          <Link to="/area-do-cursista" onClick={() => setAberto(false)} className={itemClass}>
            <LayoutGrid size={15} /> Meus cursos
          </Link>
          <Link to="/area-do-cursista/cadastro" onClick={() => setAberto(false)} className={itemClass}>
            <UserCog size={15} /> Meus dados
          </Link>
          <Link to="/area-do-cursista/senha" onClick={() => setAberto(false)} className={itemClass}>
            <KeyRound size={15} /> Alterar senha
          </Link>
          <button
            type="button"
            onClick={() => { setAberto(false); aoSair() }}
            className={`${itemClass} border-t border-[#f1ebf9] hover:bg-red-50 hover:text-red-700`}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      )}
    </div>
  )
}

export default function PublicNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cursista, encerrar } = useCursista()

  const goToSection = (id) => {
    if (location.pathname === '/') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/')
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }

  const sair = () => {
    encerrar()
    navigate('/', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#ded6ea] bg-white">
      {/* Largura cheia, sem o container de 1180px do resto da pagina: o hero
          logo abaixo vai de ponta a ponta, e a barra centrada deixava uma folga
          visivel dos dois lados. Aqui a logo encosta na esquerda e o menu na
          direita, como o conteudo que vem depois. */}
      <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
        <Link to="/">
          <img src="/logo.png" alt="Transforma Educação PB" className="h-10 w-auto" style={{ filter: logoFilter }} />
        </Link>

        <nav className="flex items-center gap-0.5">
          <NavLink to="/" className={navLinkClass} end>Home</NavLink>
          <NavLink to="/catalogo-cursos" className={navLinkClass}>Cursos</NavLink>
          <button type="button" onClick={() => goToSection('programa')} className={navBtnClass}>O Programa</button>
          <button type="button" onClick={() => goToSection('guia')} className={navBtnClass}>Guia</button>

          {/* Logado, o botao de entrar vira o menu da conta. A equipe entra pelo
              rodape, em /login -- o publico do portal e o cursista. */}
          {cursista ? (
            <MenuCursista cursista={cursista} aoSair={sair} />
          ) : (
            <Link
              to="/area-do-cursista"
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-[#6f35b5] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#5a2b94]"
            >
              <LogIn size={15} /> Área do Cursista
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
