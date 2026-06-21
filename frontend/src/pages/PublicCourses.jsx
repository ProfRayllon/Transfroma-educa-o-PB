import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import Modal from '../components/ui/Modal'

const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'
const avaUrl = 'https://pb.ava.rieh.nees.ufal.br/login/index.php'

const tabs = [
  {
    value: 'todos',
    label: 'Todos',
    icon: '/images/icons/todos.png',
  },
  {
    value: 'institucional',
    label: 'Trilha Institucional',
    icon: '/images/icons/trilha-institucional.png',
  },
  {
    value: 'socioemocional',
    label: 'Educacao Socioemocional',
    icon: '/images/icons/socioemocional.png',
  },
  {
    value: 'tecnologia',
    label: 'Educacao, Ciencia e Tecnologia',
    icon: '/images/icons/tecnologia.png',
  },
  {
    value: 'gestao',
    label: 'Gestao Pedagogica',
    icon: '/images/icons/gestao.png',
  },
  {
    value: 'inclusiva',
    label: 'Educacao Inclusiva',
    icon: '/images/icons/inclusiva.png',
  },
  {
    value: 'bncc',
    label: 'BNCC',
    icon: '/images/icons/bncc.png',
  },
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
    summary: 'Desenvolva competencias para integrar as ferramentas do Google for Education a pratica pedagogica, promovendo aulas mais dinamicas e organizadas.',
    details: [
      'Compreender o ecossistema Google for Education e suas possibilidades pedagogicas.',
      'Planejar atividades utilizando Google Classroom, Drive, Docs, Forms e outras ferramentas.',
      'Integrar recursos digitais aos processos de ensino, aprendizagem e avaliacao.',
    ],
  },
  {
    id: 'antes-que-aconteca',
    title: 'Antes que aconteca nas Escolas',
    category: 'institucional',
    categoryLabel: 'Trilha Institucional',
    workload: '20h',
    status: 'Em breve',
    image: '/images/courses/antes-escolas.png',
    summary: 'Desenvolva estrategias para identificar, prevenir e enfrentar a violencia contra as mulheres no contexto escolar.',
    details: ['Escuta qualificada.', 'Encaminhamentos adequados.', 'Promocao de uma cultura de protecao.'],
  },
  {
    id: 'legislacao-educacional',
    title: 'Legislacao Educacional da Pratica Docente',
    category: 'institucional',
    categoryLabel: 'Trilha Institucional',
    workload: '20h',
    status: 'Em breve',
    image: '/images/courses/legislacao-educacional.png',
    summary: 'Conheca os marcos legais que orientam a educacao e fortalecem a atuacao docente.',
    details: ['Direitos e deveres.', 'Diretrizes educacionais.', 'Aplicacao na pratica pedagogica.'],
  },
  {
    id: 'socioemocional',
    title: 'Educacao Socioemocional',
    category: 'socioemocional',
    categoryLabel: 'Educacao Socioemocional',
    workload: '20h',
    status: 'Em breve',
    image: '/images/home/curso-antes-escolas.png',
    summary: 'Praticas para fortalecer convivencia, cuidado, escuta e desenvolvimento integral.',
    details: ['Convivencia escolar.', 'Cuidado e escuta.', 'Desenvolvimento integral.'],
  },
  {
    id: 'bncc-linguagens',
    title: 'BNCC Linguagens',
    category: 'bncc',
    categoryLabel: 'BNCC',
    workload: '24h',
    status: 'Em breve',
    image: '/images/home/hero-capa.png',
    summary: 'Planejamento, habilidades e experiencias didaticas alinhadas a BNCC.',
    details: ['Habilidades BNCC.', 'Planejamento por area.', 'Experiencias de aprendizagem.'],
  },
]

export default function PublicCourses() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('todos')
  const [mode, setMode] = useState('Online')
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

      <main className="mx-auto max-w-[1240px] px-5 pt-10">
        <header className="mx-auto mb-12 text-center">
          <h1 className="m-0 text-[2.5em] font-bold uppercase leading-tight text-[#6b21a8]">Trilhas Formativas</h1>
          <p className="mt-4 text-[1.1em] leading-relaxed text-[#6b7280]">Portal direcionado aos cursistas da formacao Transforma Educacao - PB</p>
          <p className="text-[1.1em] leading-relaxed text-[#6b7280]">para consulta, escolha e inscricao nos cursos disponiveis</p>
          <div className="mx-auto mt-5 h-1 w-20 rounded bg-gradient-to-r from-[#8b5cf6] to-[#6f28b2]" />
        </header>

        <section className="grid items-start gap-6 pb-9 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-lg border border-[#e4d8f4] bg-[#fbf8ff] p-4">
            <p className="mb-3 font-black text-[#4f1f87]">Filtrar por trilha</p>
            <div className="grid gap-2.5">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter(tab.value)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-[1.5px] px-3.5 py-2.5 text-left text-sm font-black transition ${
                    filter === tab.value
                      ? 'border-[#6f35b5] bg-[#6f35b5] text-white'
                      : 'border-[#cdb7ea] bg-white text-[#4f1f87] hover:border-[#6f35b5] hover:bg-[#f7f0ff]'
                  }`}
                >
                  <img src={tab.icon} alt="" className="h-6 w-6 object-contain" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-[54px] w-full rounded-lg border-[1.5px] border-[#cdb7ea] bg-white px-5 text-base text-[#172033] outline-none transition placeholder:text-[#7a7286] focus:border-[#6f35b5] focus:ring-4 focus:ring-brand-100"
                placeholder="Digite o curso aqui"
                aria-label="Buscar curso"
              />
            </div>

            <div className="mb-7 flex flex-col gap-3 rounded-lg border border-[#e4d8f4] bg-[#fbf8ff] p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2.5">
                {['Online', 'AVA', '20h'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`min-w-[84px] rounded-lg border-[1.5px] px-4 py-2 text-sm font-black transition ${
                      mode === item
                        ? 'border-[#6f35b5] bg-[#6f35b5] text-white'
                        : 'border-[#cdb7ea] bg-white text-[#6f35b5] hover:bg-[#f7f0ff]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="whitespace-nowrap text-sm font-black text-[#4f1f87]">Ordenar: Mais relevantes</div>
            </div>

            <div className="grid gap-[18px] xl:grid-cols-2">
              {filteredCourses.map((course) => (
                <article key={course.id} className="flex min-h-[260px] overflow-hidden rounded-lg border border-[#d8d1e4] bg-white shadow-[0_6px_18px_rgba(47,28,73,.06)] transition hover:border-[#a77bdf] max-md:flex-col">
                  <div className="relative min-h-[260px] w-[132px] flex-none bg-[#f1edf8] max-md:h-48 max-md:w-full max-md:min-h-0">
                    <img src={course.image} alt={course.title} className="h-full w-full object-cover" />
                    <span className={`absolute right-3.5 top-3.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-black shadow-[0_8px_18px_rgba(23,32,51,.12)] ${course.available ? 'text-[#6f35b5]' : 'text-[#8a6a9e]'}`}>
                      {course.status}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-lg bg-[#f1e8ff] px-2.5 py-1 text-xs font-bold text-[#6f35b5]">{course.categoryLabel}</span>
                      <span className="rounded-lg bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#405168]">{course.workload}</span>
                    </div>
                    <h3 className="text-lg font-black leading-tight">{course.title}</h3>
                    <p className="text-[13px] leading-relaxed text-[#5d687a]">{course.summary}</p>
                    <div className="mt-auto flex flex-wrap gap-2.5 pt-1">
                      <button type="button" className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#a77bdf] bg-white px-3.5 py-1.5 text-xs font-black text-[#6f35b5]" onClick={() => setSelectedCourse(course)}>
                        Saber mais
                      </button>
                      {course.available ? (
                        <a className="inline-flex min-h-8 items-center justify-center rounded-full bg-[#6f35b5] px-3.5 py-1.5 text-xs font-black text-white" href={formUrl} target="_blank" rel="noreferrer">
                          Validar CPF e inscrever-se
                        </a>
                      ) : (
                        <button type="button" disabled className="inline-flex min-h-8 items-center justify-center rounded-full border border-[#d8d1e4] bg-slate-50 px-3.5 py-1.5 text-xs font-black text-slate-400">
                          Em breve
                        </button>
                      )}
                      <a className="inline-flex min-h-8 items-center justify-center rounded-full bg-[#14835f] px-3.5 py-1.5 text-xs font-black text-white" href={avaUrl} target="_blank" rel="noreferrer">
                        Acessar AVA
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {!filteredCourses.length && (
              <div className="rounded-lg border border-[#d8d1e4] bg-white p-12 text-center">
                <BookOpen className="mx-auto text-brand-300" size={44} />
                <p className="mt-4 font-bold text-slate-700">Nenhum curso encontrado com esses filtros.</p>
              </div>
            )}
          </div>
        </section>
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
                Validar CPF e inscrever-se
              </a>
            )}
          </>
        )}
      >
        {selectedCourse && (
          <div className="space-y-5">
            <div className="rounded-lg border border-[#e2d5f3] bg-white p-5">
              <h3 className="mb-2 text-2xl font-black leading-tight text-[#6f35b5]">{selectedCourse.title}</h3>
              <p className="leading-7 text-[#5d687a]">{selectedCourse.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#f1e8ff] px-3 py-1.5 text-xs font-black text-[#6f35b5]">{selectedCourse.categoryLabel}</span>
                <span className="rounded-full bg-[#f1e8ff] px-3 py-1.5 text-xs font-black text-[#6f35b5]">{selectedCourse.workload}</span>
              </div>
            </div>
            <div className="grid gap-3">
              {selectedCourse.details.map((item, index) => (
                <div key={item} className="grid grid-cols-[44px_1fr] items-center gap-3 rounded-lg border border-[#dde5ef] bg-white p-4 shadow-[0_8px_20px_rgba(47,28,73,.05)]">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#f1e8ff] font-black text-[#6f35b5]">{index + 1}</span>
                  <p className="font-bold text-[#172033]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
