import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const heroImage = '/images/home/hero-capa.png'
const avaImage = '/images/home/ava.png'
const statsImage = '/images/home/resultados.png'
const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const courses = [
  { title: 'Google for Education', tag: 'Trilha Institucional', workload: '20h', image: '/images/home/curso-google.png' },
  { title: 'Antes que aconteca nas Escolas', tag: 'Trilha Institucional', workload: '20h', image: '/images/home/curso-antes-escolas.png' },
  { title: 'Legislacao Educacional na pratica docente', tag: 'Trilha Institucional', workload: '20h', image: '/images/home/curso-legislacao.png' },
]

const timeline = [
  ['1', 'Inscricao', 'Realize a inscricao no formulario do Programa de Formacao.'],
  ['2', 'Acesso ao portal', 'Acesse o portal do Transforma Educacao PB, na area de cursos.'],
  ['3', 'Escolha do curso', 'Selecione o curso desejado e confira a trilha correspondente.'],
  ['4', 'Validacao do CPF', 'Informe o CPF para confirmar se sua inscricao foi localizada.'],
  ['5', 'Acesso ao AVA', 'Apos a validacao, acesse o Ambiente Virtual de Aprendizagem.'],
  ['6', 'Entrada gov.br', 'Entre no ambiente usando o sistema de autenticacao do gov.br.'],
]

const stats = [
  { value: 200, prefix: '+', suffix: 'h', label: 'de formacao' },
  { value: 100, suffix: '%', label: 'certificados emitidos para concluintes' },
  { value: 13000, prefix: '+', label: 'cursistas' },
  { value: 95, prefix: '+', suffix: '%', label: 'de satisfacao' },
]

const filters = [
  { label: 'Todos', icon: '/images/icons/todos.png' },
  { label: 'Trilha Institucional', icon: '/images/icons/trilha-institucional.png' },
  { label: 'Educacao Socioemocional', icon: '/images/icons/socioemocional.png' },
  { label: 'Educacao, Ciencia e Tecnologia', icon: '/images/icons/tecnologia.png' },
  { label: 'Gestao Pedagogica', icon: '/images/icons/gestao.png' },
  { label: 'Educacao Inclusiva, Equidade e Diversidade', icon: '/images/icons/inclusiva.png' },
  { label: 'BNCC', icon: '/images/icons/bncc.png' },
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

export default function Home() {
  const [activeFilter, setActiveFilter] = useState(0)

  const visibleCourses = useMemo(() => {
    if (activeFilter === 0) return courses
    return courses.filter((c) => c.tag === filters[activeFilter].label)
  }, [activeFilter])

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <PublicNav />

      <main>
        {/* ── Hero ── */}
        <section className="relative min-h-[540px] overflow-hidden bg-[#3b1d7a]">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3b1d7a]/30 via-transparent to-[#1a0733]/65" />

          <div className="relative z-10 mx-auto flex min-h-[540px] max-w-[1180px] flex-col justify-end px-[22px] pb-14 md:justify-center md:pb-0">
            <div className="flex flex-wrap gap-3 md:ml-[120px]">
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 py-3 text-[15px] font-black text-[#6f35b5] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                href={formUrl} target="_blank" rel="noreferrer"
              >
                Realizacao da inscricao
              </a>
              <Link
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/60 bg-white/15 px-6 py-3 text-[15px] font-black text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/25"
                to="/catalogo-cursos"
              >
                Ver cursos <ArrowRight size={16} />
              </Link>
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/60 bg-white/15 px-6 py-3 text-[15px] font-black text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/25"
                href="https://drive.google.com/drive/folders/1vZPmyZyxj5mmMBFlSwrVJKQYVAfGRHHK" target="_blank" rel="noreferrer"
              >
                Guias Transforma
              </a>
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            <span className="h-2 w-2 rounded-full bg-white/60" />
          </div>
        </section>

        {/* ── Cursos ── */}
        <section className="mx-auto max-w-[1180px] px-[22px] py-14">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <span className="mb-2 inline-block rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
                Formacao 2026
              </span>
              <h2 className="text-[34px] font-black leading-tight tracking-tight">Transforma Educacao PB</h2>
              <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-[#566176]">
                Trilhas formativas para fortalecer a pratica pedagogica e elevar a qualidade da educacao na Paraiba.
              </p>
            </div>
            <Link to="/catalogo-cursos" className="inline-flex shrink-0 items-center gap-2 font-black text-[#6f35b5] hover:underline">
              Ver todos os cursos <ArrowRight size={16} />
            </Link>
          </div>

          {/* Filtros com ícones */}
          <div className="mb-8 flex flex-wrap gap-2.5">
            {filters.map((filter, i) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => setActiveFilter(i)}
                className={`flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-black transition ${
                  activeFilter === i
                    ? 'border-[#6f35b5] bg-[#6f35b5] text-white shadow-md'
                    : 'border-[#c4a7e7] bg-white text-[#6f35b5] hover:border-[#6f35b5] hover:bg-[#faf5ff]'
                }`}
              >
                <img src={filter.icon} alt="" className="h-4 w-4 object-contain" />
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {(visibleCourses.length > 0 ? visibleCourses : courses).map((course) => (
              <Link
                key={course.title}
                to="/catalogo-cursos"
                className="group relative min-h-[380px] overflow-hidden rounded-2xl bg-[#1a0a2e] text-white shadow-[0_8px_28px_rgba(17,24,39,.16)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(111,53,181,.25)]"
              >
                <img
                  src={course.image} alt={course.title}
                  className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/85" />
                <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#f3e8ff]/90 px-3 py-1 text-xs font-black text-[#4f1f87] backdrop-blur-sm">{course.tag}</span>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black text-white backdrop-blur-sm">{course.workload}</span>
                </div>
                <div className="absolute bottom-5 left-5 right-14 z-10">
                  <small className="mb-1 block text-xs text-[#e9d5ff]">Curso</small>
                  <h3 className="text-base font-black uppercase leading-snug">{course.title}</h3>
                </div>
                <span className="absolute bottom-5 right-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-[#6f35b5] shadow-md transition group-hover:bg-[#6f35b5] group-hover:text-white">
                  <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Fluxo ── */}
        <section className="bg-[#faf5ff]">
          <div className="mx-auto max-w-[1180px] px-[22px] py-14">
            <span className="mb-2 inline-block rounded-full bg-[#ede9fe] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#6f35b5]">
              Passo a passo
            </span>
            <h2 className="mb-2 text-[32px] font-black leading-tight tracking-tight">Fluxo de acesso aos cursos</h2>
            <p className="mb-9 text-base leading-relaxed text-[#566176]">
              O acesso aos cursos do Transforma Educacao PB 2026 ocorre em etapas sequenciais.
            </p>
            <div className="relative grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="absolute left-[7%] right-[7%] top-6 hidden h-[2px] bg-gradient-to-r from-[#c4a7e7] to-[#dbc7f4] lg:block" />
              {timeline.map(([step, title, text]) => (
                <article key={step} className="relative z-10 rounded-2xl border border-[#e9d5ff] bg-white px-4 pb-5 pt-14 shadow-[0_4px_16px_rgba(111,53,181,.07)] transition hover:shadow-[0_8px_24px_rgba(111,53,181,.14)] hover:-translate-y-0.5">
                  <span className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#6f35b5] to-[#9333ea] font-black text-white shadow-md text-sm">
                    {step}
                  </span>
                  <h3 className="mb-2 text-[14px] font-black leading-tight">{title}</h3>
                  <p className="text-[12.5px] leading-relaxed text-[#566176]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

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
                O <strong className="text-[#14835f]">AVA</strong> e o ambiente virtual onde ficam as aulas,
                materiais, atividades e acompanhamento dos cursos do Transforma Educacao 2026.
              </p>
              <p className="mt-3 text-[16px] leading-relaxed text-[#374151]">
                Apos concluir sua inscricao e validar o CPF, entre por meio da sua conta <strong className="text-[#14835f]">gov.br</strong>.
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
                Transforme<br />sua pratica
              </h2>
              <p className="text-[17px] leading-relaxed text-white/80">
                Participe de formacoes alinhadas a realidade da rede com intencao, metodo e resultado.
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
            Numeros
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
