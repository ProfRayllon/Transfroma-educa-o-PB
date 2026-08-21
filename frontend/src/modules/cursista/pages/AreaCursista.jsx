import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, BookOpen, CalendarCheck, CheckCircle, Clock,
  GraduationCap, MapPin, UserCog,
} from 'lucide-react'
import { useCursista } from '../CursistaContext'
import cursistaApi, { getCursistaErrorMessage } from '../api'
import PublicNav from '../../../components/public/PublicNav'
import PublicFooter from '../../../components/public/PublicFooter'

function Cartao({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-[#ded6ea] bg-white p-6 shadow-[0_6px_20px_rgba(42,24,70,.06)] ${className}`}>
      {children}
    </section>
  )
}

function TituloSecao({ children, descricao }) {
  return (
    <div className="mb-5">
      <h2 className="text-[19px] font-black leading-tight text-[#1c1033]">{children}</h2>
      {descricao && <p className="mt-1 text-sm text-[#566176]">{descricao}</p>}
    </div>
  )
}

export default function AreaCursista() {
  const { cursista } = useCursista()

  const [cursos, setCursos] = useState([])
  const [inscricoes, setInscricoes] = useState({ atuais: [], concluidos: [] })
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [processando, setProcessando] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const [abertos, minhas] = await Promise.all([
        cursistaApi.get('/cursos-abertos'),
        cursistaApi.get('/minhas-inscricoes'),
      ])
      setCursos(abertos.data)
      setInscricoes(minhas.data)
    } catch (error) {
      // 428 (cadastro pendente) e tratado pelo guard de rota, nao vira aviso aqui.
      if (error.response?.status !== 428) {
        setAviso({ tipo: 'erro', texto: getCursistaErrorMessage(error, 'Erro ao carregar seus cursos.') })
      }
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const mostrar = (tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 4000)
  }

  const inscrever = async (curso) => {
    setProcessando(curso.id)
    try {
      await cursistaApi.post('/inscricoes', { courseId: curso.id })
      await carregar()
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
      await carregar()
      mostrar('ok', 'Inscrição cancelada.')
    } catch (error) {
      mostrar('erro', getCursistaErrorMessage(error, 'Não foi possível cancelar a inscrição.'))
    } finally {
      setProcessando(null)
    }
  }

  if (!cursista) return null

  const primeiroNome = String(cursista.name || '').split(' ')[0]
  const totalInscrito = inscricoes.atuais.length

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f5fb]">
      <PublicNav />

      <main className="flex-1">
        {/* Faixa de boas-vindas na identidade do site, no lugar do cabecalho
            cinza de painel que a area tinha antes. */}
        <section className="relative overflow-hidden bg-[#3b1d7a] px-[22px] py-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,.28)_0%,_transparent_60%)]" />
          <div className="relative mx-auto flex max-w-[1000px] flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-purple-200 ring-1 ring-white/20">
                Área do Cursista
              </span>
              <h1 className="text-[36px] font-black leading-tight text-white">Olá, {primeiroNome}</h1>
              <p className="mt-1.5 text-[16px] text-white/70">
                {totalInscrito === 0
                  ? 'Você ainda não se inscreveu em nenhum curso desta edição.'
                  : `Você está inscrito em ${totalInscrito} ${totalInscrito === 1 ? 'curso' : 'cursos'} nesta edição.`}
              </p>
            </div>
            <Link
              to="/area-do-cursista/cadastro"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/40 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/25 md:self-auto"
            >
              <UserCog size={16} /> Meus dados
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-[1000px] space-y-5 px-[22px] py-10">
          {aviso && (
            <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
              aviso.tipo === 'erro'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-green-200 bg-green-50 text-green-700'
            }`}>
              {aviso.tipo === 'erro' ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{aviso.texto}</span>
            </div>
          )}

          <Cartao>
            <TituloSecao descricao="Você pode se inscrever em quantos cursos quiser.">
              Cursos com inscrição aberta
            </TituloSecao>

            {carregando ? (
              <p className="py-6 text-sm text-[#9070c8]">Carregando...</p>
            ) : cursos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#ddd6fe] py-10 text-center">
                <CalendarCheck size={30} className="mx-auto mb-3 text-[#c4b5fd]" />
                <p className="text-[15px] font-bold text-[#1c1033]">Nenhum curso com inscrição aberta no momento.</p>
                <p className="mt-1 text-sm text-[#566176]">Assim que as inscrições abrirem, os cursos aparecem aqui.</p>
                <Link to="/catalogo-cursos" className="mt-4 inline-block text-sm font-black text-[#6f35b5] hover:underline">
                  Ver o catálogo completo →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {cursos.map((curso) => (
                  <div
                    key={curso.id}
                    className={`flex flex-col gap-3 rounded-xl border p-5 transition ${
                      curso.inscrito
                        ? 'border-green-200 bg-green-50/50'
                        : 'border-[#e9e3f4] bg-[#faf8fd] hover:border-[#c4b5fd]'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#9070c8]">{curso.primaryTrail}</div>
                      <h3 className="mt-1 text-[15px] font-black leading-snug text-[#1c1033]">{curso.name}</h3>
                      <p className="mt-1 text-[13px] text-[#566176]">{curso.trail}</p>
                      {curso.totalSessions > 0 && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#7c6a9c]">
                          <Clock size={12} /> {curso.totalSessions} encontros
                        </p>
                      )}
                    </div>

                    {curso.inscrito ? (
                      <div className="mt-auto flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-white px-3 py-1.5 text-xs font-black text-green-700">
                          <CheckCircle size={13} /> Inscrito
                        </span>
                        <button
                          onClick={() => cancelar(curso)}
                          disabled={processando === curso.id}
                          className="text-xs font-medium text-[#7c6a9c] transition-colors hover:text-red-600 disabled:opacity-40"
                        >
                          Cancelar inscrição
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => inscrever(curso)}
                        disabled={processando === curso.id}
                        className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-50"
                      >
                        <GraduationCap size={15} />
                        {processando === curso.id ? 'Inscrevendo...' : 'Inscrever-se'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Cartao>

          <Cartao>
            <TituloSecao>Minhas inscrições</TituloSecao>

            {inscricoes.atuais.length === 0 ? (
              <p className="text-sm text-[#566176]">Você ainda não se inscreveu em nenhum curso desta edição.</p>
            ) : (
              <ul className="space-y-2.5">
                {inscricoes.atuais.map((inscricao) => (
                  <li key={inscricao.id} className="flex items-center gap-3 rounded-xl border border-[#e9e3f4] bg-[#faf8fd] px-4 py-3">
                    <BookOpen size={16} className="flex-shrink-0 text-[#6f35b5]" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-[#1c1033]">{inscricao.courseName}</div>
                      <div className="text-[12px] text-[#7c6a9c]">{inscricao.trail}</div>
                    </div>
                    <span className="flex-shrink-0 text-xs font-bold text-[#9070c8]">{inscricao.edition}</span>
                  </li>
                ))}
              </ul>
            )}

            {inscricoes.concluidos.length > 0 && (
              <div className="mt-6 border-t border-[#ede9f6] pt-5">
                <TituloSecao descricao="Seu histórico no Transforma Educação PB.">
                  Cursos concluídos
                </TituloSecao>
                <ul className="space-y-2.5">
                  {inscricoes.concluidos.map((inscricao) => (
                    <li key={`c-${inscricao.id}`} className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                      <CheckCircle size={16} className="flex-shrink-0 text-green-600" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-[#1c1033]">{inscricao.courseName}</div>
                        <div className="text-[12px] text-[#566176]">Edição {inscricao.edition}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Cartao>

          {cursista.vinculos?.length > 0 && (
            <Cartao>
              <TituloSecao>
                {cursista.vinculos.length > 1 ? 'Suas escolas' : 'Sua escola'}
              </TituloSecao>
              <ul className="space-y-3">
                {cursista.vinculos.map((vinculo) => (
                  <li key={vinculo.ordem} className="flex items-start gap-3">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0 text-[#9070c8]" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#1c1033]">{vinculo.escola}</div>
                      <div className="text-[12px] text-[#7c6a9c]">{vinculo.gre}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
