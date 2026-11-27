import { useEffect, useMemo, useState } from 'react'
import { Clock, X } from 'lucide-react'
import CapaCurso from './CapaCurso'

/**
 * Alerta de abertura da Home: o aviso de encerramento (27/11, 13h).
 *
 * Cronometro unico e os oito cursos das tres trilhas, que encerram no mesmo
 * dia. So informacao -- sem botoes: fecha no X, no Esc
 * ou clicando fora. Passado o prazo, o alerta deixa de aparecer.
 *
 * Aparece toda vez que a Home e carregada (inclusive ao atualizar a pagina).
 *
 * Os cursos ficam fixos aqui, e nao no banco: e um comunicado com data para
 * acabar, escrito pela coordenacao. Passado o prazo, sai sozinho.
 */

// 27 de novembro, 13h, no horario de Brasilia.
const PRAZO_FINAL = new Date('2026-11-27T13:00:00-03:00').getTime()

const TRILHAS = [
  {
    titulo: 'Trilha Institucional',
    cursos: [
      { id: 10, nome: 'Google for Education' },
      { id: 11, nome: 'Legislação Educacional' },
      { id: 15, nome: 'Análise de dados e gestão da aprendizagem' },
    ],
  },
  {
    titulo: 'Trilha da BNCC',
    cursos: [
      { id: 4, nome: 'Aprendizagens essenciais e recomposição em Matemática e Ciências da Natureza' },
      { id: 5, nome: 'Leitura, produção textual e recomposição em Linguagens' },
      { id: 3, nome: 'Territórios, cultura e identidade no ensino de Ciências Humanas' },
    ],
  },
  {
    titulo: 'Trilha Transversal',
    cursos: [
      { id: 8, nome: 'Educação inclusiva: fundamentos, estratégias e acessibilidade' },
      { id: 2, nome: 'BNCC Computação na prática docente' },
    ],
  },
]

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
      <span key={valor} className="text-[32px] font-black leading-none tabular-nums text-white sm:text-[44px] animate-fade-in">
        {doisDigitos(valor)}
      </span>
      <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-purple-200 sm:text-[11px]">{rotulo}</span>
    </div>
  )
}

/** Card de um curso no aviso: capa pequena, nome e a data de encerramento. */
function CursoDoAviso({ curso, dadosDoCurso }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-[#ede7f6] bg-white p-2.5 text-left">
      <div className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-[#e9d5ff]">
        <CapaCurso curso={dadosDoCurso || { id: curso.id, hasImage: true, trail: '' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-black text-red-700 ring-1 ring-red-200">Encerra hoje às 13h</span>
        <span className="mt-1 block text-[13px] font-black leading-snug text-[#1c1033]">{curso.nome}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-[#566176]">Conclua as atividades até as 13h de 27/11.</span>
      </div>
    </div>
  )
}

export default function AlertaInscricoes({ cursos }) {
  // Dados dos cursos (capa) vindos da lista publica, pelo id.
  const porId = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos])

  const [aberto, setAberto] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const comPrazo = PRAZO_FINAL - agora > 0

  // Abre um instante depois da pagina, para nao competir com o carregamento.
  useEffect(() => {
    if (Date.now() >= PRAZO_FINAL) return undefined
    const t = setTimeout(() => setAberto(true), 700)
    return () => clearTimeout(t)
  }, [])

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

  const fechar = () => setAberto(false)

  if (!aberto || !comPrazo) return null
  const { dias, horas, minutos, segundos } = partes(PRAZO_FINAL - agora)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerta-inscricoes-titulo"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1c1033]/70 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) fechar() }}
    >
      <div className="relative max-h-[94vh] w-full max-w-[1120px] overflow-y-auto rounded-3xl bg-white shadow-[0_30px_80px_rgba(28,16,51,.45)]">
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
        >
          <X size={18} />
        </button>

        <div className="relative bg-gradient-to-br from-[#3b1d7a] via-[#5b2a9e] to-[#a855f7] px-6 pb-7 pt-8 text-center text-white sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,.18)_0%,_transparent_55%)]" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ring-1 ring-white/25">
              <Clock size={12} /> Prazo final
            </span>
            <h2 id="alerta-inscricoes-titulo" className="mt-3 text-[24px] font-black leading-tight sm:text-[32px]">
              Todos os cursos encerram hoje, 27 de novembro, às 13h
            </h2>
            <p className="mx-auto mt-2 max-w-[700px] text-[14px] leading-relaxed text-white/85">
              Os <strong className="text-white">oito cursos</strong> das trilhas Institucional, da BNCC e Transversal encerram hoje, às 13h. Garanta a conclusão
              das atividades antes do prazo.
            </p>
            <div className="mx-auto mt-5 grid max-w-[460px] grid-cols-4 gap-2 sm:gap-3">
              <Bloco valor={dias} rotulo={dias === 1 ? 'dia' : 'dias'} />
              <Bloco valor={horas} rotulo="horas" />
              <Bloco valor={minutos} rotulo="min" />
              <Bloco valor={segundos} rotulo="seg" />
            </div>
          </div>
        </div>

        {/* As tres trilhas, lado a lado no computador e empilhadas no celular. */}
        <div className="grid gap-5 px-5 pb-7 pt-6 sm:px-8 lg:grid-cols-3">
          {TRILHAS.map((trilha) => (
            <section key={trilha.titulo}>
              <h3 className="mb-2.5 flex items-center justify-between text-[12px] font-black uppercase tracking-[0.16em] text-[#6f35b5]">
                {trilha.titulo}
                <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-[10.5px] tracking-normal">{trilha.cursos.length} cursos</span>
              </h3>
              <div className="grid gap-2.5">
                {trilha.cursos.map((c) => <CursoDoAviso key={c.id} curso={c} dadosDoCurso={porId.get(c.id)} />)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
