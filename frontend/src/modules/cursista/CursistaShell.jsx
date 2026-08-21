import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useCursista } from './CursistaContext'
import PublicNav from '../../components/public/PublicNav'
import PublicFooter from '../../components/public/PublicFooter'

const logoFilter =
  'brightness(0) saturate(100%) invert(28%) sepia(88%) saturate(900%) hue-rotate(248deg) brightness(88%)'

/**
 * Moldura das telas da area do cursista, na identidade do site.
 *
 * O topo muda conforme a tela seja uma etapa obrigatoria ou nao:
 *
 * - `bloqueado` (definir senha no primeiro acesso, completar cadastro): topo
 *   enxuto, so a logo e "Sair". O menu completo convidaria a sair de uma etapa
 *   que o backend nao deixa pular -- a pessoa clicaria em "Cursos" e voltaria
 *   para ca sem entender por que.
 * - livre (alterar senha, rever os dados): menu completo, porque a pessoa esta
 *   apenas visitando uma tela e pode ir para qualquer outra.
 */
export default function CursistaShell({
  bloqueado = false,
  badge,
  titulo,
  descricao,
  acao,
  children,
  largura = 'max-w-3xl',
}) {
  const { cursista, senhaPendente, encerrar } = useCursista()
  const navigate = useNavigate()

  // No login ainda nao ha sessao para encerrar; nas etapas obrigatorias ha,
  // mesmo quando o cadastro ainda nao foi carregado (primeiro acesso).
  const temSessao = Boolean(cursista) || senhaPendente

  const sair = () => {
    encerrar()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f5fb]">
      {bloqueado ? (
        <header className="border-b border-[#ded6ea] bg-white">
          <div className="flex h-16 w-full items-center justify-between px-6 lg:px-10">
            <Link to="/">
              <img src="/logo.png" alt="Transforma Educação PB" className="h-10 w-auto" style={{ filter: logoFilter }} />
            </Link>
            {/* Saida para quem travou na etapa e prefere voltar depois. */}
            {temSessao ? (
              <button
                type="button"
                onClick={sair}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-700"
              >
                <LogOut size={15} /> Sair
              </button>
            ) : (
              <Link
                to="/"
                className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
              >
                ← Voltar ao site
              </Link>
            )}
          </div>
        </header>
      ) : (
        <PublicNav />
      )}

      <main className="flex-1">
        <section className="relative overflow-hidden bg-[#3b1d7a] px-[22px] py-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,.28)_0%,_transparent_60%)]" />
          <div className={`relative mx-auto flex ${largura} flex-col gap-5 md:flex-row md:items-end md:justify-between`}>
            <div>
              {badge && (
                <span className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-purple-200 ring-1 ring-white/20">
                  {badge}
                </span>
              )}
              <h1 className="text-[34px] font-black leading-tight text-white">{titulo}</h1>
              {descricao && <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-white/70">{descricao}</p>}
              {bloqueado && cursista?.name && (
                <p className="mt-3 text-sm text-white/50">
                  {String(cursista.name).split(' ')[0]}, esta etapa é obrigatória para continuar.
                </p>
              )}
            </div>
            {acao && <div className="shrink-0 self-start md:self-auto">{acao}</div>}
          </div>
        </section>

        <div className={`mx-auto ${largura} space-y-5 px-[22px] py-10`}>
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

/** Cartao branco no mesmo estilo dos cards do site. */
export function CartaoCursista({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#ded6ea] bg-white p-6 shadow-[0_6px_20px_rgba(42,24,70,.06)] ${className}`}>
      {children}
    </section>
  )
}

export function TituloCartao({ children, descricao }) {
  return (
    <div className="mb-5">
      <h2 className="text-[19px] font-black leading-tight text-[#1c1033]">{children}</h2>
      {descricao && <p className="mt-1 text-sm text-[#566176]">{descricao}</p>}
    </div>
  )
}

/** Botao principal, no roxo do site. */
export const BOTAO_PRINCIPAL =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-6 py-3 text-sm font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-40 disabled:hover:bg-[#6f35b5]'
