import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useAvatar } from '../../context/AvatarContext'
import {
  LayoutDashboard, BookOpen, ShieldCheck, CalendarCheck, ClipboardList,
  ClipboardCheck, LogOut, ChevronLeft, ChevronRight, Camera, Sun, Moon, Globe, Users,
} from 'lucide-react'

// Menu reduzido ao que cada perfil realmente usa no dia a dia. Cursos e a porta
// de tudo que diz respeito a curso -- producao e ementa sao subrotas dele, e nao
// itens proprios. Frequencia, Cursistas e Acessos ficam restritos a quem
// administra o sistema.
const isCoordinatorRole = (user) => user?.role === 'coordenador' || (user?.function || '').toLowerCase().includes('coordenador')

const navItems = [
  {
    // O painel institucional. A gerencia entra junto porque a plateia dele e
    // exatamente a dela: alcance, territorio e prestacao de contas. Quem decide
    // de verdade e o backend, que libera os mesmos dois perfis.
    to: '/painel',
    icon: LayoutDashboard,
    label: 'Dashboard',
    visible: (user) => ['administrador', 'gerencia'].includes(user?.role),
  },
  { to: '/cursos', icon: BookOpen, label: 'Cursos' },
  // Producao saiu do menu: o trabalho acontece dentro do curso, pelo botao
  // "Producao" do card, e ter as duas entradas era o mesmo conteudo em dois
  // caminhos. O item tambem era um beco para o revisor, que o via no menu mas
  // nao tinha a visao consolidada e caia no aviso de acesso restrito.
  // A tabela consolidada de todos os cursos continua existindo em /producao,
  // fora da navegacao, ate o painel de acompanhamento assumir esse papel.
  {
    // A visao de gestao do mes: quem atribui e acompanha. Mesmas chaves da
    // HIERARQUIA no backend -- aqui so decide o que desenhar, e o servidor e
    // quem garante a permissao em cada rota.
    to: '/frequencia',
    icon: CalendarCheck,
    label: 'Frequência',
    visible: (user) => ['administrador', 'gerencia', 'supervisor', 'supervisor_tutoria'].includes(user?.role)
      || isCoordinatorRole(user),
  },
  {
    // A lista da propria pessoa: identica para todo mundo que recebe atividade,
    // do professor ao supervisor de tutoria. Administrador e gerencia nao
    // recebem, e por isso nao veem o item.
    //
    // Quem decide e o servidor (`recebeAtividade`); o perfil so responde
    // enquanto a resposta nao chega, para o menu nao piscar.
    to: '/minhas-atividades',
    icon: ClipboardList,
    label: 'Minhas atividades',
    visible: (user, resumo) => (resumo
      ? Boolean(resumo.recebeAtividade)
      : !['administrador', 'gerencia'].includes(user?.role)),
  },
  {
    // O outro papel de quem acumula os dois. Quem e avaliador so o servidor
    // sabe -- e escolhido atividade a atividade, e nao decorre do perfil.
    //
    // Administrador e gerencia ficam de fora mesmo quando avaliam: a tela
    // deles e Frequencia, que ja mostra o mes inteiro, e o que eles tem para
    // avaliar aparece la dentro, no detalhe de cada pessoa. Duas entradas de
    // menu para quem ja ve tudo numa so era repeticao.
    to: '/minhas-avaliacoes',
    icon: ClipboardCheck,
    label: 'Minhas avaliações',
    visible: (user, resumo) => Boolean(resumo?.souAvaliador)
      && !['administrador', 'gerencia'].includes(user?.role),
    contador: (resumo) => resumo?.pendentesParaAvaliar || 0,
  },
  { to: '/cursistas', icon: Users, label: 'Cursistas', visible: (user) => user?.role === 'administrador' },
  { to: '/acessos', icon: ShieldCheck, label: 'Acessos', visible: (user) => user?.role === 'administrador' },
  { to: '/', icon: Globe, label: 'Site', adminOnly: true },
]

const roleLabels = {
  administrador: 'Administrador',
  gerencia: 'Gerência',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio tecnico',
  gestao: 'Gestão de Pessoas',
  revisor: 'Revisor(a)',
  supervisor_tutoria: 'Supervisor de tutoria',
  ti: 'TI',
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
  const location = useLocation()
  const [resumoAtribuicoes, setResumoAtribuicoes] = useState(null)

  /**
   * Quantas avaliacoes esperam por esta pessoa.
   *
   * Recarrega a cada troca de tela em vez de ficar consultando por tempo: o
   * contador so muda depois de uma acao, e toda acao termina numa navegacao ou
   * num recarregamento da propria pagina que ja o atualiza.
   */
  useEffect(() => {
    let ativo = true
    api.get('/atribuicoes/resumo')
      .then(({ data }) => { if (ativo) setResumoAtribuicoes(data) })
      .catch(() => { if (ativo) setResumoAtribuicoes(null) })
    return () => { ativo = false }
  }, [location.pathname])

  const visibleNavItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'administrador') return false
    if (item.visible && !item.visible(user, resumoAtribuicoes)) return false
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

  // No escuro a pagina e o roxo quase preto e a lateral e um roxo mais claro,
  // funcionando como painel destacado do conteudo.
  const sidebarBackground = dark
    ? 'linear-gradient(180deg, #301D57 0%, #2A1A4E 45%, #231543 100%)'
    : 'linear-gradient(180deg, #2D1B69 0%, #3B1D7A 40%, #4A2080 100%)'

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col z-30 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}
      style={{ background: sidebarBackground }}
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
        {visibleNavItems.map(({ to, icon: Icon, label, contador }) => {
          const pendencias = contador ? contador(resumoAtribuicoes) : 0
          return (
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
                  {/* Recolhida, a lateral nao tem onde escrever o numero -- o
                      ponto avisa que ha pendencia e o tooltip diz quanta. */}
                  {pendencias > 0 && (collapsed
                    ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                    : <span className="bg-amber-400 text-[10px] font-bold text-purple-900 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{pendencias}</span>
                  )}
                  {!collapsed && isActive && pendencias === 0 && <ChevronRight size={14} className="text-white/50" />}
                  {collapsed && <Tooltip label={pendencias > 0 ? `${label} (${pendencias})` : label} />}
                </>
              )}
            </NavLink>
          )
        })}
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
