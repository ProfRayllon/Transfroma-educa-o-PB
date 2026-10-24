import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, Clock, KeyRound, X } from 'lucide-react'
import CapaCurso from './CapaCurso'

/**
 * Alerta de abertura da Home: as novidades do programa e, quando ha curso com
 * inscricao aberta, a contagem regressiva para o fim das inscricoes com as
 * capas dos cursos.
 *
 * Aparece uma vez por sessao do navegador -- quem fecha nao o ve de novo a cada
 * volta para a Home. A chave muda quando o conteudo muda (v2: certificados e
 * redefinicao de senha), para quem ja tinha fechado a versao antiga ver a nova.
 *
 * A contagem mira o curso que fecha PRIMEIRO: e o prazo que alguem pode perder.
 * Sem curso aberto, o alerta mostra so as novidades.
 */

const CHAVE_SESSAO = 'transforma:alerta-inscricoes-visto-v2'

/** O que mudou para o cursista. Tirar daqui quando deixar de ser novidade. */
const NOVIDADES = [
  {
    icone: Award,
    titulo: 'Certificados na Área do Cursista',
    texto: 'Concluiu um curso? Entre com o seu CPF e baixe o certificado em PDF, com código de validação.',
  },
  {
    icone: KeyRound,
    titulo: 'Esqueceu a senha? Resolva sozinho',
    texto: 'Na tela de entrada, digite o CPF e clique em “Redefinir senha”. A senha padrão aparece na hora.',
  },
]

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

function Novidades() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {NOVIDADES.map(({ icone: Icone, titulo, texto }) => (
        <div key={titulo} className="flex gap-3 rounded-2xl border border-[#ede7f6] bg-[#faf7ff] p-3.5 text-left">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#6f35b5] text-white">
            <Icone size={18} />
          </span>
          <span>
            <span className="block text-[13.5px] font-black leading-tight text-[#1c1033]">{titulo}</span>
            <span className="mt-1 block text-[12px] leading-snug text-[#566176]">{texto}</span>
          </span>
        </div>
      ))}
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
    const futuro = tempos.filter((t) => t > Date.now())
    return futuro.length ? Math.min(...futuro) : null
  }, [abertos])

  const [aberto, setAberto] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  // Abre um instante depois da pagina, para nao competir com o carregamento.
  useEffect(() => {
    if (jaVisto()) return undefined
    const t = setTimeout(() => setAberto(true), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!aberto) return undefined
    const intervalo = prazo ? setInterval(() => setAgora(Date.now()), 1000) : null
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('keydown', aoTeclar)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      if (intervalo) clearInterval(intervalo)
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflow
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, prazo])

  const fechar = () => {
    marcarVisto()
    setAberto(false)
  }

  if (!aberto) return null
  // A contagem so existe enquanto falta tempo; zerou, o alerta segue so com as novidades.
  const restante = prazo ? prazo - agora : 0
  const comContagem = restante > 0
  const { dias, horas, minutos, segundos } = partes(restante)

  const dataDoPrazo = comContagem
    ? new Date(prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerta-inscricoes-titulo"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1c1033]/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) fechar() }}
    >
      <div className="relative max-h-[94vh] w-full max-w-[640px] overflow-y-auto rounded-3xl bg-white shadow-[0_30px_80px_rgba(28,16,51,.45)]">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
        >
          <X size={18} />
        </button>

        {/* Topo: com curso aberto, o anuncio e o tempo; sem, o titulo das novidades. */}
        <div className="relative bg-gradient-to-br from-[#3b1d7a] via-[#5b2a9e] to-[#a855f7] px-6 pb-7 pt-8 text-center text-white sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,.18)_0%,_transparent_55%)]" />
          {comContagem ? (
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
          ) : (
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ring-1 ring-white/25">
                Novidades
              </span>
              <h2 id="alerta-inscricoes-titulo" className="mt-3 text-[26px] font-black leading-tight sm:text-[30px]">
                Ficou mais fácil usar a Área do Cursista
              </h2>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-8">
          {/* Capas, pequenas, so para reconhecer os cursos abertos. */}
          {comContagem && (
            <>
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
              <p className="mb-2.5 mt-5 text-center text-[12px] font-black uppercase tracking-[0.16em] text-[#6f35b5]">Novidades</p>
            </>
          )}

          <Novidades />

          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <Link
              to={comContagem ? '/catalogo-cursos' : '/area-do-cursista'}
              onClick={fechar}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-6 py-3.5 text-[15px] font-black text-white shadow-md transition hover:bg-[#5a2b94]"
            >
              {comContagem ? 'Inscreva-se agora' : 'Acessar a Área do Cursista'} <ArrowRight size={16} />
            </Link>
            {comContagem && (
              <Link
                to="/area-do-cursista"
                onClick={fechar}
                className="inline-flex items-center justify-center rounded-xl border border-[#e9d5ff] px-5 py-3.5 text-[14px] font-bold text-[#6f35b5] transition hover:bg-[#faf5ff]"
              >
                Área do Cursista
              </Link>
            )}
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
