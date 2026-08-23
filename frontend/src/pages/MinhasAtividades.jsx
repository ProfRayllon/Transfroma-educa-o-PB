import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCircle, Undo2, ListChecks, MessageSquare } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { LinhaDoTempo, PontoSituacao } from '../components/atribuicoes/FluxoAtribuicao'
import CalendarioDoMes from '../components/atribuicoes/CalendarioDoMes'
import api, { getApiErrorMessage } from '../lib/api'
import { mesAtual, rotuloMes, dataBr, avisoDePrazo, corDaFrequencia } from '../lib/atribuicoes'

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
 * Compacto de proposito: a pessoa precisa enxergar o mes inteiro sem rolar.
 *
 * A linha de baixo e uma DATA, e nao o nome da situacao -- o ponto colorido ja
 * diz o estado, e escrever "Cumprida" logo abaixo dele seria dizer duas vezes a
 * mesma coisa. Enquanto ha o que fazer a data que importa e o prazo; depois de
 * feita, e o dia em que foi feita.
 */
function MinhaAtividade({ item, selecionada, onAbrir, onMudou, showToast }) {
  const [salvando, setSalvando] = useState(false)

  const aviso = avisoDePrazo(item)
  const legenda = item.checkinEm ? `Feita em ${dataBr(item.checkinEm)}`
    : item.prazo ? (
      <span className={aviso?.tom === 'atrasado' ? 'text-red-500 font-medium' : aviso?.tom === 'hoje' || aviso?.tom === 'proximo' ? 'text-amber-600 font-medium' : ''}>
        {aviso?.tom === 'atrasado' || aviso?.tom === 'hoje' ? `${aviso.texto} · ` : 'Prazo '}{dataBr(item.prazo)}
      </span>
    )
    : 'Sem prazo'

  const marcar = async (feito, evento) => {
    evento.stopPropagation()
    setSalvando(true)
    try {
      await api.post(`/atribuicoes/${item.id}/checkin`, { feito })
      showToast(feito ? 'Marcada como feita.' : 'Voltou para "a fazer".')
      onMudou()
    } catch (erro) {
      showToast(getApiErrorMessage(erro, 'Não foi possível salvar.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    /* Clicar em qualquer parte do cartao abre o detalhe. Nao e um <button>:
       dentro dele ja existe um botao de verdade, e botao dentro de botao e
       HTML invalido -- alem de roubar o Enter de quem navega pelo teclado. */
    <div
      onClick={onAbrir}
      className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
        selecionada
          ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-300'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <PontoSituacao item={item} className="mt-1.5" />

        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-gray-800 leading-snug">{item.titulo}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{legenda}</p>
        </div>

        {/* Fazer e desfazer no proprio cartao.

            Sao os dois cliques do dia a dia de quem so executa, e obrigar a
            abrir o popup para cada um custava dois cliques a mais por
            atividade -- num mes de dez atividades, vinte cliques de puro
            transporte. So o icone, do tamanho de uma linha de texto, porque o
            cartao precisa continuar cabendo em duas colunas; marcar com
            observacao continua no popup, onde ha espaco para escrever.

            Depois de avaliada nao aparece nenhum dos dois: o servidor recusa
            mexer no check-in a essa altura, e um botao que sempre falha e pior
            do que botao nenhum. */}
        {item.situacao === 'a_fazer' && (
          <button
            onClick={(evento) => marcar(true, evento)}
            disabled={salvando}
            title="Marcar como feita"
            className="flex-shrink-0 w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Check size={14} />
          </button>
        )}

        {item.situacao === 'aguardando_avaliacao' && (
          <button
            onClick={(evento) => marcar(false, evento)}
            disabled={salvando}
            title={'Desfazer — voltar para "a fazer"'}
            className="flex-shrink-0 w-7 h-7 rounded-lg border border-transparent text-gray-300 hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Undo2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * O detalhe da atividade, em popup.
 *
 * Tudo que saiu dos cartoes mora aqui: descricao, devolutiva do avaliador,
 * observacao e o fluxo. Em popup, e nao numa coluna fixa, por duas razoes: o
 * fluxo precisa de largura para cada etapa caber numa linha -- espremido em
 * 300px as datas quebram em duas -- e a faixa do alto fica livre para o resumo
 * do mes, que e o que a pessoa quer ver sem clicar em nada.
 *
 * O par "faz -> avalia" nao se repete aqui: o proprio fluxo nomeia cada pessoa
 * com o cargo, em cada etapa.
 */
function DetalheDaAtividade({ item, aberto, onFechar, onMudou, showToast }) {
  const [observacao, setObservacao] = useState('')
  const [escrevendo, setEscrevendo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Trocar de atividade nao pode levar junto o rascunho da anterior.
  useEffect(() => { setObservacao(''); setEscrevendo(false) }, [item.id])

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
    <Modal open={aberto} onClose={onFechar} title="Atividade" size="md">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <PontoSituacao item={item} tamanho="w-3 h-3" className="mt-1.5" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 leading-snug">{item.titulo}</p>
            {item.descricao && <p className="text-sm text-gray-500 mt-1">{item.descricao}</p>}
          </div>
        </div>

        {item.avaliacao === 'nao_cumprido' && item.avaliacaoObs && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 mb-1">
              <MessageSquare size={12} /> O que faltou
            </div>
            <p className="text-xs text-red-800">{item.avaliacaoObs}</p>
          </div>
        )}
        {item.avaliacao === 'cumprido' && item.avaliacaoObs && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
            <p className="text-xs text-green-800">{item.avaliacaoObs}</p>
          </div>
        )}

        {item.checkinObs && item.situacao === 'aguardando_avaliacao' && (
          <p className="text-xs text-gray-500 border-l-2 border-gray-200 pl-2.5">{item.checkinObs}</p>
        )}

        {item.situacao === 'a_fazer' && (
          <div className="space-y-2">
            {escrevendo && (
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                autoFocus
                className="input-field resize-none text-xs"
                placeholder="Observação para quem vai avaliar (opcional)"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => marcar(true)} disabled={salvando} className="btn-primary text-xs py-1.5">
                <Check size={13} /> {salvando ? 'Salvando...' : 'Marcar como feito'}
              </button>
              {!escrevendo && (
                <button onClick={() => setEscrevendo(true)} className="btn-secondary text-xs py-1.5">
                  <MessageSquare size={12} /> Observação
                </button>
              )}
            </div>
          </div>
        )}

        {item.situacao === 'aguardando_avaliacao' && (
          <button onClick={() => marcar(false)} disabled={salvando} className="btn-secondary text-xs py-1.5">
            <Undo2 size={12} /> Desmarcar
          </button>
        )}

        <LinhaDoTempo item={item} />
      </div>
    </Modal>
  )
}

/* ─── A lista do mes ─── */

function MinhasResponsabilidades({ mes, showToast }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [selecionadaId, setSelecionadaId] = useState(null)
  const [popupAberto, setPopupAberto] = useState(false)

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/atribuicoes/minhas', { params: { mes } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [mes])

  useEffect(carregar, [carregar])

  /**
   * Mantem a selecao entre recarregamentos.
   *
   * Depois de marcar uma atividade como feita a lista volta do servidor inteira;
   * sem isso o painel pularia de volta para a primeira, e a pessoa perderia de
   * vista justamente o item que acabou de mexer.
   */
  const itens = dados?.itens || []
  useEffect(() => {
    if (itens.length === 0) { setSelecionadaId(null); return }
    if (!itens.some((item) => item.id === selecionadaId)) setSelecionadaId(itens[0].id)
  }, [itens, selecionadaId])

  const selecionada = itens.find((item) => item.id === selecionadaId) || itens[0] || null

  // Abrir tambem seleciona: ao fechar o popup, o calendario continua marcando
  // o dia do item que acabou de ser lido.
  const abrir = (id) => { setSelecionadaId(id); setPopupAberto(true) }

  if (carregando && !dados) return <div className="card text-sm text-gray-400 text-center py-10">Carregando...</div>
  if (!dados) return <div className="card text-sm text-gray-400 text-center py-10">Não foi possível carregar suas atividades.</div>

  if (itens.length === 0) {
    return (
      <div className="space-y-4">
        <ResumoDoMes resumo={dados} />
        <div className="card flex flex-col items-center text-center py-12 gap-2">
          <ListChecks size={26} className="text-gray-300" />
          <p className="font-semibold text-gray-700">Nada atribuído em {rotuloMes(mes)}</p>
          <p className="text-sm text-gray-500 max-w-sm">
            Quando a coordenação atribuir uma atividade a você, ela aparece aqui.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ResumoDoMes resumo={dados} />

      {/* Atividades a esquerda, em duas colunas; calendario a direita. O
          objetivo e o mes inteiro caber numa tela: cada item virou uma linha de
          tres alturas de texto, e o detalhe -- descricao, devolutiva, fluxo --
          abre em popup ao clicar, em vez de ocupar coluna fixa. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px] items-start">
        <div className="grid gap-2 sm:grid-cols-2 content-start">
          {itens.map((item) => (
            <MinhaAtividade
              key={item.id}
              item={item}
              selecionada={item.id === selecionada?.id}
              onAbrir={() => abrir(item.id)}
              onMudou={carregar}
              showToast={showToast}
            />
          ))}
        </div>

        {/* Gruda no topo ao rolar: e a referencia do mes enquanto a pessoa
            percorre a lista. Clicar num dia abre a atividade daquele prazo. */}
        <div className="xl:sticky xl:top-4">
          <CalendarioDoMes
            mes={mes}
            itens={itens}
            selecionadaId={selecionada?.id}
            onSelecionar={abrir}
          />
        </div>
      </div>

      {selecionada && (
        <DetalheDaAtividade
          item={selecionada}
          aberto={popupAberto}
          onFechar={() => setPopupAberto(false)}
          onMudou={carregar}
          showToast={showToast}
        />
      )}
    </div>
  )
}

/* ─── Pagina ─── */

/**
 * A tela de quem executa -- a mesma para todo mundo que recebe atividade.
 *
 * Um perfil que tambem avalia (coordenacao, supervisao) nao ve nada de
 * diferente por aqui: o papel de avaliador virou uma tela propria, "Minhas
 * avaliacoes", com entrada propria no menu. Enquanto os dois moravam em abas
 * deste lugar, a mesma pagina respondia a duas perguntas sem relacao e obrigava
 * a escolher uma aba antes de ver qualquer coisa.
 *
 * Administrador e gerencia nao chegam aqui: eles nao recebem atividade, e a
 * visao deles do mes e /frequencia.
 */
export default function MinhasAtividades() {
  const [mes, setMes] = useState(mesAtual())
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Minhas atividades</h1>
          <p className="page-subtitle">O que foi atribuído a você neste mês e como foi avaliado.</p>
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="input-field" />
        </div>
      </div>

      <MinhasResponsabilidades mes={mes} showToast={showToast} />

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
