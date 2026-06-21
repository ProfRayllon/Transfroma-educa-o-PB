import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import Modal from '../components/ui/Modal'

const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'socioemocional', label: 'Socioemocional' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'gestao', label: 'Gestão' },
  { value: 'inclusiva', label: 'Inclusiva' },
  { value: 'bncc', label: 'BNCC' },
]

const courses = [
  {
    id: 'google-for-education-2026',
    title: 'Google for Education',
    category: 'institucional',
    categoryLabel: 'Trilha Institucional',
    workload: '20h',
    status: 'Liberado',
    available: true,
    image: '/images/courses/google-education.png',
    summary: 'Desenvolva competências para integrar as ferramentas do Google for Education à prática pedagógica, promovendo aulas mais dinâmicas e organizadas.',
    details: [
      'Compreender o ecossistema Google for Education e suas possibilidades pedagógicas.',
      'Planejar atividades utilizando Google Classroom, Drive, Docs, Forms e outras ferramentas.',
      'Integrar recursos digitais aos processos de ensino, aprendizagem e avaliação.',
    ],
  },
  {
    id: 'antes-que-aconteca',
    title: 'Antes que aconteça nas Escolas',
    category: 'institucional',
    categoryLabel: 'Trilha Institucional',
    workload: '20h',
    status: 'Em breve',
    image: '/images/courses/antes-escolas.png',
    summary: 'Desenvolva estratégias para identificar, prevenir e enfrentar a violência contra as mulheres no contexto escolar.',
    details: [
      'Escuta qualificada e acolhimento.',
      'Encaminhamentos adequados à rede de proteção.',
      'Promoção de uma cultura de proteção no ambiente escolar.',
    ],
  },
  {
    id: 'legislacao-educacional',
    title: 'Legislação Educacional na Prática Docente',
    category: 'institucional',
    categoryLabel: 'Trilha Institucional',
    workload: '20h',
    status: 'Em breve',
    image: '/images/courses/legislacao-educacional.png',
    summary: 'Conheça os marcos legais que orientam a educação e fortalecem a atuação docente na Paraíba.',
    details: [
      'Direitos e deveres dos profissionais da educação.',
      'Diretrizes educacionais nacionais e estaduais.',
      'Aplicação das normas legais na prática pedagógica.',
    ],
  },
]

export default function PublicCourses() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todos')
  const [selectedCourse, setSelectedCourse] = useState(null)

  const filteredCourses = useMemo(() => {
    const term = query.trim().toLowerCase()
    return courses.filter((course) => {
      const matchesFilter = filter === 'todos' || course.category === filter
      const matchesSearch = !term || [course.title, course.categoryLabel, course.summary]
        .join(' ')
        .toLowerCase()
        .includes(term)
      return matchesFilter && matchesSearch
    })
  }, [filter, query])

  return (
    <div className="min-h-screen bg-white text-[#172033]">
      <PublicNav />

      {/* ── Hero ── */}
      <section className="bg-[#4A238A] px-[22px] py-14">
        <div className="mx-auto max-w-[1180px]">
          <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-white/90 ring-1 ring-white/25">
            Formação 2026
          </span>
          <h1 className="text-[36px] font-black leading-tight text-white">Trilhas Formativas</h1>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-white/70">
            Portal direcionado aos cursistas da formação Transforma Educação PB para consulta, escolha e inscrição nos cursos disponíveis.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[1180px] px-[22px] py-10">
        {/* Busca */}
        <div className="mb-5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[50px] w-full rounded-xl border border-[#ddd6fe] bg-white px-5 text-base text-[#172033] outline-none transition placeholder:text-[#9ca3af] focus:border-[#6f35b5] focus:ring-2 focus:ring-[#6f35b5]/20"
            placeholder="Buscar curso..."
          />
        </div>

        {/* Filtros no topo */}
        <div className="mb-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-5 py-2 text-sm font-bold transition ${
                filter === f.value
                  ? 'border-[#6f35b5] bg-[#6f35b5] text-white shadow-md'
                  : 'border-[#ddd6fe] bg-white text-[#6f35b5] hover:border-[#6f35b5] hover:bg-[#faf5ff]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {filteredCourses.map((course) => (
            <article
              key={course.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[#e9d5ff] bg-white shadow-[0_4px_20px_rgba(111,53,181,.07)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(111,53,181,.14)]"
            >
              <div className="relative h-[200px] overflow-hidden bg-[#f1edf8]">
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.04]"
                />
                <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black backdrop-blur-sm ${
                  course.available
                    ? 'bg-green-400/90 text-green-950'
                    : 'bg-amber-300/90 text-amber-900'
                }`}>
                  {course.status}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                    {course.categoryLabel}
                  </span>
                  <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-black text-[#566176]">
                    {course.workload}
                  </span>
                </div>
                <h3 className="mb-2 text-[16px] font-black leading-snug text-[#1c1033]">{course.title}</h3>
                <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#566176]">{course.summary}</p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd6fe] px-4 py-2 text-xs font-black text-[#6f35b5] transition hover:border-[#6f35b5] hover:bg-[#faf5ff]"
                  >
                    Saber mais
                  </button>
                  {course.available ? (
                    <a
                      href={formUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#6f35b5] px-4 py-2 text-xs font-black text-white transition hover:bg-[#7e22ce]"
                    >
                      Inscrever-se <ArrowRight size={13} />
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-[#e9d5ff] bg-[#faf5ff] px-4 py-2 text-xs font-black text-[#c4a7e7]">
                      Em breve
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {!filteredCourses.length && (
          <div className="rounded-2xl border border-dashed border-[#ddd6fe] bg-[#faf5ff] p-16 text-center">
            <BookOpen className="mx-auto text-[#c4a7e7]" size={40} />
            <p className="mt-4 font-bold text-[#566176]">Nenhum curso disponível nesta trilha ainda.</p>
          </div>
        )}
      </main>

      <PublicFooter />

      <Modal
        open={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
        title="Detalhes do curso"
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setSelectedCourse(null)}>
              Fechar
            </button>
            {selectedCourse?.available && (
              <a href={formUrl} target="_blank" rel="noreferrer" className="btn-primary">
                Inscrever-se
              </a>
            )}
          </>
        )}
      >
        {selectedCourse && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#e9d5ff] bg-[#faf5ff] p-5">
              <h3 className="mb-2 text-xl font-black text-[#1c1033]">{selectedCourse.title}</h3>
              <p className="leading-7 text-[#566176]">{selectedCourse.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">{selectedCourse.categoryLabel}</span>
                <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">{selectedCourse.workload}</span>
              </div>
            </div>
            <div className="grid gap-3">
              {selectedCourse.details.map((item, i) => (
                <div key={item} className="flex items-start gap-4 rounded-xl border border-[#e9d5ff] bg-white p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f3e8ff] text-sm font-black text-[#6f35b5]">{i + 1}</span>
                  <p className="pt-1.5 text-sm font-bold text-[#1c1033]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
