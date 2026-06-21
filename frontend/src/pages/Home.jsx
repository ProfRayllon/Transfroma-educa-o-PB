import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const heroImage = '/images/home/hero-capa.png'
const avaImage = '/images/home/ava.png'
const statsImage = '/images/home/resultados.png'
const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const allCourses = [
  { title: 'Google for Education', tag: 'Trilha Institucional', workload: '20h', status: 'Em andamento', image: '/images/home/curso-google.png' },
  { title: 'Antes que aconteça nas Escolas', tag: 'Trilha Institucional', workload: '20h', status: 'Em breve', image: '/images/home/curso-antes-escolas.png' },
  { title: 'Legislação Educacional na Prática Docente', tag: 'Trilha Institucional', workload: '20h', status: 'Em breve', image: '/images/home/curso-legislacao.png' },
]

const timeline = [
  ['1', 'Inscrição', 'Realize a inscrição no formulário do Programa de Formação.'],
  ['2', 'Acesso ao portal', 'Acesse o portal do Transforma Educação PB, na área de cursos.'],
  ['3', 'Escolha do curso', 'Selecione o curso desejado e confira a trilha correspondente.'],
  ['4', 'Validação do CPF', 'Informe o CPF para confirmar se sua inscrição foi localizada.'],
  ['5', 'Acesso ao AVA', 'Após a validação, acesse o Ambiente Virtual de Aprendizagem.'],
  ['6', 'Entrada gov.br', 'Entre no ambiente usando o sistema de autenticação do gov.br.'],
]

const stats = [
  { value: 200, prefix: '+', suffix: 'h', label: 'de formação' },
  { value: 100, suffix: '%', label: 'certificados emitidos para concluintes' },
  { value: 13000, prefix: '+', label: 'cursistas' },
  { value: 95, prefix: '+', suffix: '%', label: 'de satisfação' },
]

const FILTERS = [
  { label: 'Todos', match: null },
  { label: 'Institucional', match: 'Trilha Institucional' },
  { label: 'Socioemocional', match: 'Educacao Socioemocional' },
  { label: 'Tecnologia', match: 'Educacao, Ciencia e Tecnologia' },
  { label: 'Gestão', match: 'Gestao Pedagogica' },
  { label: 'Pedagogia', match: 'Gestao Pedagogica' },
  { label: 'Inclusiva', match: 'Educacao Inclusiva' },
]

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
            if (i < timeline.length) setTimeout(tick, 750)
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
    <section ref={ref} className="overflow-hidden bg-[#0a0615] py-20 px-[22px]">
      <div className="mx-auto max-w-[1180px]">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.3em] text-[#a855f7]">Passo a passo</p>
        <h2 className="mb-14 text-[38px] font-black leading-tight text-white">
          Fluxo de acesso<br />aos cursos
        </h2>


        {/* Desktop: linha horizontal com círculos */}
        <div className="hidden lg:block">
          {/* Linha conectora animada */}
          <div className="relative mb-8 flex items-center">
            {timeline.map(([s], i) => (
              <div key={s} className="flex flex-1 items-center">
                {/* Círculo */}
                <div
                  className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-base font-black text-white transition-all duration-500"
                  style={{
                    borderColor: step >= i ? '#a855f7' : '#2d1b4e',
                    background: step >= i ? 'rgba(168,85,247,.12)' : '#0f0a1a',
                    boxShadow: step >= i ? NEON : 'none',
                    opacity: step >= i ? 1 : 0.3,
                    transform: step >= i ? 'scale(1)' : 'scale(0.85)',
                  }}
                >
                  {s}
                </div>
                {/* Linha entre círculos */}
                {i < timeline.length - 1 && (
                  <div className="relative mx-2 h-[2px] flex-1 overflow-hidden bg-[#1a1030]">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-[380ms] ease-in-out"
                      style={{
                        width: step > i ? '100%' : '0%',
                        background: `linear-gradient(to right, ${NEON_LINE}, #7e22ce)`,
                        boxShadow: '0 0 6px #a855f7',
                        transitionDelay: step > i ? '0ms' : '0ms',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Textos abaixo */}
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
                <h3 className="mb-1.5 text-[14px] font-black leading-tight text-white">{title}</h3>
                <p className="text-[12.5px] leading-relaxed text-white/50">{text}</p>
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
              style={{ opacity: step >= i ? 1 : 0.15, transform: step >= i ? 'translateX(0)' : 'translateX(-12px)' }}
            >
              <div className="flex flex-col items-center">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black text-white"
                  style={{
                    borderColor: step >= i ? '#a855f7' : '#2d1b4e',
                    background: step >= i ? 'rgba(168,85,247,.12)' : '#0f0a1a',
                    boxShadow: step >= i ? NEON : 'none',
                  }}
                >
                  {s}
                </div>
                {i < timeline.length - 1 && (
                  <div className="my-1 w-[2px] flex-1 bg-[#1a1030]">
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
                <h3 className="mb-1 text-[15px] font-black text-white">{title}</h3>
                <p className="text-[13px] leading-relaxed text-white/50">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState(1)
  const carouselRef = useRef(null)
  const navigate = useNavigate()

  const visibleCourses = useMemo(() => {
    const match = FILTERS[activeFilter]?.match
    if (!match) return allCourses
    return allCourses.filter((c) => c.tag.startsWith(match))
  }, [activeFilter])

  const scrollCarousel = (dir) => {
    carouselRef.current?.scrollBy({ left: dir * 380, behavior: 'smooth' })
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
          <div className="mb-8 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f, i) => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  if (i === 0) { navigate('/catalogo-cursos') } else { setActiveFilter(i) }
                }}
                className={`shrink-0 whitespace-nowrap rounded-full border px-5 py-2 text-sm font-bold transition ${
                  activeFilter === i
                    ? 'border-[#6f35b5] bg-[#6f35b5] text-white shadow-md'
                    : 'border-[#ddd6fe] bg-white text-[#6f35b5] hover:border-[#6f35b5] hover:bg-[#faf5ff]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Carrossel com seta sobreposta */}
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
              {visibleCourses.map((course) => (
                <Link
                  key={course.title}
                  to="/catalogo-cursos"
                  className="group relative h-[380px] w-[340px] shrink-0 overflow-hidden rounded-2xl bg-[#1a0a2e] text-white shadow-[0_8px_28px_rgba(17,24,39,.14)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(111,53,181,.22)]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <img
                    src={course.image} alt={course.title}
                    className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/80" />

                  {/* Tags topo */}
                  <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#f3e8ff]/90 px-3 py-1 text-xs font-black text-[#4f1f87] backdrop-blur-sm">
                      {course.tag}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black backdrop-blur-sm ${
                      course.status === 'Em andamento'
                        ? 'bg-green-400/90 text-green-950'
                        : 'bg-amber-300/90 text-amber-900'
                    }`}>
                      {course.status}
                    </span>
                  </div>

                  {/* Conteúdo base */}
                  <div className="absolute bottom-5 left-5 right-14 z-10">
                    <small className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/60">
                      {course.workload}
                    </small>
                    <h3 className="text-base font-black uppercase leading-snug">{course.title}</h3>
                  </div>
                  <span className="absolute bottom-5 right-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-[#6f35b5] shadow-md transition group-hover:bg-[#6f35b5] group-hover:text-white">
                    <ArrowRight size={17} />
                  </span>
                </Link>
              ))}
            </div>

            {/* Seta direita sobreposta (estilo da referência) */}
            <button
              onClick={() => scrollCarousel(1)}
              className="absolute -right-4 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,.15)] text-[#6f35b5] transition hover:bg-[#6f35b5] hover:text-white"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* ── Fluxo ── */}
        <FluxoTimeline />

        {/* ── AVA ── */}
        <section className="mx-auto max-w-[1180px] px-[22px] py-14">
          <div className="grid items-center gap-8 overflow-hidden rounded-2xl border border-[rgba(20,131,95,.2)] bg-gradient-to-br from-[#ecfff5] to-[#f0fdf6] p-8 shadow-[0_12px_32px_rgba(20,131,95,.10)] md:grid-cols-[1fr_0.9fr]">
            <div>
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[#dff8eb] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#14835f]">
                <CheckCircle size={12} /> Ambiente virtual
              </span>
              <h2 className="mb-3 text-[32px] font-black leading-tight tracking-tight">
                Acesse o <span className="text-[#14835f]">AVA RIEH/PB</span>
              </h2>
              <p className="text-[16px] leading-relaxed text-[#374151]">
                O <strong className="text-[#14835f]">AVA</strong> é o ambiente virtual onde ficam as aulas,
                materiais, atividades e acompanhamento dos cursos do Transforma Educação 2026.
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-[#374151]">
                Após concluir sua inscrição e validar o CPF, entre por meio da sua conta <strong className="text-[#14835f]">gov.br</strong>.
              </p>
              <div className="mt-7">
                <a
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#14835f] px-7 py-3 text-[15px] font-black text-white shadow-md transition hover:bg-[#0f6d4f] hover:-translate-y-0.5"
                  href={avaUrl} target="_blank" rel="noreferrer"
                >
                  Acessar AVA RIEH/PB <ArrowRight size={16} />
                </a>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl shadow-[0_10px_28px_rgba(20,131,95,.14)]">
              <img src={avaImage} alt="Ambiente Virtual de Aprendizagem RIEH PB" className="h-full min-h-[260px] w-full object-cover" />
            </div>
          </div>
        </section>

        {/* ── CTA + Video ── */}
        <section className="bg-gradient-to-r from-[#3b1d7a] via-[#6f35b5] to-[#a855f7]">
          <div className="mx-auto grid max-w-[1240px] items-center gap-10 px-[22px] py-16 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white/80 ring-1 ring-white/25">
                Formacao continuada
              </span>
              <h2 className="mb-4 text-[40px] font-black uppercase leading-tight text-white tracking-tight">
                Transforme<br />sua prática
              </h2>
              <p className="text-[17px] leading-relaxed text-white/80">
                Participe de formações alinhadas à realidade da rede com intenção, método e resultado.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-7 py-3 text-[15px] font-black text-[#6f35b5] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  to="/catalogo-cursos"
                >
                  Acessar cursos
                </Link>
                <a
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/50 bg-white/15 px-7 py-3 text-[15px] font-black text-white backdrop-blur-sm transition hover:bg-white/25 hover:-translate-y-0.5"
                  href={avaUrl} target="_blank" rel="noreferrer"
                >
                  Entrar no AVA
                </a>
              </div>
            </div>
            <div className="aspect-video overflow-hidden rounded-2xl border border-white/20 shadow-[0_16px_48px_rgba(0,0,0,.35)]">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/K7sHZjRxk9g?rel=0&modestbranding=1&playsinline=1"
                title="Video Transforma Educacao"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
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
