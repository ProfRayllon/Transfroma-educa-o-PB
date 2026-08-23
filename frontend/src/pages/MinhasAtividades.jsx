import { useCallback, useEffect, useState } from 'react'
import {
  Check, CheckCircle, XCircle, Clock, Undo2, ListChecks, ClipboardCheck, MessageSquare,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import api, { getApiErrorMessage } from '../lib/api'
import {
  ROTULOS_PERFIL, mesAtual, rotuloMes, dataBr, iniciais, avisoDePrazo, CLASSES_AVISO_PRAZO,
  corDaFrequencia,
} from '../lib/atribuicoes'

/* ─── Barra de resumo do mes ─── */

function ResumoDoMes({ resumo }) {
  const cor = corDaFrequencia(resumo.frequencia)

  return (
    <div className="card">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {resumo.cumpridas}<span className="text-gray-300 font-semibold"> de </span>{resumo.total}
          </div>
          <p className="text-sm text-gray-500 mt-1.5">
            {resumo.total === 0
              ? 'Nenhuma atividade atribuída neste mês.'
              : `atividade${resumo.total !== 1 ? 's' : ''} cumprida${resumo.cumpridas !== 1 ? 's' : ''} neste mês`}
          </p>
        </div>
        {resumo.total > 0 && (
          <div className={`text-3xl font-bold leading-none ${cor.texto}`}>{resumo.frequencia}%</div>
        )}
      </div>

      {resumo.total > 0 && (
        <>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-4">
            <div className={`h-full rounded-full transition-all ${cor.barra}`} style={{ width: `${resumo.frequencia}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mt-3">
            {resumo.aFazer > 0 && <span><b className="text-gray-700">{resumo.aFazer}</b> a fazer</span>}
            {resumo.aguardando > 0 && <span><b className="text-gray-700">{resumo.aguardando}</b> aguardando avaliação</span>}
            {resumo.naoCumpridas > 0 && <span><b className="text-red-600">{resumo.naoCumpridas}</b> não cumprida{resumo.naoCumpridas !== 1 ? 's' : ''}</span>}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Um item da minha lista ─── */

/**
 * Cada cartao mostra so o que muda a decisao de quem le: o que e, ate quando, o
 * que ja aconteceu e o unico botao que faz sentido agora.
 */
function MinhaAtividade({ item, onMudou, showToast }) {
  const [observacao, setObservacao] = useState('')
  const [escrevendo, setEscrevendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const aviso = avisoDePrazo(item)

  const marcar = async (feito) => {
    setSalvando(true)
    try {
      await api.post(`/atribuicoes/${item.id}/checkin`, { feito, observacao: feito ? observacao.trim() : '' })
      showToast(feito ? 'Marcada como feita.' : 'Voltou para "a fazer".')
      setEscrevendo(false)
      setObservacao('')
      onMudou()
    } catch (erro) {
      showToast(getApiErrorMessage(erro, 'Não foi possível salvar.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900">{item.titulo}</h3>
          {item.descricao && <p className="text-sm text-gray-500 mt-1">{item.descricao}</p>}
        </div>
        <Badge status={item.situacao} showDot />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {aviso && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${CLASSES_AVISO_PRAZO[aviso.tom]}`}>
            <Clock size={12} /> {aviso.texto}
          </span>
        )}
        {item.checkinEm && (
          <span className="text-gray-500">Você marcou como feita em {dataBr(item.checkinEm)}</span>
        )}
        <span className="text-gray-400">Avalia: {item.avaliador.name}</span>
      </div>

      {/* A devolutiva do avaliador. E o unico texto que a pessoa recebe de
          volta, entao tem destaque proprio em vez de virar mais uma linha. */}
      {item.avaliacao === 'nao_cumprido' && item.avaliacaoObs && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-1">
            <MessageSquare size={13} /> O que faltou
          </div>
          <p className="text-sm text-red-800">{item.avaliacaoObs}</p>
        </div>
      )}
      {item.avaliacao === 'cumprido' && item.avaliacaoObs && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-3.5 py-3">
          <p className="text-sm text-green-800">{item.avaliacaoObs}</p>
        </div>
      )}

      {item.checkinObs && item.situacao === 'aguardando_avaliacao' && (
        <p className="text-sm text-gray-500 border-l-2 border-gray-200 pl-3">{item.checkinObs}</p>
      )}

      {item.situacao === 'a_fazer' && (
        <div className="space-y-2">
          {escrevendo && (
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              autoFocus
              className="input-field resize-none text-sm"
              placeholder="Quer deixar uma observação para quem vai avaliar? (opcional)"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => marcar(true)} disabled={salvando} className="btn-primary text-sm">
              <Check size={15} /> {salvando ? 'Salvando...' : 'Marcar como feito'}
            </button>
            {!escrevendo && (
              <button onClick={() => setEscrevendo(true)} className="btn-secondary text-sm">
                <MessageSquare size={14} /> Adicionar observação
              </button>
            )}
          </div>
        </div>
      )}

      {item.situacao === 'aguardando_avaliacao' && (
        <button onClick={() => marcar(false)} disabled={salvando} className="btn-secondary text-sm">
          <Undo2 size={14} /> Desmarcar
        </button>
      )}

      {item.avaliadoEm && (
        <p className="text-xs text-gray-400">
          Avaliado por {item.avaliador.name} em {dataBr(item.avaliadoEm)}
        </p>
      )}
    </div>
  )
}

/* ─── Aba: minhas responsabilidades ─── */

function MinhasResponsabilidades({ mes, showToast }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/atribuicoes/minhas', { params: { mes } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [mes])

  useEffect(carregar, [carregar])

  if (carregando) return <div className="card text-sm text-gray-400 text-center py-10">Carregando...</div>
  if (!dados) return <div className="card text-sm text-gray-400 text-center py-10">Não foi possível carregar suas atividades.</div>

  return (
    <div className="space-y-4">
      <ResumoDoMes resumo={dados} />

      {dados.itens.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-12 gap-2">
          <ListChecks size={26} className="text-gray-300" />
          <p className="font-semibold text-gray-700">Nada atribuído em {rotuloMes(mes)}</p>
          <p className="text-sm text-gray-500 max-w-sm">
            Quando a coordenação atribuir uma atividade a você, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {dados.itens.map((item) => (
            <MinhaAtividade key={item.id} item={item} onMudou={carregar} showToast={showToast} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Aba: para avaliar ─── */

/**
 * A fila de quem avalia.
 *
 * Dois botoes e nada mais. O "nao cumpriu" abre a justificativa porque ela e
 * obrigatoria -- e o texto que a pessoa avaliada vai ler na tela dela.
 */
function ItemParaAvaliar({ item, onMudou, showToast }) {
  const [recusando, setRecusando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  const avaliar = async (resultado) => {
    if (resultado === 'nao_cumprido' && !justificativa.trim()) {
      showToast('Explique o que faltou antes de marcar como não cumprida.', 'error')
      return
    }
    setSalvando(true)
    try {
      await api.put(`/atribuicoes/${item.id}/avaliacao`, {
        avaliacao: resultado,
        observacao: justificativa.trim(),
      })
      showToast(resultado === 'cumprido' ? 'Marcada como cumprida.' : 'Marcada como não cumprida.')
      onMudou()
    } catch (erro) {
      showToast(getApiErrorMessage(erro, 'Não foi possível registrar a avaliação.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {iniciais(item.responsavel.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 truncate">{item.responsavel.name}</div>
          <div className="text-xs text-gray-400">{ROTULOS_PERFIL[item.responsavel.role] || item.responsavel.role}</div>
        </div>
        {item.avaliacao && <Badge status={item.situacao} showDot />}
      </div>

      <div>
        <p className="font-medium text-gray-800 text-sm">{item.titulo}</p>
        {item.descricao && <p className="text-sm text-gray-500 mt-0.5">{item.descricao}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>Marcou como feito em {dataBr(item.checkinEm)}</span>
        {item.prazo && <span>Prazo era {dataBr(item.prazo)}</span>}
      </div>

      {item.checkinObs && (
        <p className="text-sm text-gray-600 border-l-2 border-brand-200 pl-3 bg-brand-50/40 py-2 rounded-r-lg">
          {item.checkinObs}
        </p>
      )}

      {!item.avaliacao && (
        <div className="space-y-2">
          {recusando && (
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={2}
              autoFocus
              className="input-field resize-none text-sm"
              placeholder="O que faltou para esta atividade ser considerada cumprida?"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {!recusando && (
              <button onClick={() => avaliar('cumprido')} disabled={salvando} className="btn-primary text-sm">
                <CheckCircle size={15} /> Cumpriu
              </button>
            )}
            <button
              onClick={() => (recusando ? avaliar('nao_cumprido') : setRecusando(true))}
              disabled={salvando}
              className={recusando ? 'btn-primary text-sm !bg-red-600 hover:!bg-red-700' : 'btn-secondary text-sm'}
            >
              <XCircle size={15} /> {recusando ? (salvando ? 'Salvando...' : 'Confirmar não cumpriu') : 'Não cumpriu'}
            </button>
            {recusando && (
              <button onClick={() => { setRecusando(false); setJustificativa('') }} className="btn-secondary text-sm">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ParaAvaliar({ mes, showToast, onMudou }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/atribuicoes/avaliar', { params: { mes } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [mes])

  useEffect(carregar, [carregar])

  const mudou = () => { carregar(); onMudou?.() }

  if (carregando) return <div className="card text-sm text-gray-400 text-center py-10">Carregando...</div>
  if (!dados) return <div className="card text-sm text-gray-400 text-center py-10">Não foi possível carregar a fila.</div>

  return (
    <div className="space-y-4">
      {dados.aguardando.length === 0 ? (
        <div className="card flex flex-col items-center text-center py-12 gap-2">
          <ClipboardCheck size={26} className="text-gray-300" />
          <p className="font-semibold text-gray-700">Nada esperando por você</p>
          <p className="text-sm text-gray-500 max-w-sm">
            Assim que alguém marcar como feita uma atividade que você avalia, ela aparece aqui.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            <b className="text-gray-800">{dados.aguardando.length}</b> atividade{dados.aguardando.length !== 1 ? 's' : ''} esperando sua avaliação em {rotuloMes(mes)}.
          </p>
          <div className="grid gap-3">
            {dados.aguardando.map((item) => (
              <ItemParaAvaliar key={item.id} item={item} onMudou={mudou} showToast={showToast} />
            ))}
          </div>
        </>
      )}

      {/* Quem ainda nao marcou nao e trabalho do avaliador, mas ele precisa
          conseguir ver quem esta parado -- por isso fica listado, e discreto. */}
      {dados.naoIniciadas.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Ainda não marcadas como feitas</h3>
          <p className="text-xs text-gray-500 mb-3">Não há o que avaliar até a pessoa marcar.</p>
          <div className="divide-y divide-gray-100">
            {dados.naoIniciadas.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-gray-700 truncate">
                  <b className="font-medium">{item.responsavel.name}</b>
                  <span className="text-gray-400"> · {item.titulo}</span>
                </span>
                {item.prazo && <span className="text-xs text-gray-400 flex-shrink-0">Prazo {dataBr(item.prazo)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Pagina ─── */

export default function MinhasAtividades() {
  const [mes, setMes] = useState(mesAtual())
  const [resumo, setResumo] = useState(null)
  const [aba, setAba] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const carregarResumo = useCallback(() => {
    api.get('/atribuicoes/resumo', { params: { mes } })
      .then(({ data }) => setResumo(data))
      .catch(() => setResumo(null))
  }, [mes])

  useEffect(carregarResumo, [carregarResumo])

  // A aba inicial e decidida pelo que a pessoa realmente tem: quem so avalia
  // (o administrador, por exemplo) abre direto na fila em vez de cair numa
  // lista vazia de responsabilidades.
  useEffect(() => {
    if (!resumo || aba) return
    setAba(resumo.recebeAtividade ? 'minhas' : 'avaliar')
  }, [resumo, aba])

  const mostraMinhas = resumo?.recebeAtividade
  const mostraAvaliar = resumo?.souAvaliador
  const abaAtiva = aba || (mostraMinhas ? 'minhas' : 'avaliar')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Minhas atividades</h1>
          <p className="page-subtitle">
            {mostraMinhas
              ? 'O que foi atribuído a você neste mês e como foi avaliado.'
              : 'As atividades que você foi designado para avaliar.'}
          </p>
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="input-field" />
        </div>
      </div>

      {mostraMinhas && mostraAvaliar ? (
        <div className="card p-0">
          <div className="flex items-center border-b border-gray-100 px-2 pt-2 flex-wrap">
            <button
              onClick={() => setAba('minhas')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                abaAtiva === 'minhas' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ListChecks size={15} /> Minhas responsabilidades
            </button>
            <button
              onClick={() => setAba('avaliar')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
                abaAtiva === 'avaliar' ? 'border-brand-700 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardCheck size={15} /> Para avaliar
              {resumo?.pendentesParaAvaliar > 0 && (
                <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px]">
                  {resumo.pendentesParaAvaliar}
                </span>
              )}
            </button>
          </div>
          <div className="p-5">
            {abaAtiva === 'minhas'
              ? <MinhasResponsabilidades mes={mes} showToast={showToast} />
              : <ParaAvaliar mes={mes} showToast={showToast} onMudou={carregarResumo} />}
          </div>
        </div>
      ) : mostraAvaliar ? (
        <ParaAvaliar mes={mes} showToast={showToast} onMudou={carregarResumo} />
      ) : (
        <MinhasResponsabilidades mes={mes} showToast={showToast} />
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <CheckCircle size={16} className={toast.type === 'error' ? 'text-red-200' : 'text-green-400'} />
          {toast.message}
        </div>
      )}
    </div>
  )
}
