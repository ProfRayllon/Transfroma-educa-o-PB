import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle, Clock, GraduationCap, LogIn, X } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import Modal from '../components/ui/Modal'
import CapaCurso from '../components/public/CapaCurso'
import { duracaoCurso, nomeTrilha, quandoInscricao } from '../lib/curso'
import publicApi from '../lib/publicApi'
import { useCursista } from '../modules/cursista/CursistaContext'
import cursistaApi, { getCursistaErrorMessage } from '../modules/cursista/api'

const AREA_CURSISTA = '/area-do-cursista'

const SITUACOES = {
  aberto: { texto: 'Inscrições abertas', classe: 'bg-green-400/90 text-green-950' },
  em_breve: { texto: 'Em breve', classe: 'bg-amber-300/90 text-amber-900' },
  encerrado: { texto: 'Inscrições encerradas', classe: 'bg-slate-300/90 text-slate-800' },
  fechado: { texto: 'Em breve', classe: 'bg-amber-300/90 text-amber-900' },
}

export default function PublicCourses() {
  const { cursista, cadastroPendente } = useCursista()

  const [cursos, setCursos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [selecionado, setSelecionado] = useState(null)

  const [inscritoEm, setInscritoEm] = useState(new Set())
  const [processando, setProcessando] = useState(null)
  const [aviso, setAviso] = useState(null)

  // So vale buscar inscricoes de quem ja passou pelos dois portoes do backend;
  // antes disso a rota responde 428 e nao ha inscricao para listar.
  const podeInscrever = Boolean(cursista) && !cadastroPendente

  const carregarCursos = useCallback(async () => {
    try {
      const { data } = await publicApi.get('/publico/cursos')
      setCursos(data)
    } catch {
      setErro('Não foi possível carregar os cursos agora. Tente novamente em instantes.')
    } finally {
      setCarregando(false)
    }
  }, [])

  const carregarInscricoes = useCallback(async () => {
    if (!podeInscrever) { setInscritoEm(new Set()); return }
    try {
      const { data } = await cursistaApi.get('/minhas-inscricoes')
      setInscritoEm(new Set((data.atuais || []).map((i) => i.courseId)))
    } catch {
      // Catalogo e pagina de leitura: falhar aqui nao pode quebrar a listagem.
      setInscritoEm(new Set())
    }
  }, [podeInscrever])

  useEffect(() => { carregarCursos() }, [carregarCursos])
  useEffect(() => { carregarInscricoes() }, [carregarInscricoes])

  const mostrar = (tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 4000)
  }

  const inscrever = async (curso) => {
    setProcessando(curso.id)
    try {
      await cursistaApi.post('/inscricoes', { courseId: curso.id })
      await carregarInscricoes()
      mostrar('ok', `Inscrição confirmada em "${curso.name}".`)
    } catch (error) {
      mostrar('erro', getCursistaErrorMessage(error, 'Não foi possível concluir a inscrição.'))
    } finally {
      setProcessando(null)
    }
  }

  const cancelar = async (curso) => {
    setProcessando(curso.id)
    try {
      await cursistaApi.delete(`/inscricoes/${curso.id}`)
      await carregarInscricoes()
      mostrar('ok', `Inscrição em "${curso.name}" cancelada.`)
    } catch (error) {
      mostrar('erro', getCursistaErrorMessage(error, 'Não foi possível cancelar a inscrição.'))
    } finally {
      setProcessando(null)
    }
  }

  const trilhas = useMemo(() => {
    const vistas = new Map()
    cursos.forEach((curso) => {
      if (curso.trail && !vistas.has(curso.trail)) vistas.set(curso.trail, nomeTrilha(curso.trail))
    })
    return [...vistas.entries()]
  }, [cursos])

  const visiveis = useMemo(() => {
    const termo = query.trim().toLowerCase()
    return cursos.filter((curso) => {
      const passaFiltro = filtro === 'todos' || curso.trail === filtro
      const passaBusca = !termo || [curso.name, nomeTrilha(curso.trail), curso.resumo || '']
        .join(' ').toLowerCase().includes(termo)
      return passaFiltro && passaBusca
    })
  }, [cursos, filtro, query])

  /** Botao de acao do card, que muda com a situacao do curso e a sessao. */
  function AcaoCurso({ curso, tamanho = 'card' }) {
    const classeBase = tamanho === 'card'
      ? 'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition'
      : 'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition'

    if (curso.situacao !== 'aberto') {
      return (
        <span className={`${classeBase} border border-[#e9d5ff] bg-[#faf5ff] text-[#c4a7e7]`}>
          {SITUACOES[curso.situacao]?.texto || 'Indisponível'}
        </span>
      )
    }

    if (!cursista) {
      return (
        <Link to={AREA_CURSISTA} className={`${classeBase} bg-[#6f35b5] text-white hover:bg-[#5a2b94]`}>
          <LogIn size={tamanho === 'card' ? 13 : 15} /> Entrar para se inscrever
        </Link>
      )
    }

    if (cadastroPendente) {
      return (
        <Link to={`${AREA_CURSISTA}/cadastro`} className={`${classeBase} bg-amber-500 text-white hover:bg-amber-600`}>
          Complete seu cadastro
        </Link>
      )
    }

    // Inscrito: o selo confirma e o botao ao lado desfaz. Enquanto a janela
    // estiver aberta a pessoa pode mudar de ideia sem sair do catalogo.
    if (inscritoEm.has(curso.id)) {
      return (
        <>
          <span className={`${classeBase} border border-green-200 bg-green-50 text-green-700`}>
            <CheckCircle size={tamanho === 'card' ? 13 : 15} /> Inscrito
          </span>
          <button
            type="button"
            onClick={() => cancelar(curso)}
            disabled={processando === curso.id}
            className={`${classeBase} border border-[#e9d5ff] text-[#7c6a9c] hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40`}
          >
            <X size={tamanho === 'card' ? 13 : 15} />
            {processando === curso.id ? 'Cancelando...' : 'Cancelar'}
          </button>
        </>
      )
    }

    return (
      <button
        type="button"
        onClick={() => inscrever(curso)}
        disabled={processando === curso.id}
        className={`${classeBase} bg-[#6f35b5] text-white hover:bg-[#5a2b94] disabled:opacity-50`}
      >
        <GraduationCap size={tamanho === 'card' ? 13 : 15} />
        {processando === curso.id ? 'Inscrevendo...' : 'Inscrever-se'}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-white text-[#172033]">
      <PublicNav />

      <section className="bg-[#4A238A] px-[22px] py-14">
        <div className="mx-auto max-w-[1180px]">
          <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-white/90 ring-1 ring-white/25">
            Formação 2026
          </span>
          <h1 className="text-[36px] font-black leading-tight text-white">Trilhas Formativas</h1>
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-white/70">
            Consulte os cursos do Transforma Educação PB, veja as ementas e inscreva-se nos que estiverem com inscrição aberta.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-[1180px] px-[22px] py-10">
        {aviso && (
          <div className={`mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === 'erro'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {aviso.tipo === 'erro' ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        <div className="mb-5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[50px] w-full rounded-xl border border-[#ddd6fe] bg-white px-5 text-base text-[#172033] outline-none transition placeholder:text-[#9ca3af] focus:border-[#6f35b5] focus:ring-2 focus:ring-[#6f35b5]/20"
            placeholder="Buscar curso..."
          />
        </div>

        {trilhas.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {[['todos', 'Todos'], ...trilhas].map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                className={`rounded-full border px-5 py-2 text-sm font-bold transition ${
                  filtro === valor
                    ? 'border-[#6f35b5] bg-[#6f35b5] text-white shadow-md'
                    : 'border-[#ddd6fe] bg-white text-[#6f35b5] hover:border-[#6f35b5] hover:bg-[#faf5ff]'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {carregando ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[560px] animate-pulse rounded-2xl border border-[#e9d5ff] bg-[#faf5ff]" />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-dashed border-[#ddd6fe] bg-[#faf5ff] p-16 text-center">
            <AlertTriangle className="mx-auto text-[#c4a7e7]" size={40} />
            <p className="mt-4 font-bold text-[#566176]">{erro}</p>
          </div>
        ) : (
          <>
            {/* Tres colunas, e nao quatro: com 4 o card ficava estreito demais e
                a capa quadrada nao cabia sem perder metade da arte. */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visiveis.map((curso) => {
                const situacao = SITUACOES[curso.situacao] || SITUACOES.fechado
                return (
                  <article
                    key={curso.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#e9d5ff] bg-white shadow-[0_4px_20px_rgba(111,53,181,.07)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(111,53,181,.14)]"
                  >
                    <div className="relative aspect-square overflow-hidden bg-[#f1edf8]">
                      <CapaCurso curso={curso} />
                      <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black backdrop-blur-sm ${situacao.classe}`}>
                        {situacao.texto}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                          {nomeTrilha(curso.trail)}
                        </span>
                        {duracaoCurso(curso) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-black text-[#566176]">
                            <Clock size={11} /> {duracaoCurso(curso).texto}
                          </span>
                        )}
                      </div>
                      <h3 className="mb-2 text-[16px] font-black leading-snug text-[#1c1033]">{curso.name}</h3>
                      {quandoInscricao(curso) && (
                        <p className="mb-2 text-[12px] font-bold text-[#6f35b5]">{quandoInscricao(curso)}</p>
                      )}
                      <p className="mb-4 flex-1 text-[13px] leading-relaxed text-[#566176]">
                        {curso.resumo
                          ? `${curso.resumo.slice(0, 170)}${curso.resumo.length > 170 ? '...' : ''}`
                          : 'A ementa deste curso será publicada em breve.'}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelecionado(curso)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd6fe] px-4 py-2 text-xs font-black text-[#6f35b5] transition hover:border-[#6f35b5] hover:bg-[#faf5ff]"
                        >
                          Saber mais
                        </button>
                        <AcaoCurso curso={curso} />
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {!visiveis.length && (
              <div className="rounded-2xl border border-dashed border-[#ddd6fe] bg-[#faf5ff] p-16 text-center">
                <BookOpen className="mx-auto text-[#c4a7e7]" size={40} />
                <p className="mt-4 font-bold text-[#566176]">
                  {cursos.length ? 'Nenhum curso encontrado com esses filtros.' : 'Nenhum curso publicado ainda.'}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      <PublicFooter />

      <Modal
        open={Boolean(selecionado)}
        onClose={() => setSelecionado(null)}
        title="Detalhes do curso"
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setSelecionado(null)}>
              Fechar
            </button>
            {selecionado && <AcaoCurso curso={selecionado} tamanho="modal" />}
          </>
        )}
      >
        {selecionado && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#e9d5ff] bg-[#faf5ff] p-5">
              <h3 className="mb-2 text-xl font-black text-[#1c1033]">{selecionado.name}</h3>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                  {nomeTrilha(selecionado.trail)}
                </span>
                {/* No detalhe cabem os dois: a carga horaria e o que interessa
                    a quem se inscreve, e os encontros dizem como ela se
                    distribui. Nos cards fica so a carga, por espaco. */}
                {Number(selecionado.workloadHours) > 0 && (
                  <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                    {selecionado.workloadHours} horas
                  </span>
                )}
                {selecionado.totalSessions > 0 && (
                  <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                    {selecionado.totalSessions} {selecionado.totalSessions === 1 ? 'encontro' : 'encontros'}
                  </span>
                )}
                <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-[#6f35b5]">
                  {SITUACOES[selecionado.situacao]?.texto || 'Em breve'}
                </span>
              </div>
              {quandoInscricao(selecionado) && (
                <p className="mt-3 text-sm font-bold text-[#6f35b5]">{quandoInscricao(selecionado)}</p>
              )}
            </div>

            {/* So a contextualizacao: a ementa inteira em abas ficou densa
                demais para quem esta so decidindo se o curso interessa. */}
            <div className="rounded-xl border border-[#e9d5ff] bg-white p-5">
              <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#a855f7]">
                Contextualização
              </h4>
              {selecionado.resumo ? (
                // `whitespace-pre-line` mantem as quebras que o professor
                // digitou, em vez de emendar tudo num paragrafo so.
                <p className="whitespace-pre-line leading-7 text-[#566176]">{selecionado.resumo}</p>
              ) : (
                <p className="leading-7 text-[#9070c8]">
                  A ementa deste curso ainda está em elaboração e será publicada assim que for validada pela coordenação.
                </p>
              )}
            </div>

            {selecionado.situacao === 'aberto' && !cursista && (
              <div className="flex items-start gap-3 rounded-xl border border-[#ddd6fe] bg-[#faf5ff] p-4">
                <ArrowRight size={16} className="mt-0.5 flex-shrink-0 text-[#6f35b5]" />
                <p className="text-sm text-[#566176]">
                  Para se inscrever, entre na <strong className="text-[#1c1033]">Área do Cursista</strong> com o seu CPF.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
