import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Layers3,
  Play,
  Sparkles,
  Users,
} from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const heroImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/efc03a67d01be90d82306db6287440b4e74cedb0/capa_2.png'
const avaImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/a90f659919f7eb1ad854a73093d5798c65f90f85/ava.png'
const statsImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/8c0a3d4af0517958cbc7e040b37f1d8300c810f3/img.5.png'
const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'

const courses = [
  {
    title: 'Google for Education',
    tag: 'Tecnologia educacional',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem3.png',
    text: 'Praticas digitais para organizar aulas, colaborar e acompanhar a aprendizagem com ferramentas Google.',
  },
  {
    title: 'Antes que aconteca nas Escolas',
    tag: 'Cuidado e convivencia',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem2.png',
    text: 'Formacao para fortalecer a escuta, prevenir violencias e apoiar a convivencia escolar.',
  },
  {
    title: 'Legislacao Educacional',
    tag: 'Gestao pedagogica',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/img3.png',
    text: 'Base legal aplicada ao cotidiano da escola e aos processos pedagogicos da rede.',
  },
]

const timeline = [
  ['1', 'Escolha o curso', 'Consulte trilhas, objetivos e carga horaria antes da inscricao.'],
  ['2', 'Realize a inscricao', 'Use o formulario oficial e acompanhe os comunicados da formacao.'],
  ['3', 'Acesse o AVA', 'Entre no ambiente virtual para assistir aulas e realizar atividades.'],
  ['4', 'Conclua a trilha', 'Finalize as atividades e acompanhe a evolucao da sua formacao.'],
]

function CountUp({ value, suffix = '', label, icon: Icon }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    let rafId
    const start = performance.now()
    const duration = 900
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setCurrent(Math.round(value * progress))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value])

  return (
    <div className="rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl shadow-brand-900/10 backdrop-blur">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-800">
        <Icon size={24} />
      </div>
      <p className="text-4xl font-black text-brand-950">{current}{suffix}</p>
      <p className="mt-1 text-sm font-semibold text-slate-600">{label}</p>
    </div>
  )
}

export default function Home() {
  const stats = useMemo(() => [
    { value: 7, suffix: '+', label: 'trilhas formativas', icon: Layers3 },
    { value: 1200, suffix: '+', label: 'participantes previstos', icon: Users },
    { value: 2026, suffix: '', label: 'ciclo formativo', icon: GraduationCap },
  ], [])

  return (
    <div className="min-h-screen bg-[#f7f2fb] text-slate-900">
      <PublicNav />

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(121,45,166,0.24),transparent_30%),radial-gradient(circle_at_85%_10%,rgba(22,163,74,0.18),transparent_25%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f7f2fb] to-transparent" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
            <div className="animate-fade-in">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-2 text-sm font-bold text-brand-800 shadow-sm">
                <Sparkles size={16} />
                Formacao Continuada BNCC 2026
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-brand-950 md:text-6xl">
                Programas de formacao para transformar praticas pedagogicas.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
                Uma experiencia publica, simples e visual para conhecer trilhas, consultar cursos e
                acessar o sistema administrativo do Transforma Educacao PB.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-900 to-fuchsia-600 px-6 py-3 font-bold text-white shadow-xl shadow-brand-900/25 transition hover:-translate-y-1"
                >
                  Realizar inscricao
                  <ExternalLink size={18} />
                </a>
                <Link
                  to="/catalogo-cursos"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-200 bg-white px-6 py-3 font-bold text-brand-900 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  Ver cursos
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-lime-300/50 blur-3xl" />
              <div className="absolute -bottom-10 right-0 h-40 w-40 rounded-full bg-fuchsia-400/40 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white p-3 shadow-2xl shadow-brand-900/20">
                <img
                  src={heroImage}
                  alt="Transforma Educacao PB"
                  className="h-[360px] w-full rounded-[1.5rem] object-cover md:h-[470px]"
                />
                <div className="absolute bottom-8 left-8 right-8 rounded-3xl bg-white/90 p-5 shadow-xl backdrop-blur">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-700">Cursos abertos</p>
                  <p className="mt-2 text-2xl font-black text-brand-950">Trilhas transversais e BNCC</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-700">Cursos em destaque</p>
              <h2 className="mt-3 text-3xl font-black text-brand-950 md:text-4xl">Conheca as formacoes</h2>
            </div>
            <Link to="/catalogo-cursos" className="inline-flex items-center gap-2 font-bold text-brand-800 hover:text-brand-950">
              Abrir catalogo completo
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {courses.map((course, index) => (
              <article
                key={course.title}
                className="group overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-xl shadow-brand-900/10 transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img src={course.image} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-800">
                    {course.tag}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-black text-slate-950">{course.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{course.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-br from-brand-950 via-brand-900 to-fuchsia-800 py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-lime-200">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">Fluxo simples para iniciar a formacao</h2>
              <p className="mt-5 text-white/75">
                A jornada publica orienta o participante desde a consulta do curso ate o acesso ao AVA.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {timeline.map(([step, title, text]) => (
                <div key={step} className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                  <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-lime-300 font-black text-brand-950">{step}</div>
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/75">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-2 lg:px-8">
          <div className="rounded-[2rem] bg-white p-4 shadow-2xl shadow-brand-900/10">
            <img src={avaImage} alt="Ambiente virtual de aprendizagem" className="w-full rounded-[1.5rem] object-cover" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-700">Ambiente virtual</p>
            <h2 className="mt-3 text-3xl font-black text-brand-950 md:text-4xl">Acesso aos cursos no AVA</h2>
            <p className="mt-5 text-lg leading-8 text-slate-700">
              A plataforma organiza materiais, atividades e acompanhamento para apoiar o desenvolvimento
              dos participantes ao longo de cada trilha.
            </p>
            <div className="mt-6 grid gap-3">
              {['Conteudos por trilha', 'Acompanhamento de progresso', 'Atividades e materiais centralizados'].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <CheckCircle2 className="text-green-600" size={20} />
                  <span className="font-semibold text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="grid overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-brand-900/10 md:grid-cols-[1fr_1.15fr]">
            <div className="bg-gradient-to-br from-brand-900 to-fuchsia-700 p-8 text-white md:p-10">
              <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                <Play size={26} />
              </div>
              <h2 className="text-3xl font-black">Veja a proposta do Transforma</h2>
              <p className="mt-4 leading-7 text-white/75">
                Um video curto para apresentar a experiencia de formacao e orientar os primeiros passos.
              </p>
            </div>
            <div className="aspect-video bg-slate-950">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/K7sHZjRxk9g?rel=0&modestbranding=1&playsinline=1"
                title="Video Transforma Educacao PB"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-[1fr_1.1fr] lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {stats.map((stat) => (
              <CountUp key={stat.label} {...stat} />
            ))}
          </div>
          <div className="relative">
            <img src={statsImage} alt="Indicadores do Transforma" className="w-full rounded-[2rem] shadow-2xl shadow-brand-900/10" />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
