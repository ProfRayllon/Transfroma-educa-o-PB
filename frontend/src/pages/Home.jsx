import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'

const heroImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/efc03a67d01be90d82306db6287440b4e74cedb0/capa_2.png'
const avaImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/a90f659919f7eb1ad854a73093d5798c65f90f85/ava.png'
const statsImage = 'https://raw.githubusercontent.com/ProfRayllon/Icones/8c0a3d4af0517958cbc7e040b37f1d8300c810f3/img.5.png'
const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const courses = [
  {
    title: 'Google for Education',
    tag: 'Trilha Institucional',
    workload: '20h',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem3.png',
  },
  {
    title: 'Antes que aconteca nas Escolas',
    tag: 'Trilha Institucional',
    workload: '20h',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem2.png',
  },
  {
    title: 'Legislacao Educacional na pratica docente',
    tag: 'Trilha Institucional',
    workload: '20h',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/img3.png',
  },
]

const timeline = [
  ['1', 'Realizacao da inscricao', 'Realize a inscricao inicial no formulario do Programa de Formacao.'],
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

function CountUp({ value, prefix = '', suffix = '', label }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    let rafId
    const start = performance.now()
    const duration = 800

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setCurrent(Math.round(value * progress))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value])

  return (
    <div className="rounded-lg border border-[#ded6ea] bg-gradient-to-b from-white to-[#fbf7ff] p-6 shadow-[0_10px_24px_rgba(42,24,70,.06)]">
      <span className="block text-[38px] font-black leading-none text-[#6f35b5]">{prefix}{current}{suffix}</span>
      <p className="mt-3 text-[15px] font-extrabold leading-snug text-[#111827]">{label}</p>
    </div>
  )
}

export default function Home() {
  const filters = useMemo(() => [
    'Todos',
    'Trilha Institucional',
    'Educacao Socioemocional',
    'Educacao, Ciencia e Tecnologia',
    'Gestao Pedagogica',
    'Educacao Inclusiva, Equidade e Diversidade',
    'BNCC',
  ], [])

  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <PublicNav />

      <main>
        <section className="relative min-h-[470px] overflow-hidden bg-[#4f1f87] text-white">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[rgba(32,17,54,.08)] to-[rgba(32,17,54,.5)]" />
          <div className="relative z-10 mx-auto flex min-h-[470px] max-w-[1180px] items-end px-[22px] py-[54px]">
            <div className="mb-14 flex flex-wrap gap-3 md:ml-[140px]">
              <a className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-white px-6 py-3 text-[15px] font-black text-[#6f35b5] transition hover:-translate-y-0.5" href={formUrl} target="_blank" rel="noreferrer">
                Realizacao da inscricao
              </a>
              <Link className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-white/70 bg-[#6f35b5]/75 px-6 py-3 text-[15px] font-black text-white backdrop-blur transition hover:-translate-y-0.5" to="/catalogo-cursos">
                Ver cursos
              </Link>
              <a className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-white/70 bg-[#6f35b5]/75 px-6 py-3 text-[15px] font-black text-white backdrop-blur transition hover:-translate-y-0.5" href="https://drive.google.com/drive/folders/1vZPmyZyxj5mmMBFlSwrVJKQYVAfGRHHK" target="_blank" rel="noreferrer">
                Guias Transforma
              </a>
            </div>
          </div>
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            <span className="h-2.5 w-2.5 rounded-full border border-white bg-white" />
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-[22px] py-[42px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div>
              <h2 className="mb-3 text-[34px] font-black leading-tight">Transforma Educacao PB</h2>
              <p className="max-w-3xl text-[17px] leading-relaxed text-[#566176]">
                Explore trilhas formativas estruturadas para fortalecer a pratica pedagogica e elevar a
                qualidade da educacao na Paraiba.
              </p>
              <p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-[#566176]">
                Encontre cursos organizados por area e trilha para apoiar sua pratica em sala de aula.
              </p>
            </div>
            <Link to="/catalogo-cursos" className="inline-flex items-center gap-2 whitespace-nowrap font-black text-[#6f35b5] hover:underline">
              Ver mais cursos
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="my-7 flex flex-wrap gap-3">
            {filters.map((filter, index) => (
              <button
                key={filter}
                type="button"
                className={`rounded-full border-[1.5px] border-[#a77bdf] px-5 py-2.5 font-black text-[#6f35b5] ${index === 0 ? 'bg-[#f4edff]' : 'bg-white'}`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="grid gap-[18px] md:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.title}
                to="/catalogo-cursos"
                className="group relative min-h-[360px] overflow-hidden rounded-lg bg-[#21122f] text-white shadow-[0_10px_24px_rgba(17,24,39,.12)]"
              >
                <img src={course.image} alt={course.title} className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/80" />
                <div className="absolute left-3.5 top-3.5 z-10 flex flex-wrap gap-2">
                  <div className="rounded-full bg-[#f0d8ff] px-2.5 py-1 text-xs font-black text-[#4f1f87]">{course.tag}</div>
                  <div className="rounded-full bg-[#f0d8ff] px-2.5 py-1 text-xs font-black text-[#4f1f87]">{course.workload}</div>
                </div>
                <div className="absolute bottom-5 left-5 right-14 z-10">
                  <small className="mb-1 block text-[#f2eafe]">Curso</small>
                  <h3 className="text-lg font-black uppercase leading-tight">{course.title}</h3>
                </div>
                <span className="absolute bottom-5 right-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-[#6f35b5]">
                  <ArrowRight size={17} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-[22px] py-[42px]">
          <h2 className="mb-3 text-[32px] font-black leading-tight">Fluxo de acesso aos cursos</h2>
          <p className="text-base leading-relaxed text-[#566176]">O acesso aos cursos do Transforma Educacao PB 2026 ocorrera em etapas sequenciais.</p>
          <div className="relative mt-7 grid gap-3.5 md:grid-cols-3 lg:grid-cols-6">
            <div className="absolute left-[7%] right-[7%] top-7 hidden h-[3px] bg-[#dbc7f4] lg:block" />
            {timeline.map(([step, title, text]) => (
              <article key={step} className="relative z-10 rounded-lg border border-[#ded6ea] bg-white px-3.5 pb-4 pt-14 shadow-[0_10px_24px_rgba(42,24,70,.06)]">
                <span className="absolute left-3.5 top-3 grid h-8 w-8 place-items-center rounded-full bg-[#6f35b5] font-black text-white">{step}</span>
                <h3 className="mb-2 text-[15px] font-black leading-tight">{title}</h3>
                <p className="text-[13px] leading-relaxed text-[#566176]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-[22px] pb-[42px] pt-5">
          <div className="grid items-center gap-8 rounded-lg border border-[rgba(20,131,95,.24)] bg-gradient-to-br from-[#ecfff5] to-[#f7fffb] p-7 shadow-[0_12px_28px_rgba(20,131,95,.10)] md:grid-cols-[1fr_0.9fr]">
            <div>
              <span className="mb-3 inline-flex rounded-full bg-[#dff8eb] px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-[#14835f]">Ambiente virtual</span>
              <h2 className="mb-3 text-[32px] font-black leading-tight">Acesse o <span className="text-[#14835f]">AVA RIEH/PB</span></h2>
              <p className="text-base leading-relaxed text-[#566176]">
                O <strong className="text-[#14835f]">AVA</strong> e o ambiente virtual onde ficam as aulas,
                materiais, atividades e acompanhamento dos cursos do Transforma Educacao 2026.
              </p>
              <p className="mt-2 text-base leading-relaxed text-[#566176]">
                Apos concluir sua inscricao e validar o CPF, entre no <strong className="text-[#14835f]">AVA</strong>
                por meio da sua conta gov.br para iniciar o curso.
              </p>
              <div className="mt-6">
                <a className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-[#14835f] px-6 py-3 text-[15px] font-black text-white transition hover:bg-[#0f6d4f]" href={avaUrl} target="_blank" rel="noreferrer">
                  Acessar AVA RIEH/PB
                </a>
              </div>
            </div>
            <div className="min-h-[260px] overflow-hidden rounded-lg bg-[#dff8eb] shadow-[0_10px_24px_rgba(20,131,95,.12)]">
              <img src={avaImage} alt="Ambiente Virtual de Aprendizagem RIEH PB" className="h-full min-h-[260px] w-full object-cover" />
            </div>
          </div>
        </section>

        <section className="mt-10 bg-gradient-to-r from-[#6f35b5] via-[#8b5cf6] to-[#c14aa0] text-white">
          <div className="mx-auto grid max-w-[1240px] items-center gap-9 px-[22px] py-14 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="mb-4 text-[40px] font-black uppercase leading-tight">Transforme sua pratica</h2>
              <p className="text-[17px] leading-relaxed text-[#f8f4ff]">
                Participe de formacoes alinhadas a realidade da rede com intencao, metodo e resultado.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-white px-6 py-3 text-[15px] font-black text-[#6f35b5]" to="/catalogo-cursos">
                  Acessar cursos
                </Link>
                <a className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-white/70 bg-[#6f35b5]/70 px-6 py-3 text-[15px] font-black text-white" href={avaUrl} target="_blank" rel="noreferrer">
                  Entrar no AVA
                </a>
              </div>
            </div>
            <div className="aspect-video overflow-hidden rounded-lg border border-white/20 bg-[#25163a]">
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

        <section className="mx-auto max-w-[1180px] px-[22px] py-[42px]">
          <h2 className="mb-5 text-[32px] font-black leading-tight">Resultados esperados</h2>
          <div className="grid items-stretch gap-6 md:grid-cols-[0.8fr_1.2fr]">
            <div className="min-h-[310px] overflow-hidden rounded-[14px] shadow-[0_10px_24px_rgba(42,24,70,.06)]">
              <img src={statsImage} alt="Resultados esperados do Transforma Educacao" className="h-full w-full object-cover" />
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
