import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle, Clock, UserCog, X } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import cursistaApi, { getCursistaErrorMessage } from '../api'
import { duracaoCurso, nomeTrilha } from '../../../lib/curso'
import CapaCurso from '../../../components/public/CapaCurso'
import CursistaShell, { CartaoCursista as Cartao, TituloCartao as TituloSecao } from '../CursistaShell'

/**
 * Area do cursista: os cursos em que ele esta inscrito.
 *
 * A inscricao acontece no catalogo, que e onde estao todos os cursos com ementa
 * e capa -- por isso esta tela nao repete a lista de cursos abertos. Aqui fica
 * so o que e dele, com o caminho para o catalogo quando quiser se inscrever.
 */
export default function AreaCursista() {
  const { cursista } = useCursista()

  const [inscricoes, setInscricoes] = useState({ atuais: [], concluidos: [] })
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [processando, setProcessando] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await cursistaApi.get('/minhas-inscricoes')
      setInscricoes(data)
    } catch (error) {
      // 428 (cadastro pendente) e tratado pelo guard de rota, nao vira aviso aqui.
      if (error.response?.status !== 428) {
        setAviso({ tipo: 'erro', texto: getCursistaErrorMessage(error, 'Erro ao carregar os seus cursos.') })
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

  const cancelar = async (inscricao) => {
    setProcessando(inscricao.id)
    try {
      await cursistaApi.delete(`/inscricoes/${inscricao.courseId}`)
      await carregar()
      mostrar('ok', `Inscrição em "${inscricao.courseName}" cancelada.`)
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
    <CursistaShell
      badge="Área do Cursista"
      titulo={`Olá, ${primeiroNome}`}
      descricao={
        totalInscrito === 0
          ? 'Você ainda não se inscreveu em nenhum curso desta edição.'
          : `Você está inscrito em ${totalInscrito} ${totalInscrito === 1 ? 'curso' : 'cursos'} nesta edição.`
      }
      acao={(
        <Link
          to="/area-do-cursista/cadastro"
          className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          <UserCog size={16} /> Meus dados
        </Link>
      )}
    >
      <>
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
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-black leading-tight text-[#1c1033]">Meus cursos</h2>
              <p className="mt-1 text-sm text-[#566176]">Os cursos em que você se inscreveu nesta edição.</p>
            </div>
            {/* A inscricao acontece no catalogo; sem este caminho a tela nao
                teria como levar a pessoa a se inscrever. */}
            <Link
              to="/catalogo-cursos"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6f35b5] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#5a2b94]"
            >
              Ver cursos disponíveis <ArrowRight size={15} />
            </Link>
          </div>

          {carregando ? (
            <p className="py-6 text-sm text-[#9070c8]">Carregando...</p>
          ) : inscricoes.atuais.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#ddd6fe] py-12 text-center">
              <BookOpen size={30} className="mx-auto mb-3 text-[#c4b5fd]" />
              <p className="text-[15px] font-bold text-[#1c1033]">Você ainda não se inscreveu em nenhum curso.</p>
              <p className="mt-1 text-sm text-[#566176]">
                Veja no catálogo os cursos com inscrição aberta e escolha quantos quiser.
              </p>
              <Link to="/catalogo-cursos" className="mt-4 inline-block text-sm font-black text-[#6f35b5] hover:underline">
                Ir para o catálogo →
              </Link>
            </div>
          ) : (
            // Tres por linha, card na vertical: a capa em cima e o texto abaixo
            // deixa os cursos comparaveis de relance.
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {inscricoes.atuais.map((inscricao) => (
                <article
                  key={inscricao.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-[#e9e3f4] bg-white shadow-[0_4px_14px_rgba(42,24,70,.05)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#f1edf8]">
                    <CapaCurso curso={{
                      id: inscricao.courseId,
                      hasImage: inscricao.hasImage,
                      imageVersion: inscricao.imageVersion,
                      trail: inscricao.trail,
                    }} />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500/95 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-sm">
                      <CheckCircle size={11} /> Inscrito
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#9070c8]">
                      {nomeTrilha(inscricao.trail)}
                    </div>
                    <h3 className="mt-1 text-[15px] font-black leading-snug text-[#1c1033]">
                      {inscricao.courseName}
                    </h3>
                    {duracaoCurso(inscricao) && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-[#7c6a9c]">
                        <Clock size={12} /> {duracaoCurso(inscricao).texto}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      {/* O botao some quando o prazo passa: quem decide e o
                          backend, e oferecer aqui o que ele recusaria seria
                          prometer algo que nao acontece. */}
                      {inscricao.podeCancelar ? (
                        <button
                          onClick={() => cancelar(inscricao)}
                          disabled={processando === inscricao.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e9e3f4] px-3 py-2 text-xs font-bold text-[#7c6a9c] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                        >
                          <X size={13} />
                          {processando === inscricao.id ? 'Cancelando...' : 'Cancelar inscrição'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#9070c8]">
                          O prazo de inscrição deste curso já encerrou.
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {inscricoes.concluidos.length > 0 && (
            <div className="mt-8 border-t border-[#ede9f6] pt-6">
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
      </>
    </CursistaShell>
  )
}
