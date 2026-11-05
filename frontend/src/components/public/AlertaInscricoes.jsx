import { useEffect, useMemo, useState } from 'react'
import { Clock, X } from 'lucide-react'
import CapaCurso from './CapaCurso'

/**
 * Alerta de abertura da Home: o aviso do prazo final (20/11).
 *
 * Cronometro unico para todos os cursos e os oito cursos nas tres trilhas,
 * cada um com a sua situacao (reaberto, em andamento, em enturmacao). So
 * informacao -- sem botoes: fecha no X, no Esc ou clicando fora. Passado o
 * prazo, o alerta deixa de aparecer.
 *
 * Aparece uma vez por sessao do navegador. A chave muda quando o conteudo muda,
 * para quem fechou a versao anterior ver a nova uma vez.
 *
 * Os cursos e as situacoes ficam fixos aqui, e nao no banco: e um comunicado
 * com data para acabar, escrito pela coordenacao. Passado o prazo, sai sozinho.
 */

const CHAVE_SESSAO = 'transforma:alerta-inscricoes-visto-v4'

// 20 de novembro, fim do dia, no horario de Brasilia.
const PRAZO_FINAL = new Date('2026-11-20T23:59:59-03:00').getTime()

const SITUACOES = {
  reaberto: { rotulo: 'Reaberto', classe: 'bg-green-100 text-green-800 ring-green-200' },
  andamento: { rotulo: 'Em andamento', classe: 'bg-[#f3e8ff] text-[#6f35b5] ring-[#e9d5ff]' },
  enturmacao: { rotulo: 'Em enturmação', classe: 'bg-amber-100 text-amber-800 ring-amber-200' },
}

const TRILHAS = [
  {
    titulo: 'Trilha Institucional',
    cursos: [
      { id: 10, nome: 'Google for Education', situacao: 'reaberto', texto: 'Curso reaberto para quem já estava inscrito.' },
      { id: 11, nome: 'Legislação Educacional', situacao: 'reaberto', texto: 'Curso reaberto para quem já estava inscrito.' },
      { id: 15, nome: 'Análise de dados e gestão da aprendizagem', situacao: 'enturmacao', texto: 'Enturmação de professores e diretores.' },
    ],
  },
  {
    titulo: 'Trilha da BNCC',
    cursos: [
      { id: 4, nome: 'Aprendizagens essenciais e recomposição em Matemática e Ciências da Natureza', situacao: 'andamento', texto: 'Curso em andamento até 20/11.' },
      { id: 5, nome: 'Leitura, produção textual e recomposição em Linguagens', situacao: 'andamento', texto: 'Curso em andamento até 20/11.' },
      { id: 3, nome: 'Territórios, cultura e identidade no ensino de Ciências Humanas', situacao: 'andamento', texto: 'Curso em andamento até 20/11.' },
    ],
  },
  {
    titulo: 'Trilha Transversal',
    cursos: [
      { id: 8, nome: 'Educação inclusiva: fundamentos, estratégias e acessibilidade', situacao: 'enturmacao', texto: 'Enturmação em andamento.' },
      { id: 2, nome: 'BNCC Computação na prática docente', situacao: 'enturmacao', texto: 'Enturmação em andamento.' },
    ],
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
      <span key={valor} className="text-[32px] font-black leading-none tabular-nums text-white sm:text-[44px] animate-fade-in">
        {doisDigitos(valor)}
      </span>
      <span className="mt-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-purple-200 sm:text-[11px]">{rotulo}</span>
    </div>
  )
}

/** Card de um curso no aviso: capa pequena, nome, situacao e o que esta acontecendo. */
function CursoDoAviso({ curso, dadosDoCurso }) {
  const situacao = SITUACOES[curso.situacao]
  return (
    <div className="flex gap-3 rounded-2xl border border-[#ede7f6] bg-white p-2.5 text-left">
      <div className="h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-[#e9d5ff]">
        <CapaCurso curso={dadosDoCurso || { id: curso.id, hasImage: true, trail: '' }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ${situacao.classe}`}>{situacao.rotulo}</span>
        <span className="mt-1 block text-[13px] font-black leading-snug text-[#1c1033]">{curso.nome}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-[#566176]">{curso.texto}</span>
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
    if (jaVisto() || Date.now() >= PRAZO_FINAL) return undefined
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

  const fechar = () => {
    marcarVisto()
    setAberto(false)
  }

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
              Todos os cursos encerram em 20 de novembro
            </h2>
            <p className="mx-auto mt-2 max-w-[700px] text-[14px] leading-relaxed text-white/85">
              Os cursos estão abertos <strong className="text-white">apenas para quem já está inscrito</strong>.
              Google for Education e Legislação Educacional foram reabertos; os demais seguem até o mesmo prazo.
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
