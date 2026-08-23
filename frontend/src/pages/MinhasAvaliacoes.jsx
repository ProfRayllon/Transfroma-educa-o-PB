import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle, XCircle, ClipboardCheck, MessageSquare, ChevronDown, Users,
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import { ParDeResponsaveis, LinhaDoTempo, PontoSituacao } from '../components/atribuicoes/FluxoAtribuicao'
import api, { getApiErrorMessage } from '../lib/api'
import {
  mesAtual, rotuloMes, dataBr, iniciais, corDaFrequencia, ROTULOS_PERFIL,
} from '../lib/atribuicoes'

/**
 * A tela de quem avalia.
 *
 * Separada de "Minhas atividades" de proposito: sao dois papeis diferentes na
 * mesma pessoa. O supervisor de tutoria executa o que recebeu -- isso e a outra
 * tela, identica a de quem so executa -- e responde pela equipe que avalia, que
 * e esta. Enquanto as duas moravam em abas do mesmo lugar, entrar em "Minhas
 * atividades" para avaliar alguem era um caminho que ninguem adivinhava.
 *
 * Tres blocos, nesta ordem, porque sao tres perguntas diferentes:
 *   1. o que espera por mim agora   -> a fila, a unica que pede acao
 *   2. como esta cada pessoa no mes -> a equipe, com a frequencia de cada um
 *   3. o que eu ja decidi           -> o historico, para consultar e prestar contas
 */

/* ─── Um item da fila ─── */

function ItemParaAvaliar({ item, selecionado, onAbrir, mostrarPessoa = true }) {
  const quando = item.avaliadoEm || item.checkinEm || item.prazo

  return (
    <div
      onClick={onAbrir}
      className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
        selecionado
          ? 'border-brand-300 bg-brand-50/60 ring-1 ring-brand-300'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <PontoSituacao item={item} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          {/* Dentro da pessoa o nome dela seria a mesma palavra em toda linha:
              la o titulo sobe e vira a informacao principal. */}
          <p className="text-[13px] font-medium text-gray-800 leading-snug truncate">
            {mostrarPessoa ? item.responsavel.name : item.titulo}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {mostrarPessoa ? item.titulo : (item.prazo ? `Prazo ${dataBr(item.prazo)}` : 'Sem prazo')}
          </p>
        </div>
        {quando && (
          <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 tabular-nums">{dataBr(quando)}</span>
        )}
      </div>
    </div>
  )
}

/* ─── O popup de avaliar ─── */

/**
 * O que a pessoa entregou e os dois botoes.
 *
 * O fluxo no rodape e o que responde "entregou no prazo?", que e a pergunta que
 * decide o clique. Depois de avaliado o mesmo popup vira consulta -- mostra o
 * que foi decidido e quando, sem botao nenhum.
 */
function PopupAvaliar({ item, aberto, onFechar, onMudou, showToast }) {
  const [recusando, setRecusando] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { setRecusando(false); setJustificativa('') }, [item.id])

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
      onFechar()
    } catch (erro) {
      showToast(getApiErrorMessage(erro, 'Não foi possível registrar a avaliação.'), 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={aberto} onClose={onFechar} title="Avaliar atividade" size="md">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <PontoSituacao item={item} tamanho="w-3 h-3" className="mt-1.5" />
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 leading-snug">{item.titulo}</p>
            {item.descricao && <p className="text-sm text-gray-500 mt-1">{item.descricao}</p>}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 px-3 py-2">
          <ParDeResponsaveis responsavel={item.responsavel} avaliador={item.avaliador} />
        </div>

        {item.checkinObs && (
          <div className="rounded-xl border border-brand-100 bg-brand-50/50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-800 mb-1">
              <MessageSquare size={12} /> O que a pessoa registrou
            </div>
            <p className="text-xs text-gray-700">{item.checkinObs}</p>
          </div>
        )}

        {item.avaliacao ? (
          <div className={`rounded-xl border px-3 py-2.5 ${
            item.avaliacao === 'cumprido' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <p className={`text-xs font-semibold ${item.avaliacao === 'cumprido' ? 'text-green-800' : 'text-red-800'}`}>
              Você marcou como {item.avaliacao === 'cumprido' ? 'cumprida' : 'não cumprida'} em {dataBr(item.avaliadoEm)}
            </p>
            {item.avaliacaoObs && (
              <p className={`text-xs mt-1 ${item.avaliacao === 'cumprido' ? 'text-green-700' : 'text-red-700'}`}>
                {item.avaliacaoObs}
              </p>
            )}
          </div>
        ) : !item.checkinEm ? (
          <p className="text-xs text-gray-400 border-l-2 border-gray-200 pl-2.5">
            {item.responsavel.name} ainda não marcou esta atividade como feita. Não há o que avaliar até lá.
          </p>
        ) : (
          <div className="space-y-2">
            {recusando && (
              <textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={2}
                autoFocus
                className="input-field resize-none text-xs"
                placeholder="O que faltou para esta atividade ser considerada cumprida?"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {!recusando && (
                <button onClick={() => avaliar('cumprido')} disabled={salvando} className="btn-primary text-xs py-1.5">
                  <CheckCircle size={13} /> Cumpriu
                </button>
              )}
              <button
                onClick={() => (recusando ? avaliar('nao_cumprido') : setRecusando(true))}
                disabled={salvando}
                className={recusando ? 'btn-primary text-xs py-1.5 !bg-red-600 hover:!bg-red-700' : 'btn-secondary text-xs py-1.5'}
              >
                <XCircle size={13} /> {recusando ? (salvando ? 'Salvando...' : 'Confirmar não cumpriu') : 'Não cumpriu'}
              </button>
              {recusando && (
                <button onClick={() => { setRecusando(false); setJustificativa('') }} className="btn-secondary text-xs py-1.5">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}

        <LinhaDoTempo item={item} />
      </div>
    </Modal>
  )
}

/* ─── Bloco 1: o que espera por mim ─── */

function FilaDeAvaliacao({ itens, selecionadoId, onAbrir }) {
  if (itens.length === 0) return null

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">Esperando você</p>
        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{itens.length}</span>
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">Já foram marcadas como feitas e dependem da sua avaliação.</p>
      <div className="grid gap-2 sm:grid-cols-2 mt-3">
        {itens.map((item) => (
          <ItemParaAvaliar
            key={item.id}
            item={item}
            selecionado={item.id === selecionadoId}
            onAbrir={() => onAbrir(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Bloco 2: a equipe que eu avalio ─── */

/**
 * Uma pessoa da equipe, com a frequencia do mes e as atividades por dentro.
 *
 * A frequencia so conta o que EU avalio: se o mesmo professor recebe atividades
 * de outro avaliador, elas nao entram nesta conta -- a linha responde "como esta
 * essa pessoa comigo", e nao "como esta essa pessoa no sistema", que e a
 * pergunta da tela de Frequencia.
 *
 * Fechada por padrao: a linha ja responde de relance, e abrir todas de uma vez
 * devolveria a tela cheia de informacao que o mes passado tinha.
 */
function PessoaDaEquipe({ grupo, aberta, onAlternar, selecionadoId, onAbrir }) {
  const cor = corDaFrequencia(grupo.frequencia)
  const cargo = ROTULOS_PERFIL[grupo.pessoa.role] || grupo.pessoa.role

  return (
    <div className={`rounded-xl border transition-colors ${aberta ? 'border-gray-300 bg-gray-50/50' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={onAlternar}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold flex items-center justify-center">
          {iniciais(grupo.pessoa.name)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-gray-800 leading-snug truncate">{grupo.pessoa.name}</span>
          <span className="block text-[11px] text-gray-400">{cargo}</span>
        </span>

        {/* A barra e o numero dizem a mesma coisa de dois jeitos: a barra para
            comparar as pessoas de relance, o numero para citar em reuniao. */}
        <span className="hidden sm:block w-24 flex-shrink-0">
          <span className="block h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <span className={`block h-full rounded-full ${cor.barra}`} style={{ width: `${grupo.frequencia}%` }} />
          </span>
          <span className="block text-[10px] text-gray-400 mt-1 tabular-nums">
            {grupo.cumpridas} de {grupo.total} cumpridas
          </span>
        </span>

        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${cor.texto}`}>{grupo.frequencia}%</span>

        {grupo.aguardando > 0 && (
          <span className="flex-shrink-0 bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {grupo.aguardando}
          </span>
        )}

        <ChevronDown size={15} className={`flex-shrink-0 text-gray-400 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>

      {aberta && (
        <div className="px-3 pb-3 grid gap-2 sm:grid-cols-2">
          {grupo.itens.map((item) => (
            <ItemParaAvaliar
              key={item.id}
              item={item}
              mostrarPessoa={false}
              selecionado={item.id === selecionadoId}
              onAbrir={() => onAbrir(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EquipeQueAvalio({ grupos, abertas, onAlternar, selecionadoId, onAbrir }) {
  if (grupos.length === 0) return null

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">A equipe que você avalia</p>
        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">
          {grupos.length} pessoa{grupos.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">
        A frequência considera só as atividades que passam por você. Clique para ver as atividades da pessoa.
      </p>
      <div className="grid gap-2 mt-3">
        {grupos.map((grupo) => (
          <PessoaDaEquipe
            key={grupo.pessoa.id}
            grupo={grupo}
            aberta={abertas.has(grupo.pessoa.id)}
            onAlternar={() => onAlternar(grupo.pessoa.id)}
            selecionadoId={selecionadoId}
            onAbrir={onAbrir}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Bloco 3: o que eu ja decidi ─── */

/**
 * O historico, em ordem de decisao.
 *
 * Nao repete os cartoes da equipe: aqui a coluna que importa e a DATA em que a
 * decisao foi tomada, porque a pergunta e "o que eu ja despachei e quando".
 * Por isso e uma lista de linhas, e nao uma grade de cartoes.
 */
function HistoricoDeAvaliacoes({ itens, onAbrir }) {
  if (itens.length === 0) return null

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-gray-800">Histórico das suas avaliações</p>
        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{itens.length}</span>
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">O que você decidiu neste mês, da decisão mais recente para a mais antiga.</p>

      <div className="mt-3 divide-y divide-gray-100">
        {itens.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAbrir(item.id)}
            className="w-full flex items-center gap-3 py-2 text-left hover:bg-gray-50 transition-colors px-1 -mx-1 rounded-lg"
          >
            <span className="text-[11px] text-gray-400 tabular-nums w-11 flex-shrink-0">{dataBr(item.avaliadoEm)}</span>
            <PontoSituacao item={item} className="flex-shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-gray-800 leading-snug truncate">{item.titulo}</span>
              <span className="block text-[11px] text-gray-400 truncate">{item.responsavel.name}</span>
            </span>
            <span className={`text-[11px] font-medium flex-shrink-0 ${
              item.avaliacao === 'cumprido' ? 'text-green-700' : 'text-red-600'
            }`}>
              {item.avaliacao === 'cumprido' ? 'Cumpriu' : 'Não cumpriu'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Pagina ─── */

export default function MinhasAvaliacoes() {
  const [mes, setMes] = useState(mesAtual())
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [popupAberto, setPopupAberto] = useState(false)
  const [abertas, setAbertas] = useState(new Set())
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/atribuicoes/avaliar', { params: { mes } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [mes])

  useEffect(carregar, [carregar])

  // Trocar de mes fecha as pessoas abertas: o que estava aberto era do mes
  // anterior, e reabrir sozinho no mes novo seria decidir pela pessoa.
  useEffect(() => { setAbertas(new Set()) }, [mes])

  const todos = useMemo(
    () => (dados ? [...dados.aguardando, ...dados.avaliadas, ...dados.naoIniciadas] : []),
    [dados],
  )

  /**
   * A equipe, montada aqui e nao no servidor.
   *
   * Os tres blocos ja vem completos na mesma resposta -- agrupar por pessoa e
   * so uma leitura diferente dos mesmos itens. Uma rota nova seria uma segunda
   * consulta ao banco para dizer o que a primeira ja disse.
   */
  const equipe = useMemo(() => {
    const porPessoa = new Map()

    for (const item of todos) {
      const chave = item.responsavel.id
      if (!porPessoa.has(chave)) {
        porPessoa.set(chave, {
          pessoa: item.responsavel,
          itens: [],
          total: 0,
          cumpridas: 0,
          naoCumpridas: 0,
          aguardando: 0,
          naoIniciadas: 0,
        })
      }
      const grupo = porPessoa.get(chave)
      grupo.itens.push(item)
      grupo.total += 1
      if (item.avaliacao === 'cumprido') grupo.cumpridas += 1
      else if (item.avaliacao === 'nao_cumprido') grupo.naoCumpridas += 1
      else if (item.checkinEm) grupo.aguardando += 1
      else grupo.naoIniciadas += 1
    }

    return [...porPessoa.values()]
      .map((grupo) => ({
        ...grupo,
        frequencia: grupo.total ? Math.round((grupo.cumpridas / grupo.total) * 100) : 0,
        // Dentro da pessoa, o prazo manda: e a ordem em que as coisas venceram.
        itens: [...grupo.itens].sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999')),
      }))
      // Quem tem coisa esperando sobe; depois, a menor frequencia primeiro --
      // as duas ordens colocam no alto quem precisa de atencao.
      .sort((a, b) => (b.aguardando - a.aguardando) || (a.frequencia - b.frequencia)
        || a.pessoa.name.localeCompare(b.pessoa.name))
  }, [todos])

  const historico = useMemo(
    () => (dados ? [...dados.avaliadas].sort((a, b) => String(b.avaliadoEm).localeCompare(String(a.avaliadoEm))) : []),
    [dados],
  )

  const selecionado = todos.find((item) => item.id === selecionadoId) || null
  const abrir = (id) => { setSelecionadoId(id); setPopupAberto(true) }

  const alternarPessoa = (id) => {
    setAbertas((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  const resumo = dados?.resumo

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Minhas avaliações</h1>
          <p className="page-subtitle">As atividades que passam por você e como está cada pessoa da sua equipe.</p>
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês</label>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="input-field" />
        </div>
      </div>

      {carregando && !dados ? (
        <div className="card text-sm text-gray-400 text-center py-10">Carregando...</div>
      ) : !dados ? (
        <div className="card text-sm text-gray-400 text-center py-10">Não foi possível carregar suas avaliações.</div>
      ) : (
        <>
          <div className="card">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-bold text-gray-900 leading-none">{resumo.aguardando}</div>
                <p className="text-sm text-gray-500 mt-1.5">
                  {resumo.aguardando === 1 ? 'atividade esperando você' : 'atividades esperando você'}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 leading-none">{resumo.avaliadas}</div>
                <p className="text-sm text-gray-500 mt-1.5">já avaliadas neste mês</p>
              </div>
            </div>

            {(resumo.avaliadas > 0 || resumo.naoIniciadas > 0) && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                {resumo.cumpridas > 0 && <span><b className="text-green-700">{resumo.cumpridas}</b> cumpridas</span>}
                {resumo.naoCumpridas > 0 && <span><b className="text-red-600">{resumo.naoCumpridas}</b> não cumpridas</span>}
                {resumo.naoIniciadas > 0 && <span><b className="text-gray-700">{resumo.naoIniciadas}</b> ainda não marcadas pela pessoa</span>}
                <span className="flex items-center gap-1"><Users size={12} /> {equipe.length} na sua equipe</span>
              </div>
            )}
          </div>

          {todos.length === 0 ? (
            <div className="card flex flex-col items-center text-center py-12 gap-2">
              <ClipboardCheck size={26} className="text-gray-300" />
              <p className="font-semibold text-gray-700">Nada para avaliar em {rotuloMes(mes)}</p>
              <p className="text-sm text-gray-500 max-w-sm">
                Quando alguém for atribuído a você como avaliador, a equipe e a fila aparecem aqui.
              </p>
            </div>
          ) : (
            <>
              <FilaDeAvaliacao itens={dados.aguardando} selecionadoId={selecionado?.id} onAbrir={abrir} />
              <EquipeQueAvalio
                grupos={equipe}
                abertas={abertas}
                onAlternar={alternarPessoa}
                selecionadoId={selecionado?.id}
                onAbrir={abrir}
              />
              <HistoricoDeAvaliacoes itens={historico} onAbrir={abrir} />
            </>
          )}
        </>
      )}

      {selecionado && (
        <PopupAvaliar
          item={selecionado}
          aberto={popupAberto}
          onFechar={() => setPopupAberto(false)}
          onMudou={carregar}
          showToast={showToast}
        />
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
