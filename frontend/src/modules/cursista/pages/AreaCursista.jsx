import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Award, BookOpen, CalendarDays, CheckCircle, Clock, Loader2, ShieldCheck, UserCog, X } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import cursistaApi, { comBaseDeCertificados, getCursistaErrorMessage } from '../api'
import { duracaoCurso, nomeTrilha } from '../../../lib/curso'
import CapaCurso from '../../../components/public/CapaCurso'
import VisualizadorPdf from '../../../components/public/VisualizadorPdf'
import CursistaShell, { CartaoCursista as Cartao, TituloCartao as TituloSecao } from '../CursistaShell'

/**
 * Area do cursista: os cursos em que ele esta inscrito.
 *
 * A inscricao acontece no catalogo, que e onde estao todos os cursos com ementa
 * e capa -- por isso esta tela nao repete a lista de cursos abertos. Aqui fica
 * so o que e dele, com o caminho para o catalogo quando quiser se inscrever.
 */
const dataCurta = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR')
}

/** Botao redondo de acao do card, com o nome por extenso ao passar o mouse. */
function BotaoIcone({ titulo, onClick, disabled, destaque = false, perigo = false, children }) {
  const cor = disabled
    ? 'border-[#ede9f6] bg-[#faf8fd] text-[#cfc6e0] cursor-not-allowed'
    : destaque
      ? 'border-[#6f35b5] bg-[#6f35b5] text-white hover:bg-[#5a2b94] shadow-[0_6px_16px_rgba(111,53,181,.28)]'
      : perigo
        ? 'border-[#e9e3f4] bg-white text-[#7c6a9c] hover:border-red-200 hover:bg-red-50 hover:text-red-700'
        : 'border-[#e9e3f4] bg-white text-[#6f35b5] hover:bg-[#f3e8ff]'
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${cor}`}
    >
      {children}
    </button>
  )
}

/**
 * Card de ponta a ponta: capa a esquerda, os dados do curso no meio e as acoes
 * (certificado, cancelar) a direita. No celular a capa vai para cima.
 */
function CardCurso({ curso, certificado, abrindo, aoAbrirCertificado, rodape, acaoExtra }) {
  const duracao = duracaoCurso(curso)
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e9e3f4] bg-white shadow-[0_4px_14px_rgba(42,24,70,.05)] transition hover:shadow-[0_10px_26px_rgba(42,24,70,.09)] sm:flex-row">
      <div className="relative aspect-[16/9] w-full flex-shrink-0 overflow-hidden bg-[#f1edf8] sm:aspect-auto sm:min-h-[150px] sm:w-[200px] lg:w-[230px]">
        <div className="h-full w-full sm:absolute sm:inset-0">
          <CapaCurso curso={{ id: curso.courseId, hasImage: curso.hasImage, imageVersion: curso.imageVersion, trail: curso.trail }} />
        </div>
        {curso.selo}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#9070c8]">{nomeTrilha(curso.trail)}</div>
          <h3 className="mt-1 text-[17px] font-black leading-snug text-[#1c1033]">{curso.courseName}</h3>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[#566176]">
            {duracao && (
              <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-[#9070c8]" /> {duracao.texto}</span>
            )}
            {dataCurta(curso.enrolledAt) && (
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-[#9070c8]" /> Inscrição em {dataCurta(curso.enrolledAt)}</span>
            )}
            {certificado && (
              <span className="inline-flex items-center gap-1.5 font-bold text-[#15803d]"><ShieldCheck size={13} /> Certificado disponível</span>
            )}
          </div>
          {rodape && <div className="mt-2.5">{rodape}</div>}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {acaoExtra}
          <BotaoIcone
            titulo={certificado ? 'Ver e baixar o certificado' : 'Certificado ainda não disponível'}
            onClick={() => certificado && aoAbrirCertificado(certificado)}
            disabled={!certificado || abrindo}
            destaque={Boolean(certificado)}
          >
            {abrindo ? <Loader2 size={19} className="animate-spin" /> : <Award size={20} />}
          </BotaoIcone>
        </div>
      </div>
    </article>
  )
}

export default function AreaCursista() {
  const { cursista } = useCursista()

  const [inscricoes, setInscricoes] = useState({ atuais: [], concluidos: [] })
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [processando, setProcessando] = useState(null)
  const [certificados, setCertificados] = useState([])
  const [abrindo, setAbrindo] = useState(null)
  const [visualizando, setVisualizando] = useState(null)

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

  // Certificados em paralelo e sem travar a tela: se falhar, os cursos aparecem
  // do mesmo jeito, so sem o botao ativo.
  useEffect(() => {
    cursistaApi.get('/meus', comBaseDeCertificados)
      .then(({ data }) => setCertificados(Array.isArray(data) ? data : []))
      .catch(() => setCertificados([]))
  }, [])

  const fecharCertificado = useCallback(() => {
    setVisualizando((atual) => {
      if (atual?.url) URL.revokeObjectURL(atual.url)
      return null
    })
  }, [])

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
  const certificadoDoCurso = new Map(certificados.map((c) => [c.courseId, c]))
  const cursosNaLista = new Set(inscricoes.atuais.map((i) => i.courseId))
  // Certificado de curso que nao esta entre as inscricoes desta edicao (de outra
  // edicao, ou de quem concluiu sem inscricao no sistema) ganha seu proprio card.
  const certificadosAvulsos = certificados.filter((c) => !cursosNaLista.has(c.courseId))

  // O PDF e gerado no servidor a cada pedido; aqui so vira um endereco local
  // para o visualizador, desfeito ao fechar.
  const abrirCertificado = async (certificado) => {
    setAbrindo(certificado.id)
    try {
      const { data } = await cursistaApi.get(`/meus/${certificado.id}/pdf`, { ...comBaseDeCertificados, responseType: 'blob' })
      setVisualizando({
        url: URL.createObjectURL(data),
        titulo: `Certificado — ${certificado.curso}`,
        nomeArquivo: `certificado-${certificado.codigo}.pdf`,
      })
    } catch {
      mostrar('erro', 'Não foi possível gerar o certificado agora. Tente de novo em instantes.')
    } finally {
      setAbrindo(null)
    }
  }

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
            // Um curso por linha, de ponta a ponta: cabe a carga horaria, a data
            // da inscricao e as acoes sem apertar nada.
            <div className="space-y-4">
              {inscricoes.atuais.map((inscricao) => {
                const certificado = certificadoDoCurso.get(inscricao.courseId)
                return (
                  <CardCurso
                    key={inscricao.id}
                    curso={{
                      ...inscricao,
                      selo: (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-green-500/95 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-sm">
                          <CheckCircle size={11} /> Inscrito
                        </span>
                      ),
                    }}
                    certificado={certificado}
                    abrindo={Boolean(certificado) && abrindo === certificado.id}
                    aoAbrirCertificado={abrirCertificado}
                    rodape={
                      // Cancelar some quando o prazo passa: quem decide e o
                      // backend, e oferecer o que ele recusaria seria prometer
                      // algo que nao acontece.
                      inscricao.podeCancelar ? null : inscricao.obrigatoria ? (
                        <span className="text-[11.5px] font-bold text-[#6f35b5]">Curso obrigatório: inscrição automática.</span>
                      ) : (
                        <span className="text-[11.5px] text-[#9070c8]">O prazo de inscrição deste curso já encerrou.</span>
                      )
                    }
                    acaoExtra={inscricao.podeCancelar ? (
                      <BotaoIcone
                        titulo={processando === inscricao.id ? 'Cancelando...' : 'Cancelar inscrição'}
                        onClick={() => cancelar(inscricao)}
                        disabled={processando === inscricao.id}
                        perigo
                      >
                        <X size={18} />
                      </BotaoIcone>
                    ) : null}
                  />
                )
              })}
            </div>
          )}

          {certificadosAvulsos.length > 0 && (
            <div className="mt-8 border-t border-[#ede9f6] pt-6">
              <TituloSecao descricao="Certificados de cursos que você concluiu.">
                Meus certificados
              </TituloSecao>
              <div className="space-y-4">
                {certificadosAvulsos.map((c) => (
                  <CardCurso
                    key={`cert-${c.id}`}
                    curso={{
                      courseId: c.courseId,
                      courseName: c.curso,
                      trail: c.trail,
                      hasImage: c.hasImage,
                      imageVersion: c.imageVersion,
                      workloadHours: c.cargaHoraria,
                      selo: (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#6f35b5]/95 px-2.5 py-1 text-[11px] font-black text-white backdrop-blur-sm">
                          <Award size={11} /> Concluído
                        </span>
                      ),
                    }}
                    certificado={c}
                    abrindo={abrindo === c.id}
                    aoAbrirCertificado={abrirCertificado}
                  />
                ))}
              </div>
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

        <VisualizadorPdf
          arquivo={visualizando?.url}
          titulo={visualizando?.titulo}
          nomeArquivo={visualizando?.nomeArquivo}
          aoFechar={fecharCertificado}
        />
      </>
    </CursistaShell>
  )
}
