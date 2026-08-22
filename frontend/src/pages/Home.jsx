import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Download, LayoutGrid } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import MapaParaiba from '../components/public/MapaParaiba'
import CapaCurso from '../components/public/CapaCurso'
import { duracaoCurso, nomeTrilha, ordenarPorInscricao } from '../lib/curso'
import publicApi from '../lib/publicApi'
import { useCursista } from '../modules/cursista/CursistaContext'
import cursistaApi from '../modules/cursista/api'

const heroImage = '/images/home/hero-capa.png'
const statsImage = '/images/home/resultados.png'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const SITUACOES = {
  aberto: { texto: 'Inscrições abertas', classe: 'bg-green-400/90 text-green-950' },
  em_breve: { texto: 'Em breve', classe: 'bg-amber-300/90 text-amber-900' },
  encerrado: { texto: 'Encerrado', classe: 'bg-slate-300/90 text-slate-800' },
  fechado: { texto: 'Em breve', classe: 'bg-amber-300/90 text-amber-900' },
}

const timeline = [
  ['1', 'Faça o login', 'Entre com as informações repassadas pelo seu tutor.'],
  ['2', 'Atualize seus dados', 'Confira e atualize seus dados para a emissão dos certificados.'],
  ['3', 'Acesse os cursos', 'Veja os cursos abertos e as suas ementas.'],
  ['4', 'Inscreva-se nos cursos', 'Escolha quantos cursos quiser, entre os que estiverem abertos.'],
  ['5', 'Acesse o AVA', 'Entre no curso pelo AVA na data definida para o início.'],
  ['6', 'Entrada gov.br', 'Entre no ambiente usando o sistema de autenticação do gov.br.'],
]

const stats = [
  { value: 200, prefix: '+', suffix: 'h', label: 'de formação' },
  { value: 100, suffix: '%', label: 'certificados emitidos para concluintes' },
  { value: 13000, prefix: '+', label: 'cursistas' },
  { value: 95, prefix: '+', suffix: '%', label: 'de satisfação' },
]

/**
 * Faixa que reconhece quem entrou.
 *
 * Aparece so para cursista logado, logo abaixo do banner. A home continua sendo
 * a pagina institucional -- quem trabalha nos cursos vai para a Area do
 * Cursista, e esta faixa e o atalho.
 */
function FaixaCursista() {
  const { cursista, cadastroPendente } = useCursista()
  const [total, setTotal] = useState(null)

  useEffect(() => {
    if (!cursista || cadastroPendente) return
    let ativo = true
    cursistaApi
      .get('/minhas-inscricoes')
      .then(({ data }) => { if (ativo) setTotal((data.atuais || []).length) })
      .catch(() => { /* a faixa e atalho, nao pode quebrar a home */ })
    return () => { ativo = false }
  }, [cursista, cadastroPendente])

  if (!cursista) return null

  const primeiroNome = String(cursista.name || '').split(' ')[0]

  return (
    <section className="border-b border-[#e9d5ff] bg-gradient-to-r from-[#f3e8ff] to-[#faf5ff] px-[22px] py-5">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[17px] font-black text-[#1c1033]">Olá, {primeiroNome}</p>
          <p className="mt-0.5 text-sm text-[#566176]">
            {cadastroPendente
              ? 'Complete o seu cadastro para poder se inscrever nos cursos.'
              : total === null
                ? 'Bem-vindo de volta à sua área do Transforma.'
                : total === 0
                  ? 'Você ainda não se inscreveu em nenhum curso desta edição.'
                  : `Você está inscrito em ${total} ${total === 1 ? 'curso' : 'cursos'} nesta edição.`}
          </p>
        </div>
        <Link
          to={cadastroPendente ? '/area-do-cursista/cadastro' : '/area-do-cursista'}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#6f35b5] px-6 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#5a2b94] sm:self-auto"
        >
          <LayoutGrid size={16} />
          {cadastroPendente ? 'Completar cadastro' : 'Ver meus cursos'}
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

function CountUp({ value, prefix = '', suffix = '', label }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    let rafId
    const start = performance.now()
    const duration = 900
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(value * ease))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value])

  return (
    <div className="group rounded-2xl border border-[#ded6ea] bg-gradient-to-br from-white to-[#faf5ff] p-6 shadow-[0_8px_24px_rgba(42,24,70,.07)] transition hover:shadow-[0_12px_32px_rgba(111,53,181,.15)] hover:-translate-y-0.5">
      <span className="block text-[42px] font-black leading-none text-[#6f35b5] tabular-nums">{prefix}{current.toLocaleString('pt-BR')}{suffix}</span>
      <p className="mt-3 text-[15px] font-bold leading-snug text-[#374151]">{label}</p>
    </div>
  )
}

function HeroStats() {
  const [counts, setCounts] = useState([0, 0, 0])
  const items = [
    { target: 13000, prefix: '+', suffix: '', label: 'cursistas', decimals: false },
    { target: 200,   prefix: '+', suffix: 'h', label: 'de formação', decimals: false },
    { target: 95,    prefix: '+', suffix: '%', label: 'de satisfação', decimals: false },
  ]

  useEffect(() => {
    const duration = 2800
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 4)
      setCounts(items.map((item) => Math.round(item.target * ease)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    const timeout = setTimeout(() => { raf = requestAnimationFrame(tick) }, 300)
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf) }
  }, [])

  const fmt = (v) => v >= 1000 ? v.toLocaleString('pt-BR') : String(v)

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      <div className="mx-auto flex max-w-[700px] divide-x divide-white/20 bg-black/30 backdrop-blur-md">
        {items.map((item, i) => (
          <div key={item.label} className="flex flex-1 flex-col items-center justify-center py-5">
            <span className="text-[32px] font-black leading-none text-white tabular-nums">
              {item.prefix}{fmt(counts[i])}{item.suffix}
            </span>
            <span className="mt-1.5 text-[12px] font-semibold uppercase tracking-wider text-white/65">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const NEON = '0 0 8px #a855f7, 0 0 20px #7e22ce, 0 0 40px rgba(168,85,247,.35)'
const NEON_LINE = 'rgba(168,85,247,.55)'

function FluxoTimeline() {
  const ref = useRef(null)
  const [step, setStep] = useState(-1)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let i = 0
          const tick = () => {
            setStep(i)
            i += 1
            if (i < timeline.length) setTimeout(tick, 2000)
          }
          tick()
          obs.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="overflow-hidden bg-white py-20 px-[22px]">
      <div className="mx-auto max-w-[1180px]">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">Passo a passo</p>
        <h2 className="mb-14 text-[38px] font-black leading-tight text-[#1c1033]">
          Fluxo de acesso<br />aos cursos
        </h2>

        {/* Desktop: linha horizontal com círculos */}
        <div className="hidden lg:block">
          {/* Círculos centralizados com linha atrás */}
          <div className="relative mb-10 flex items-center justify-between">
            {/* Linha de fundo */}
            <div className="absolute left-6 right-6 h-[2px] overflow-hidden bg-[#ede9fe]">
              <div
                className="h-full transition-all duration-[600ms] ease-in-out"
                style={{
                  width: step >= 0 ? `${Math.min((step / (timeline.length - 1)) * 100, 100)}%` : '0%',
                  background: `linear-gradient(to right, ${NEON_LINE}, #7e22ce)`,
                  boxShadow: '0 0 6px #a855f7',
                }}
              />
            </div>
            {timeline.map(([s], i) => (
              <div
                key={s}
                className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-black text-white transition-all duration-500"
                style={{
                  background: step >= i ? '#7336C1' : '#ede9fe',
                  color: step >= i ? '#fff' : '#c4b5fd',
                  boxShadow: step >= i ? NEON : 'none',
                  transform: step >= i ? 'scale(1)' : 'scale(0.85)',
                  opacity: step >= i ? 1 : 0.6,
                }}
              >
                {s}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-6 gap-4">
            {timeline.map(([s, title, text], i) => (
              <div
                key={s}
                className="transition-all duration-500"
                style={{
                  opacity: step >= i ? 1 : 0,
                  transform: step >= i ? 'translateY(0)' : 'translateY(14px)',
                }}
              >
                <h3 className="mb-1.5 text-[14px] font-black leading-tight text-[#1c1033]">{title}</h3>
                <p className="text-[12.5px] leading-relaxed text-[#566176]">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical */}
        <div className="flex flex-col gap-0 lg:hidden">
          {timeline.map(([s, title, text], i) => (
            <div
              key={s}
              className="flex gap-5 transition-all duration-500"
              style={{ opacity: step >= i ? 1 : 0.2, transform: step >= i ? 'translateX(0)' : 'translateX(-12px)' }}
            >
              <div className="flex flex-col items-center">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black"
                  style={{
                    background: step >= i ? '#7336C1' : '#ede9fe',
                    color: step >= i ? '#fff' : '#c4b5fd',
                    boxShadow: step >= i ? NEON : 'none',
                  }}
                >
                  {s}
                </div>
                {i < timeline.length - 1 && (
                  <div className="my-1 w-[2px] flex-1 bg-[#ede9fe]">
                    <div
                      className="w-full transition-all duration-500"
                      style={{
                        height: step > i ? '100%' : '0%',
                        background: `linear-gradient(to bottom, ${NEON_LINE}, #7e22ce)`,
                        minHeight: step > i ? '36px' : '0px',
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="pb-8 pt-1">
                <h3 className="mb-1 text-[15px] font-black text-[#1c1033]">{title}</h3>
                <p className="text-[13px] leading-relaxed text-[#566176]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const [cursos, setCursos] = useState([])
  const [trilhaAtiva, setTrilhaAtiva] = useState(null)
  const carouselRef = useRef(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await publicApi.get('/publico/cursos')
      setCursos(data)
    } catch {
      // Home e vitrine: sem a API, o carrossel some e o resto da pagina fica.
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Filtros vindos das trilhas que existem de verdade no banco, e nao de uma
  // lista fixa que envelhecia toda vez que a equipe cadastrava um curso novo.
  const trilhas = useMemo(() => {
    const vistas = new Map()
    cursos.forEach((curso) => {
      if (curso.trail && !vistas.has(curso.trail)) vistas.set(curso.trail, nomeTrilha(curso.trail))
    })
    return [...vistas.entries()]
  }, [cursos])

  // Filtra pela trilha e joga os cursos com inscricao aberta para a frente.
  const visibleCourses = useMemo(
    () => ordenarPorInscricao(trilhaAtiva ? cursos.filter((c) => c.trail === trilhaAtiva) : cursos),
    [cursos, trilhaAtiva],
  )

  /**
   * Ate onde da para rolar, para as setas nao mentirem.
   *
   * Uma seta que aponta para um lado onde nao ha mais nada e ruido: a pessoa
   * clica e a tela nao se mexe. Cada uma so aparece quando existe conteudo
   * naquela direcao.
   */
  const [rolagem, setRolagem] = useState({ temAntes: false, temDepois: false })

  const medirRolagem = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    // Tolerancia de 4px: a largura de rolagem raramente fecha exata por causa
    // de arredondamento de subpixel, e sem folga a seta da direita ficaria
    // acesa para sempre no fim da lista.
    const folga = 4
    setRolagem({
      temAntes: el.scrollLeft > folga,
      temDepois: el.scrollLeft + el.clientWidth < el.scrollWidth - folga,
    })
  }, [])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return

    medirRolagem()
    el.addEventListener('scroll', medirRolagem, { passive: true })

    // A largura muda ao redimensionar a janela e ao trocar o filtro de trilha;
    // sem observar, a seta continuaria como estava na medicao anterior.
    const observador = new ResizeObserver(medirRolagem)
    observador.observe(el)

    return () => {
      el.removeEventListener('scroll', medirRolagem)
      observador.disconnect()
    }
  }, [medirRolagem, visibleCourses])

  const scrollCarousel = (dir) => {
    carouselRef.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative min-h-[520px] overflow-hidden bg-[#3b1d7a]">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3b1d7a]/10 via-transparent to-[#1a0733]/80" />
          <HeroStats />
        </section>

        <FaixaCursista />


        {/* ── Cursos ── */}
        <section className="mx-auto max-w-[1180px] px-[22px] py-14">
          {/* Header */}
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="mb-2 inline-block rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
                Formação 2026
              </span>
              <h2 className="text-[34px] font-black leading-tight tracking-tight">Transforma Educação PB</h2>
              <p className="mt-2 max-w-xl text-[17px] leading-relaxed text-[#566176]">
                Trilhas formativas para fortalecer a prática pedagógica e elevar a qualidade da educação na Paraíba.
              </p>
            </div>
            <Link to="/catalogo-cursos" className="shrink-0 text-sm font-black text-[#6f35b5] hover:underline">
              Ver catálogo →
            </Link>
          </div>

          {/* Filtros — linha única sem scrollbar */}
          {trilhas.length > 0 && (
            <div className="mb-8 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[[null, 'Todos'], ...trilhas].map(([valor, rotulo]) => (
                <button
                  key={rotulo}
                  type="button"
                  onClick={() => setTrilhaAtiva(valor)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-5 py-2 text-sm font-bold transition ${
                    trilhaAtiva === valor
                      ? 'border-[#6f35b5] bg-[#6f35b5] text-white shadow-md'
                      : 'border-[#ddd6fe] bg-white text-[#6f35b5] hover:border-[#6f35b5] hover:bg-[#faf5ff]'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          )}

          {/*
            Carrossel com as setas na margem da pagina, fora do container.

            Elas ja estiveram sobre os cards (tapavam a arte) e depois numa faixa
            reservada dentro da area de rolagem -- que resolvia a sobreposicao
            mas custava 112px de largura, e ai o terceiro card cortava: tres
            cards pedem 1060px e sobravam 1024px.

            O espaco existe FORA: o container tem 1180px no maximo e a tela do
            desktop e bem mais larga. As setas ocupam essa sobra, e o carrossel
            fica com a largura inteira -- os tres cards cabem sem corte.
          */}
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {visibleCourses.length === 0 && (
                <div className="flex h-[240px] w-full items-center justify-center rounded-2xl border border-dashed border-[#ddd6fe]">
                  <div className="text-center">
                    <p className="mb-3 text-[#9070c8]">Nenhum curso disponível nesta trilha ainda.</p>
                    <Link to="/catalogo-cursos" className="text-sm font-black text-[#6f35b5] hover:underline">
                      Ver catálogo completo →
                    </Link>
                  </div>
                </div>
              )}
              {visibleCourses.map((course) => {
                const situacao = SITUACOES[course.situacao] || SITUACOES.fechado
                /**
                 * So o curso com inscricao aberta fica "aceso".
                 *
                 * Quem chega na Home varre a fila de olho, e sem essa distincao
                 * um curso que ainda nem tem data parece tao disponivel quanto o
                 * que aceita inscricao hoje -- a pessoa clica, chega no catalogo
                 * e nao tem botao. O cinza responde antes do clique.
                 *
                 * Continua clicavel de proposito, e a cor volta ao passar o
                 * mouse: quem quer conhecer um curso que ainda vai abrir
                 * precisa conseguir chegar na ementa.
                 */
                const aberto = course.situacao === 'aberto'
                return (
                  // A capa deixa de ser fundo do card e ganha area propria, no
                  // mesmo formato quadrado da arte. Antes, o titulo ficava por
                  // cima dela com um gradiente escuro: o terco de baixo da
                  // imagem sumia justamente onde esta a ilustracao.
                  <Link
                    key={course.id}
                    to="/catalogo-cursos"
                    className={`group flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(111,53,181,.22)] ${
                      aberto
                        ? 'border-[#e9d5ff] shadow-[0_8px_28px_rgba(17,24,39,.10)]'
                        : 'border-[#e5e7eb] shadow-[0_8px_28px_rgba(17,24,39,.06)]'
                    }`}
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f1edf8]">
                      <CapaCurso
                        curso={course}
                        className={aberto ? '' : 'grayscale transition duration-300 group-hover:grayscale-0'}
                      />
                      {/* Camada cinza sobre a arte. Vem antes da etiqueta no
                          DOM para nao cobri-la: o estado do curso precisa
                          continuar legivel justamente no card apagado. */}
                      {!aberto && (
                        <div className="pointer-events-none absolute inset-0 bg-slate-500/25 transition duration-300 group-hover:opacity-0" />
                      )}
                      <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black backdrop-blur-sm ${situacao.classe}`}>
                        {situacao.texto}
                      </span>
                    </div>

                    <div className={`flex flex-1 flex-col p-5 transition duration-300 ${aberto ? '' : 'opacity-60 group-hover:opacity-100'}`}>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                          {nomeTrilha(course.trail)}
                        </span>
                        {duracaoCurso(course) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-black text-[#566176]">
                            <Clock size={11} /> {duracaoCurso(course).texto}
                          </span>
                        )}
                      </div>
                      <h3 className="text-[15px] font-black leading-snug text-[#1c1033]">{course.name}</h3>
                      <span className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-black text-[#6f35b5]">
                        Ver detalhes <ArrowRight size={14} />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/*
              `xl` (1280px) e nao `lg` (1024px): abaixo disso a sobra ao lado do
              container de 1180px nao cabe uma seta de 44px, e ela sairia da
              tela. Nessa faixa a rolagem fica por toque e trackpad, que e o
              gesto natural de tablet.
            */}
            {rolagem.temAntes && (
              <button
                type="button"
                onClick={() => scrollCarousel(-1)}
                aria-label="Ver os cursos anteriores"
                className="absolute -left-16 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#ede9f6] bg-white text-[#6f35b5] shadow-[0_4px_16px_rgba(0,0,0,.15)] transition hover:bg-[#6f35b5] hover:text-white xl:grid"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {rolagem.temDepois && (
              <button
                type="button"
                onClick={() => scrollCarousel(1)}
                aria-label="Ver os próximos cursos"
                className="absolute -right-16 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-[#ede9f6] bg-white text-[#6f35b5] shadow-[0_4px_16px_rgba(0,0,0,.15)] transition hover:bg-[#6f35b5] hover:text-white xl:grid"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </section>

        {/* ── O Programa ── */}
        <section id="programa" className="relative overflow-hidden bg-[#3b1d7a] px-[22px] py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,.25)_0%,_transparent_60%)]" />
          <div className="relative mx-auto max-w-[820px] text-center">
            <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-purple-200 ring-1 ring-white/20">
              Programa 2026
            </span>
            <h2 className="mb-6 text-[44px] font-black leading-tight text-white">
              O Programa Transforma
            </h2>
            <p className="text-[19px] leading-relaxed text-white/80">
              O <strong className="font-black text-white">Transforma Educação PB</strong> é o programa de
              formação continuada dos profissionais da educação da rede estadual, conduzido pela
              Gerência Executiva de Formação e Desenvolvimento dos Profissionais da Educação (GEFDP).
            </p>
          </div>
        </section>

        {/* ── Fluxo ── */}
        <FluxoTimeline />

        {/* ── Guia ── */}
        <section id="guia" className="relative overflow-hidden bg-[#3b1d7a] px-[22px] py-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,.25)_0%,_transparent_60%)]" />
          <div className="relative mx-auto flex max-w-[1180px] flex-col gap-10 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-purple-200 ring-1 ring-white/20">
                Material de apoio
              </span>
              <h2 className="mb-4 text-[44px] font-black leading-tight text-white">Guias Transforma</h2>
              <p className="max-w-lg text-[18px] leading-relaxed text-white/70">
                Acesse os materiais de apoio do programa para navegar no AVA, acompanhar as trilhas e obter seu certificado.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <a
                href="/guias/GUIA_CURSISTA_TRANSFORMA_2026.pdf"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-[15px] font-black text-[#6b21a8] shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <Download size={16} /> Guia do Cursista
              </a>
              <a
                href="/guias/GUIA_RIEH_TRANSFORMA_v3.pdf"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-[#2d0f5e] px-8 py-4 text-[15px] font-black text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#3d1878]"
              >
                <Download size={16} /> Tutorial de Acesso ao RIEH PB
              </a>
            </div>
          </div>
        </section>

        <MapaParaiba />

        {/* ── AVA ── */}
        <section className="bg-[#f0fdf4] px-[22px] py-24">
          <div className="mx-auto max-w-[660px] text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-white px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-[#166534]">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Ambiente virtual
            </span>
            <h2 className="mb-5 text-[52px] font-black leading-tight text-[#14532d]">
              Acesse o <span className="text-[#16a34a]">AVA RIEH/PB</span>
            </h2>
            <p className="mb-10 text-[18px] leading-relaxed text-[#374151]">
              O ambiente virtual reúne aulas, materiais, atividades e o acompanhamento dos cursos. Após validar o CPF, entre com sua conta <strong className="text-[#14532d]">gov.br</strong>.
            </p>
            <a
              href={avaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#14532d] px-9 py-4 text-[16px] font-black text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#166534] hover:shadow-lg"
            >
              Acessar AVA RIEH/PB <ArrowRight size={16} />
            </a>
          </div>
        </section>

        {/* ── CTA + Video ── */}
        <section className="bg-gradient-to-r from-[#3b1d7a] via-[#6f35b5] to-[#a855f7]">
          <div className="mx-auto max-w-[860px] px-[22px] py-20 text-center">
            <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white/80 ring-1 ring-white/25">
              Formação continuada
            </span>
            <h2 className="mb-4 text-[40px] font-black uppercase leading-tight tracking-tight text-white">
              Transforme sua prática
            </h2>
            <p className="mx-auto max-w-[560px] text-[17px] leading-relaxed text-white/80">
              Participe de formações alinhadas à realidade da rede com intenção, método e resultado.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-7 py-3 text-[15px] font-black text-[#6f35b5] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                to="/catalogo-cursos"
              >
                Acessar cursos
              </Link>
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/50 bg-white/15 px-7 py-3 text-[15px] font-black text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/25"
                href={avaUrl} target="_blank" rel="noreferrer"
              >
                Entrar no AVA
              </a>
            </div>
          </div>
        </section>

        {/* ── Resultados ── */}
        <section className="mx-auto max-w-[1180px] px-[22px] py-14">
          <span className="mb-2 inline-block rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
            Números
          </span>
          <h2 className="mb-8 text-[32px] font-black leading-tight tracking-tight">Resultados esperados</h2>
          <div className="grid items-stretch gap-6 md:grid-cols-[0.85fr_1.15fr]">
            <div className="overflow-hidden rounded-2xl shadow-[0_10px_32px_rgba(42,24,70,.10)]">
              <img src={statsImage} alt="Resultados esperados" className="h-full min-h-[310px] w-full object-cover" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <CountUp key={stat.label} {...stat} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
