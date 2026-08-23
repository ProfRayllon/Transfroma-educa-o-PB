import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Download, Search, Users, CheckCircle, XCircle, Clock, TrendingUp, Trash2, Pencil, Eye, X,
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import StatCard from '../components/ui/StatCard'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { ParDeResponsaveis, LinhaDoTempo } from '../components/atribuicoes/FluxoAtribuicao'
import api, { getApiErrorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  ROTULOS_PERFIL, mesAtual, rotuloMes, ultimoDiaDoMes, iniciais, corDaFrequencia,
} from '../lib/atribuicoes'

/* ─── Atribuir atividade ─── */

const FORM_VAZIO = { titulo: '', descricao: '', mesReferencia: mesAtual(), prazo: '', avaliadorId: '' }

/**
 * Uma atividade, uma ou varias pessoas.
 *
 * O perfil escolhido e um agrupador para achar a gente, e nao o alvo da
 * atribuicao: marcar "todos" grava uma linha por pessoa, exatamente como marcar
 * uma so. Foi essa diferenca que sumiu no modulo antigo, em que o criterio
 * pertencia ao perfil e cada pessoa herdava um vinculo que ninguem escolheu.
 */
function ModalAtribuir({ open, onClose, onSalvo, showToast }) {
  const [form, setForm] = useState(FORM_VAZIO)
  const [grupos, setGrupos] = useState([])
  const [avaliadores, setAvaliadores] = useState([])
  const [perfil, setPerfil] = useState('')
  const [selecionados, setSelecionados] = useState(new Set())
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(FORM_VAZIO)
    setSelecionados(new Set())
    setBusca('')
    setErro('')
    Promise.all([api.get('/atribuicoes/pessoas'), api.get('/atribuicoes/avaliadores')])
      .then(([pessoas, avals]) => {
        setGrupos(pessoas.data)
        setAvaliadores(avals.data)
        setPerfil(pessoas.data[0]?.role || '')
      })
      .catch(() => setErro('Não foi possível carregar a lista de pessoas.'))
  }, [open])

  const grupoAtual = grupos.find((grupo) => grupo.role === perfil)
  const pessoasVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = grupoAtual?.pessoas || []
    return termo ? lista.filter((p) => p.name.toLowerCase().includes(termo)) : lista
  }, [grupoAtual, busca])

  const todasMarcadas = pessoasVisiveis.length > 0 && pessoasVisiveis.every((p) => selecionados.has(p.id))

  const alternar = (id) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id); else proximo.add(id)
      return proximo
    })
  }

  const alternarTodas = () => {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      pessoasVisiveis.forEach((p) => (todasMarcadas ? proximo.delete(p.id) : proximo.add(p.id)))
      return proximo
    })
  }

  const salvar = async () => {
    if (!form.titulo.trim()) { setErro('Informe o título da atividade.'); return }
    if (selecionados.size === 0) { setErro('Selecione ao menos uma pessoa.'); return }
    if (!form.avaliadorId) { setErro('Escolha quem vai avaliar.'); return }

    setSalvando(true)
    setErro('')
    try {
      const { data } = await api.post('/atribuicoes', {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        mesReferencia: form.mesReferencia,
        prazo: form.prazo || null,
        avaliadorId: Number(form.avaliadorId),
        responsavelIds: Array.from(selecionados),
      })
      showToast(`Atividade atribuída a ${data.criadas} pessoa${data.criadas !== 1 ? 's' : ''}.`)
      onSalvo()
      onClose()
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Erro ao atribuir a atividade.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atribuir atividade"
      size="lg"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary" disabled={salvando}>Cancelar</button>
          <button onClick={salvar} className="btn-primary" disabled={salvando}>
            <CheckCircle size={15} />
            {salvando ? 'Atribuindo...' : `Atribuir${selecionados.size ? ` a ${selecionados.size}` : ''}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            O que precisa ser feito <span className="text-red-500">*</span>
          </label>
          <input
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            maxLength={150}
            className="input-field"
            placeholder="Ex: Entregar os 4 vídeos do Módulo 2"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Se a atividade tem número, escreva no título — a avaliação é cumpriu ou não cumpriu.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Detalhes (opcional)</label>
          <textarea
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            rows={2}
            className="input-field resize-none"
            placeholder="O que se espera dessa entrega..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Mês <span className="text-red-500">*</span></label>
            <input
              type="month"
              value={form.mesReferencia}
              onChange={(e) => setForm((f) => ({ ...f, mesReferencia: e.target.value, prazo: '' }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Prazo (opcional)</label>
            {/* Limitado ao mes de referencia: um prazo fora dele criaria uma
                atividade que nao aparece no relatorio em que ela conta. */}
            <input
              type="date"
              value={form.prazo}
              min={`${form.mesReferencia}-01`}
              max={ultimoDiaDoMes(form.mesReferencia)}
              onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Quem avalia <span className="text-red-500">*</span>
            </label>
            <select
              value={form.avaliadorId}
              onChange={(e) => setForm((f) => ({ ...f, avaliadorId: e.target.value }))}
              className="select-field"
            >
              <option value="">Escolher...</option>
              {avaliadores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>{pessoa.name} · {pessoa.roleLabel}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
            <select
              value={perfil}
              onChange={(e) => { setPerfil(e.target.value); setBusca('') }}
              className="select-field !py-1.5 text-sm w-auto min-w-[170px]"
            >
              {grupos.map((grupo) => (
                <option key={grupo.role} value={grupo.role}>{grupo.label} ({grupo.pessoas.length})</option>
              ))}
            </select>
            <div className="relative flex-1 min-w-[140px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="input-field !py-1.5 pl-8 text-sm"
                placeholder="Buscar pessoa"
              />
            </div>
            {pessoasVisiveis.length > 0 && (
              <button type="button" onClick={alternarTodas} className="text-xs font-medium text-brand-600 hover:text-brand-800 flex-shrink-0">
                {todasMarcadas ? 'Desmarcar' : 'Marcar todos'}
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {pessoasVisiveis.map((pessoa) => {
              const marcada = selecionados.has(pessoa.id)
              return (
                <button
                  key={pessoa.id}
                  type="button"
                  onClick={() => alternar(pessoa.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${marcada ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    marcada ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                  }`}>
                    {marcada && <CheckCircle size={11} className="text-white" />}
                  </span>
                  <span className="text-sm text-gray-700 truncate">{pessoa.name}</span>
                  <span className="text-xs text-gray-400 truncate ml-auto">{pessoa.email}</span>
                </button>
              )
            })}
            {pessoasVisiveis.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma pessoa neste perfil.</p>
            )}
          </div>

          {selecionados.size > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-brand-50 border-t border-brand-100 text-xs">
              <span className="font-medium text-brand-800">
                {selecionados.size} pessoa{selecionados.size !== 1 ? 's' : ''} selecionada{selecionados.size !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={() => setSelecionados(new Set())} className="text-brand-600 hover:text-brand-800 flex items-center gap-1">
                <X size={11} /> limpar
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ─── Detalhe de uma pessoa no mes ─── */

function ModalPessoa({ pessoa, mes, onClose, onMudou, showToast, podeEditar }) {
  const { user } = useAuth()
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [formEdicao, setFormEdicao] = useState({ titulo: '', descricao: '', prazo: '' })
  const [recusando, setRecusando] = useState(null)
  const [justificativa, setJustificativa] = useState('')
  const [avaliando, setAvaliando] = useState(false)

  if (!pessoa) return null

  const abrirEdicao = (item) => {
    setEditando(item.id)
    setFormEdicao({ titulo: item.titulo, descricao: item.descricao || '', prazo: item.prazo || '' })
  }

  const salvarEdicao = async (item) => {
    try {
      await api.put(`/atribuicoes/${item.id}`, {
        titulo: formEdicao.titulo.trim(),
        descricao: formEdicao.descricao.trim() || null,
        prazo: formEdicao.prazo || null,
      })
      showToast('Atividade atualizada.')
      setEditando(null)
      onMudou()
    } catch (e) {
      showToast(getApiErrorMessage(e, 'Erro ao atualizar.'), 'error')
    }
  }

  const excluir = async () => {
    try {
      await api.delete(`/atribuicoes/${excluindo.id}`)
      showToast('Atividade excluída.')
      onMudou()
    } catch (e) {
      showToast(getApiErrorMessage(e, 'Erro ao excluir.'), 'error')
    } finally {
      setExcluindo(null)
    }
  }

  /**
   * Avaliar sem sair da Frequencia.
   *
   * Quem atribui a partir daqui costuma se colocar como avaliador -- e o caso
   * do administrador que atribui ao coordenador: nao ha instancia acima dele
   * para avaliar. Como administrador e gerencia nao tem a tela "Minhas
   * avaliacoes", esta e a unica porta que eles tem, e sem ela a atividade
   * ficaria marcada como feita para sempre, sem veredito.
   *
   * Aparece so para quem foi designado avaliador daquela atividade; o servidor
   * recusa qualquer outro, entao a condicao aqui e para nao oferecer um botao
   * que vai falhar.
   */
  const avaliar = async (item, resultado) => {
    if (resultado === 'nao_cumprido' && !justificativa.trim()) {
      showToast('Explique o que faltou antes de marcar como não cumprida.', 'error')
      return
    }
    setAvaliando(true)
    try {
      await api.put(`/atribuicoes/${item.id}/avaliacao`, {
        avaliacao: resultado,
        observacao: justificativa.trim(),
      })
      showToast(resultado === 'cumprido' ? 'Marcada como cumprida.' : 'Marcada como não cumprida.')
      setRecusando(null)
      setJustificativa('')
      onMudou()
    } catch (e) {
      showToast(getApiErrorMessage(e, 'Não foi possível registrar a avaliação.'), 'error')
    } finally {
      setAvaliando(false)
    }
  }

  const souOAvaliador = (item) => item.avaliador?.id === user?.id && item.checkinEm && !item.avaliacao

  const cor = corDaFrequencia(pessoa.frequencia)

  return (
    <>
      <Modal open onClose={onClose} title={pessoa.name} size="lg">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
            <div className="text-sm text-gray-600">
              {ROTULOS_PERFIL[pessoa.role] || pessoa.role} · {rotuloMes(mes)}
            </div>
            <div className="text-sm">
              <b className={cor.texto}>{pessoa.cumpridas} de {pessoa.total}</b>
              <span className="text-gray-400"> cumpridas · </span>
              <b className={cor.texto}>{pessoa.frequencia}%</b>
            </div>
          </div>

          <div className="grid gap-2.5">
            {pessoa.itens.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-200 px-4 py-3 space-y-2">
                {editando === item.id ? (
                  <div className="space-y-2">
                    <input
                      value={formEdicao.titulo}
                      onChange={(e) => setFormEdicao((f) => ({ ...f, titulo: e.target.value }))}
                      className="input-field text-sm"
                      maxLength={150}
                    />
                    <textarea
                      value={formEdicao.descricao}
                      onChange={(e) => setFormEdicao((f) => ({ ...f, descricao: e.target.value }))}
                      rows={2}
                      className="input-field resize-none text-sm"
                      placeholder="Detalhes (opcional)"
                    />
                    <input
                      type="date"
                      value={formEdicao.prazo}
                      min={`${mes}-01`}
                      max={ultimoDiaDoMes(mes)}
                      onChange={(e) => setFormEdicao((f) => ({ ...f, prazo: e.target.value }))}
                      className="input-field text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => salvarEdicao(item)} className="btn-primary text-sm py-1.5">Salvar</button>
                      <button onClick={() => setEditando(null)} className="btn-secondary text-sm py-1.5">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm">{item.titulo}</p>
                        {item.descricao && <p className="text-xs text-gray-500 mt-0.5">{item.descricao}</p>}
                      </div>
                      <Badge status={item.situacao} showDot />
                    </div>

                    <ParDeResponsaveis responsavel={item.responsavel} avaliador={item.avaliador} compacto />

                    {item.avaliacaoObs && (
                      <p className={`text-xs border-l-2 pl-2.5 ${
                        item.avaliacao === 'nao_cumprido' ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'
                      }`}>
                        {item.avaliacaoObs}
                      </p>
                    )}

                    {/* O fluxo completo tambem aqui: e nesta tela que a
                        coordenacao vai querer entender por que um percentual
                        ficou baixo, e a resposta costuma estar nas datas. */}
                    <LinhaDoTempo item={item} titulo="Do início ao fim" />

                    {souOAvaliador(item) && (
                      <div className="space-y-2 pt-1 border-t border-gray-100">
                        <p className="text-[11px] font-semibold text-gray-500 pt-1">
                          Você é quem avalia esta atividade.
                        </p>
                        {recusando === item.id && (
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
                          {recusando !== item.id && (
                            <button onClick={() => avaliar(item, 'cumprido')} disabled={avaliando} className="btn-primary text-xs py-1.5">
                              <CheckCircle size={13} /> Cumpriu
                            </button>
                          )}
                          <button
                            onClick={() => (recusando === item.id ? avaliar(item, 'nao_cumprido') : setRecusando(item.id))}
                            disabled={avaliando}
                            className={recusando === item.id
                              ? 'btn-primary text-xs py-1.5 !bg-red-600 hover:!bg-red-700'
                              : 'btn-secondary text-xs py-1.5'}
                          >
                            <XCircle size={13} /> {recusando === item.id
                              ? (avaliando ? 'Salvando...' : 'Confirmar não cumpriu')
                              : 'Não cumpriu'}
                          </button>
                          {recusando === item.id && (
                            <button onClick={() => { setRecusando(null); setJustificativa('') }} className="btn-secondary text-xs py-1.5">
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {podeEditar && (
                      <div className="flex gap-1 pt-1">
                        <button onClick={() => abrirEdicao(item)} title="Editar" className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 rounded-lg transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setExcluindo(item)} title="Excluir" className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir atividade"
        message={excluindo ? `Excluir "${excluindo.titulo}" de ${pessoa.name}? Isso não afeta as outras pessoas que receberam a mesma atividade.` : ''}
        confirmLabel="Excluir"
      />
    </>
  )
}

/* ─── Pagina ─── */

export default function Frequencia() {
  const [mes, setMes] = useState(mesAtual())
  const [perfil, setPerfil] = useState('')
  const [busca, setBusca] = useState('')
  const [dados, setDados] = useState(null)
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [atribuindo, setAtribuindo] = useState(false)
  const [pessoaAberta, setPessoaAberta] = useState(null)
  const [baixando, setBaixando] = useState(false)
  const [menuPlanilha, setMenuPlanilha] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/atribuicoes/acompanhamento', { params: { mes, role: perfil || undefined } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null))
      .finally(() => setCarregando(false))
  }, [mes, perfil])

  useEffect(carregar, [carregar])

  useEffect(() => {
    api.get('/atribuicoes/resumo').then(({ data }) => setResumo(data)).catch(() => setResumo(null))
  }, [])

  // Mantem o modal aberto olhando para os dados recem-recarregados: sem isso,
  // editar uma atividade deixaria o modal exibindo a versao anterior.
  useEffect(() => {
    if (!pessoaAberta || !dados) return
    const atualizada = dados.pessoas.find((p) => p.id === pessoaAberta.id)
    setPessoaAberta(atualizada || null)
  }, [dados]) // eslint-disable-line react-hooks/exhaustive-deps

  const pessoasVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const lista = dados?.pessoas || []
    if (!termo) return lista
    return lista.filter((p) => p.name.toLowerCase().includes(termo) || (p.email || '').toLowerCase().includes(termo))
  }, [dados, busca])

  // As opcoes do filtro vem do servidor, e nao dos dados carregados: elas sao os
  // perfis que ESTE usuario alcanca na hierarquia, entao a lista nao encolhe
  // quando um perfil fica sem ninguem no mes, nem cresce alem do que ele pode ver.
  const perfisDisponiveis = dados?.perfis || []

  const baixarPlanilha = async (formato = 'matriz') => {
    setBaixando(true)
    try {
      const resposta = await api.get('/atribuicoes/relatorio', {
        params: { mes, role: perfil || undefined, formato },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `frequencia-${mes}${perfil ? `-${perfil}` : ''}${formato === 'detalhado' ? '-detalhado' : ''}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast('Planilha baixada.')
    } catch (e) {
      showToast(getApiErrorMessage(e, 'Erro ao baixar a planilha.'), 'error')
    } finally {
      setBaixando(false)
      setMenuPlanilha(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Frequência</h1>
          <p className="page-subtitle">Atividades atribuídas no mês e o que cada pessoa cumpriu.</p>
        </div>
        <div className="flex items-center gap-2">
          {resumo?.podeExportar && (
            <div className="relative">
              <button
                onClick={() => setMenuPlanilha((aberto) => !aberto)}
                disabled={baixando || !dados?.total}
                title={!dados?.total ? 'Nada atribuído neste mês' : 'Baixar a planilha do mês'}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                <Download size={14} /> {baixando ? 'Gerando...' : 'Baixar planilha'}
              </button>

              {/* Dois formatos porque sao duas leituras diferentes, e nao duas
                  versoes da mesma: a matriz responde "como foi o mes", a
                  detalhada responde "o que o avaliador escreveu". */}
              {menuPlanilha && !baixando && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuPlanilha(false)} />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() => baixarPlanilha('matriz')}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                      <span className="block text-sm font-medium text-gray-800">Frequência do mês</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Uma linha por pessoa, atividades nas colunas.
                      </span>
                    </button>
                    <button
                      onClick={() => baixarPlanilha('detalhado')}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="block text-sm font-medium text-gray-800">Detalhada</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Uma linha por atividade, com datas e justificativas.
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={() => setAtribuindo(true)} className="btn-primary text-sm">
            <Plus size={14} /> Atribuir atividade
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          iconBg="bg-brand-100"
          iconColor="text-brand-700"
          value={`${dados?.frequencia ?? 0}%`}
          label="Frequência do mês"
          sublabel={rotuloMes(mes)}
          loading={carregando}
        />
        <StatCard
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          value={`${dados?.cumpridas ?? 0}/${dados?.total ?? 0}`}
          label="Atividades cumpridas"
          sublabel={dados?.naoCumpridas ? `${dados.naoCumpridas} não cumprida${dados.naoCumpridas !== 1 ? 's' : ''}` : 'Nenhuma reprovada'}
          loading={carregando}
        />
        <StatCard
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          value={dados?.aguardando ?? 0}
          label="Aguardando avaliação"
          sublabel={`${dados?.aFazer ?? 0} ainda não marcada${dados?.aFazer !== 1 ? 's' : ''}`}
          loading={carregando}
        />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Mês</label>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1 min-w-[170px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Perfil</label>
            <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="select-field">
              <option value="">Todos os perfis</option>
              {perfisDisponiveis.map(({ role, label }) => (
                <option key={role} value={role}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Buscar pessoa</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} className="input-field pl-9" placeholder="Nome ou e-mail" />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-4">Pessoa</th>
                <th className="table-header px-4 w-40">Perfil</th>
                <th className="table-header px-4 w-36">Atividades</th>
                <th className="table-header px-4 w-52">Frequência</th>
                <th className="table-header px-4 w-44">Pendências</th>
                <th className="table-header px-4 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {pessoasVisiveis.map((pessoa) => {
                const cor = corDaFrequencia(pessoa.frequencia)
                return (
                  <tr key={pessoa.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {iniciais(pessoa.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-800 truncate max-w-[220px]">{pessoa.name}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[220px]">{pessoa.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell px-4"><Badge status={pessoa.role} /></td>
                    <td className="table-cell px-4">
                      <span className="font-semibold text-gray-800">{pessoa.cumpridas}/{pessoa.total}</span>
                      <span className="text-xs text-gray-400"> cumpridas</span>
                    </td>
                    <td className="table-cell px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden min-w-[70px]">
                          <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${pessoa.frequencia}%` }} />
                        </div>
                        <span className={`text-sm font-semibold tabular-nums ${cor.texto}`}>{pessoa.frequencia}%</span>
                      </div>
                    </td>
                    <td className="table-cell px-4">
                      <div className="flex flex-wrap gap-1">
                        {pessoa.aFazer > 0 && <Badge status="a_fazer" className="!text-[10px]" />}
                        {pessoa.aguardando > 0 && <Badge status="aguardando_avaliacao" className="!text-[10px]" />}
                        {pessoa.naoCumpridas > 0 && <Badge status="nao_cumprido" className="!text-[10px]" />}
                        {pessoa.aFazer === 0 && pessoa.aguardando === 0 && pessoa.naoCumpridas === 0 && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell px-4">
                      <button
                        onClick={() => setPessoaAberta(pessoa)}
                        title="Ver atividades"
                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!carregando && pessoasVisiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-12">
                    <Users size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">
                      {busca || perfil ? 'Ninguém encontrado com esses filtros.' : `Nada atribuído em ${rotuloMes(mes)}.`}
                    </p>
                    {!busca && !perfil && (
                      <p className="text-xs text-gray-400 mt-1">Use “Atribuir atividade” para começar o mês.</p>
                    )}
                  </td>
                </tr>
              )}
              {carregando && (
                <tr><td colSpan={6} className="table-cell text-center py-12 text-sm text-gray-400">Carregando...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalAtribuir
        open={atribuindo}
        onClose={() => setAtribuindo(false)}
        onSalvo={carregar}
        showToast={showToast}
      />

      {pessoaAberta && (
        <ModalPessoa
          pessoa={pessoaAberta}
          mes={mes}
          onClose={() => setPessoaAberta(null)}
          onMudou={carregar}
          showToast={showToast}
          podeEditar={resumo?.podeAtribuir}
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
