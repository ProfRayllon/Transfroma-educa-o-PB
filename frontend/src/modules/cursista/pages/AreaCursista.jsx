import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BookOpen, CalendarCheck, CheckCircle, KeyRound,
  LogOut, MapPin, UserCog,
} from 'lucide-react'
import { useCursista } from '../CursistaContext'
import cursistaApi, { getCursistaErrorMessage } from '../api'

export default function AreaCursista() {
  const { cursista, encerrar } = useCursista()
  const navigate = useNavigate()

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

  const sair = () => {
    encerrar()
    navigate('/area-do-cursista/entrar', { replace: true })
  }

  if (!cursista) return null

  const primeiroNome = String(cursista.name || '').split(' ')[0]

  return (
    <div className="min-h-screen bg-[#f4f6fa]">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-black text-[#1c1033] truncate">Olá, {primeiroNome}</h1>
            <p className="text-xs text-gray-500">Transforma Educação PB — Área do Cursista</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/area-do-cursista/cadastro" className="btn-secondary text-xs py-2">
              <UserCog size={13} />
              Meus dados
            </Link>
            <Link to="/area-do-cursista/senha" className="btn-secondary text-xs py-2">
              <KeyRound size={13} />
              Alterar senha
            </Link>
            <button onClick={sair} className="btn-secondary text-xs py-2">
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {aviso && (
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border ${
            aviso.tipo === 'erro'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {aviso.tipo === 'erro' ? <AlertTriangle size={16} className="mt-0.5" /> : <CheckCircle size={16} className="mt-0.5" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        <section className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Cursos com inscrição aberta</h2>
          <p className="text-xs text-gray-500 mb-4">Você pode se inscrever em quantos cursos quiser.</p>

          {carregando ? (
            <p className="text-sm text-gray-400 py-4">Carregando...</p>
          ) : cursos.length === 0 ? (
            <div className="text-center py-8">
              <CalendarCheck size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhum curso com inscrição aberta no momento.</p>
              <p className="text-xs text-gray-400 mt-1">Assim que as inscrições abrirem, os cursos aparecem aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cursos.map((curso) => (
                <div key={curso.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 flex flex-col gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">{curso.primaryTrail}</div>
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight mt-0.5">{curso.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{curso.trail}</p>
                  </div>
                  {curso.inscrito ? (
                    <div className="flex items-center gap-2 mt-auto">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle size={12} /> Inscrito
                      </span>
                      <button
                        onClick={() => cancelar(curso)}
                        disabled={processando === curso.id}
                        className="text-xs text-gray-500 hover:text-red-600 transition-colors disabled:opacity-40"
                      >
                        Cancelar inscrição
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => inscrever(curso)}
                      disabled={processando === curso.id}
                      className="btn-primary text-xs py-2 justify-center mt-auto disabled:opacity-50"
                    >
                      {processando === curso.id ? 'Inscrevendo...' : 'Inscrever-se'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Minhas inscrições</h2>

          {inscricoes.atuais.length === 0 ? (
            <p className="text-sm text-gray-400">Você ainda não se inscreveu em nenhum curso desta edição.</p>
          ) : (
            <ul className="space-y-2">
              {inscricoes.atuais.map((inscricao) => (
                <li key={inscricao.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                  <BookOpen size={15} className="text-brand-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{inscricao.courseName}</div>
                    <div className="text-[11px] text-gray-400">{inscricao.trail}</div>
                  </div>
                  <span className="text-xs text-gray-500 flex-shrink-0">{inscricao.edition}</span>
                </li>
              ))}
            </ul>
          )}

          {inscricoes.concluidos.length > 0 && (
            <div className="border-t border-gray-100 mt-5 pt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Cursos concluídos no programa</h3>
              <p className="text-xs text-gray-500 mb-3">Seu histórico no Transforma Educação PB.</p>
              <ul className="space-y-2">
                {inscricoes.concluidos.map((inscricao) => (
                  <li key={`c-${inscricao.id}`} className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                    <CheckCircle size={15} className="text-green-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-800 truncate">{inscricao.courseName}</div>
                      <div className="text-[11px] text-gray-500">Edição {inscricao.edition}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {cursista.vinculos?.length > 0 && (
          <section className="card">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {cursista.vinculos.length > 1 ? 'Suas escolas' : 'Sua escola'}
            </h2>
            <ul className="space-y-2">
              {cursista.vinculos.map((vinculo) => (
                <li key={vinculo.ordem} className="flex items-start gap-2.5 text-sm">
                  <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-gray-800">{vinculo.escola}</div>
                    <div className="text-[11px] text-gray-500">{vinculo.gre}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
