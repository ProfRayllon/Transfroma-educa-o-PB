import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, X } from 'lucide-react'
import CapaCurso from './CapaCurso'

/**
 * Alerta de abertura da Home: contagem regressiva para o fim das inscricoes,
 * com as capas dos cursos abertos embaixo.
 *
 * So aparece quando ha curso com inscricao aberta, e uma vez por sessao do
 * navegador -- quem fecha nao o ve de novo a cada volta para a Home. Some
 * sozinho quando a contagem chega a zero.
 *
 * A contagem mira o curso que fecha PRIMEIRO: e o prazo que alguem pode perder.
 * A data vem do servidor ja no instante certo (o container roda no fuso do
 * banco); aqui so se compara com o relogio do navegador.
 */

const CHAVE_SESSAO = 'transforma:alerta-inscricoes-visto'

function jaVisto() {
  try { return sessionStorage.getItem(CHAVE_SESSAO) === '1' } catch { return false }
}

function marcarVisto() {
  try { sessionStorage.setItem(CHAVE_SESSAO, '1') } catch { /* navegador sem armazenamento: so nao lembra */ }
}

function partes(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  }
}

const doisDigitos = (n) => String(n).padStart(2, '0')

function Bloco({ valor, rotulo }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/10 px-2 py-3 ring-1 ring-white/20 backdrop-blur-sm sm:py-4">
      <span key={valor} className="text-[34px] font-black leading-none tabular-nums text-white sm:text-[46px] animate-fade-in">
        {doisDigitos(valor)}
      </span>
      <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-purple-200 sm:text-[11px]">{rotulo}</span>
    </div>
  )
}

export default function AlertaInscricoes({ cursos }) {
  const abertos = useMemo(
    () => cursos.filter((c) => c.situacao === 'aberto' && c.enrollmentClosesAt),
    [cursos],
  )
  const prazo = useMemo(() => {
    const tempos = abertos.map((c) => new Date(c.enrollmentClosesAt).getTime()).filter(Number.isFinite)
    return tempos.length ? Math.min(...tempos) : null
  }, [abertos])

  const [aberto, setAberto] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  // Abre um instante depois da pagina, para nao competir com o carregamento.
  useEffect(() => {
    if (!prazo || prazo <= Date.now() || jaVisto()) return undefined
    const t = setTimeout(() => setAberto(true), 700)
    return () => clearTimeout(t)
  }, [prazo])

  useEffect(() => {
    if (!aberto) return undefined
    const intervalo = setInterval(() => setAgora(Date.now()), 1000)
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('keydown', aoTeclar)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflow
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const fechar = () => {
    marcarVisto()
    setAberto(false)
  }

  if (!aberto || !prazo) return null
  const restante = prazo - agora
  if (restante <= 0) return null
  const { dias, horas, minutos, segundos } = partes(restante)

  const dataDoPrazo = new Date(prazo).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerta-inscricoes-titulo"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1c1033]/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) fechar() }}
    >
      <div className="relative w-full max-w-[620px] overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(28,16,51,.45)]">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
        >
          <X size={18} />
        </button>

        {/* Topo: o anuncio e o tempo, que e o que este alerta existe para dizer. */}
        <div className="relative bg-gradient-to-br from-[#3b1d7a] via-[#5b2a9e] to-[#a855f7] px-6 pb-7 pt-8 text-center text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,.18)_0%,_transparent_55%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ring-1 ring-white/25">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-300" /> Inscrições abertas
            </span>
            <h2 id="alerta-inscricoes-titulo" className="mt-3 text-[26px] font-black leading-tight sm:text-[30px]">
              {abertos.length > 1 ? 'Novos cursos com inscrições abertas!' : 'Novo curso com inscrições abertas!'}
            </h2>
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[14px] text-white/80">
              <Clock size={14} /> As inscrições encerram em <strong className="text-white">{dataDoPrazo}</strong>
            </p>

            <div className="mx-auto mt-5 grid max-w-[460px] grid-cols-4 gap-2 sm:gap-3">
              <Bloco valor={dias} rotulo={dias === 1 ? 'dia' : 'dias'} />
              <Bloco valor={horas} rotulo="horas" />
              <Bloco valor={minutos} rotulo="min" />
              <Bloco valor={segundos} rotulo="seg" />
            </div>
          </div>
        </div>

        {/* Embaixo: as capas, pequenas, so para reconhecer os cursos. */}
        <div className="px-6 pb-6 pt-5 sm:px-8">
          <p className="mb-3 text-center text-[12px] font-black uppercase tracking-[0.16em] text-[#6f35b5]">
            {abertos.length > 1 ? `${abertos.length} cursos esperando por você` : 'Curso esperando por você'}
          </p>
          <div className="flex justify-center gap-3 overflow-x-auto pb-1">
            {abertos.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to="/catalogo-cursos"
                onClick={fechar}
                title={c.name}
                className="group w-[84px] shrink-0 text-center"
              >
                <div className="aspect-square overflow-hidden rounded-xl ring-1 ring-[#e9d5ff] transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <CapaCurso curso={c} />
                </div>
                <span className="mt-1.5 line-clamp-2 block text-[10.5px] font-bold leading-tight text-[#1c1033]">{c.name}</span>
              </Link>
            ))}
          </div>
          {abertos.length > 6 && (
            <p className="mt-1 text-center text-[11px] text-[#566176]">e mais {abertos.length - 6} no catálogo</p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <Link
              to="/catalogo-cursos"
              onClick={fechar}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-6 py-3.5 text-[15px] font-black text-white shadow-md transition hover:bg-[#5a2b94]"
            >
              Inscreva-se agora <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              onClick={fechar}
              className="rounded-xl px-6 py-3.5 text-[14px] font-bold text-[#566176] transition hover:bg-[#f5f3fa]"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
