import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Clock, Filter, Search, Users } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import Modal from '../components/ui/Modal'

const formUrl = 'https://forms.gle/uYrVTURKxzq6mcRV6'

const courses = [
  {
    id: 'google-education',
    title: 'Google for Education',
    category: 'Tecnologia',
    trail: 'Educacao, Ciencia e Tecnologia',
    workload: '20h',
    audience: 'Professores e equipes escolares',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem3.png',
    summary: 'Ferramentas digitais para organizacao de aulas, colaboracao e acompanhamento pedagogico.',
  },
  {
    id: 'antes-que-aconteca',
    title: 'Antes que aconteca nas Escolas',
    category: 'Socioemocional',
    trail: 'Educacao Socioemocional',
    workload: '30h',
    audience: 'Professores, coordenadores e supervisores',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/imagem2.png',
    summary: 'Acoes preventivas, escuta ativa e estrategias de convivencia para o cotidiano escolar.',
  },
  {
    id: 'legislacao-educacional',
    title: 'Legislacao Educacional da Pratica Docente',
    category: 'Gestao',
    trail: 'Gestao Pedagogica',
    workload: '20h',
    audience: 'Gestores, coordenadores e professores',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/5dce049ea7ccef0def199569ab3a1c8281e71a91/img3.png',
    summary: 'Fundamentos legais aplicados a rotina pedagogica, registros e organizacao da escola.',
  },
  {
    id: 'bncc-linguagens',
    title: 'BNCC Linguagens em pratica',
    category: 'BNCC',
    trail: 'Area de Linguagens',
    workload: '24h',
    audience: 'Professores da formacao geral basica',
    image: 'https://raw.githubusercontent.com/ProfRayllon/Icones/efc03a67d01be90d82306db6287440b4e74cedb0/capa_2.png',
    summary: 'Planejamento, habilidades e experiencias didaticas alinhadas a BNCC.',
  },
]

const categories = ['Todos', 'Tecnologia', 'Socioemocional', 'Gestao', 'BNCC']

export default function PublicCourses() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todos')
  const [selectedCourse, setSelectedCourse] = useState(null)

  const filteredCourses = useMemo(() => {
    const term = query.trim().toLowerCase()
    return courses.filter((course) => {
      const matchesCategory = category === 'Todos' || course.category === category
      const matchesSearch = !term || [course.title, course.trail, course.summary, course.category]
        .join(' ')
        .toLowerCase()
        .includes(term)
      return matchesCategory && matchesSearch
    })
  }, [category, query])

  return (
    <div className="min-h-screen bg-[#f7f2fb] text-slate-900">
      <PublicNav />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-fuchsia-800 px-5 py-16 text-white lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(190,242,100,0.16),transparent_28%)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-black uppercase tracking-[0.28em] text-lime-200">
                Catalogo publico
              </p>
              <h1 className="text-4xl font-black md:text-6xl">Cursos do Transforma Educacao PB</h1>
              <p className="mt-5 text-lg leading-8 text-white/75">
                Consulte as formacoes disponiveis, filtre por trilha e acesse as orientacoes de inscricao.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
          <div className="-mt-16 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-brand-900/15 backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.22em] text-brand-800">
              <Filter size={17} />
              Filtros
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 font-semibold text-slate-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  placeholder="Buscar por curso, trilha ou tema..."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`rounded-full px-4 py-3 text-sm font-bold transition ${
                      category === item
                        ? 'bg-brand-800 text-white shadow-lg shadow-brand-900/20'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-brand-950">Cursos encontrados</h2>
              <p className="text-sm font-semibold text-slate-500">{filteredCourses.length} curso(s) no catalogo</p>
            </div>
            <a
              href={formUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full bg-gradient-to-r from-brand-900 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-900/20 transition hover:-translate-y-0.5 md:inline-flex"
            >
              Realizar inscricao
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <article key={course.id} className="group overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-brand-900/10 transition hover:-translate-y-2 hover:shadow-2xl">
                <div className="relative h-52 overflow-hidden">
                  <img src={course.image} alt={course.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-800">
                    {course.category}
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">{course.trail}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{course.title}</h3>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">{course.summary}</p>
                  <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock size={17} className="text-brand-700" />
                      {course.workload}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={17} className="text-brand-700" />
                      {course.audience}
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(course)}
                      className="flex-1 rounded-full border border-brand-200 px-4 py-3 text-sm font-bold text-brand-800 transition hover:bg-brand-50"
                    >
                      Detalhes
                    </button>
                    <a
                      href={formUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-900"
                    >
                      Inscrever
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!filteredCourses.length && (
            <div className="rounded-[2rem] bg-white p-12 text-center shadow-xl shadow-brand-900/10">
              <BookOpen className="mx-auto text-brand-300" size={44} />
              <p className="mt-4 font-bold text-slate-700">Nenhum curso encontrado com esses filtros.</p>
            </div>
          )}
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
            <a href={formUrl} target="_blank" rel="noreferrer" className="btn-primary">
              Inscrever-se
            </a>
          </>
        )}
      >
        {selectedCourse && (
          <div className="space-y-5">
            <img src={selectedCourse.image} alt={selectedCourse.title} className="h-56 w-full rounded-2xl object-cover" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-700">{selectedCourse.trail}</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">{selectedCourse.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{selectedCourse.summary}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Carga horaria</p>
                <p className="mt-1 font-black text-slate-900">{selectedCourse.workload}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Publico</p>
                <p className="mt-1 font-black text-slate-900">{selectedCourse.audience}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
