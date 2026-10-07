import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, LifeBuoy, MessageSquare, RefreshCw, Search, Send, StickyNote, UserCheck } from 'lucide-react'
import api from '../lib/api'
import Modal from '../components/ui/Modal'
import { NOMES_DE_PERFIL } from '../lib/perfil'
import { CATEGORIAS, CLASSE_DO_STATUS, STATUS, formatarDataHora } from '../lib/suporte'

/**
 * A fila de chamados de Suporte.
 *
 * Mesma tela para os dois publicos -- quem gere o suporte e quem recebeu um
 * encaminhamento. O servidor ja devolve so o que cada um pode ver e diz, no
 * detalhe, quais acoes estao liberadas; a tela apenas desenha.
 */

const ROTULO_DO_HISTORICO = {
  abertura: 'Abertura',
  status: 'Status',
  encaminhamento: 'Encaminhamento',
  nota: 'Nota interna',
  resposta: 'Resposta ao solicitante',
  email: 'E-mail',
}

const COR_DO_HISTORICO = {
  abertura: 'bg-brand-500',
  status: 'bg-amber-500',
  encaminhamento: 'bg-blue-500',
  nota: 'bg-gray-400',
  resposta: 'bg-green-500',
  email: 'bg-gray-300',
}

function erroDe(e, padrao) {
  return e?.response?.data?.message || padrao
}

function destinoDe(chamado) {
  if (chamado.responsavelNome) return chamado.responsavelNome
  if (chamado.encaminhadoPerfil) return NOMES_DE_PERFIL[chamado.encaminhadoPerfil] || chamado.encaminhadoPerfil
  return null
}

/** CSV do recorte atual, para quem quiser levar a fila para uma planilha. */
function exportarCsv(chamados) {
  const cabecalho = ['Protocolo', 'Aberto em', 'Nome', 'E-mail', 'Categoria', 'Status', 'Encaminhado para', 'Atualizado em', 'Descrição', 'Resolução']
  const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const linhas = chamados.map((c) => [
    c.protocolo, formatarDataHora(c.criadoEm), c.nome, c.email, CATEGORIAS[c.categoria], STATUS[c.status],
    destinoDe(c) || '', formatarDataHora(c.atualizadoEm), c.descricao, c.resolucao || '',
  ].map(celula).join(';'))
  const blob = new Blob([`﻿${[cabecalho.map(celula).join(';'), ...linhas].join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chamados-suporte-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Detalhe({ id, pessoas, aoMudar }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const [encaminhamento, setEncaminhamento] = useState({ perfil: '', responsavelId: '', observacao: '' })
  const [novoStatus, setNovoStatus] = useState({ status: '', mensagem: '', notificar: true })
  const [mensagem, setMensagem] = useState({ tipo: 'resposta', texto: '' })

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/suporte/chamados/${id}`)
      setDados(data)
      setEncaminhamento({
        perfil: data.chamado.encaminhadoPerfil || '',
        responsavelId: data.chamado.responsavelId ? String(data.chamado.responsavelId) : '',
        observacao: '',
      })
      setErro('')
    } catch (e) {
      setErro(erroDe(e, 'Não foi possível abrir o chamado.'))
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const executar = async (acao, sucesso) => {
    setOcupado(true)
    setErro('')
    setAviso('')
    try {
      await acao()
      await carregar()
      aoMudar()
      setAviso(sucesso)
      return true
    } catch (e) {
      setErro(erroDe(e, 'Não foi possível concluir.'))
      return false
    } finally {
      setOcupado(false)
    }
  }

  const pessoasDoPerfil = useMemo(
    () => (pessoas?.pessoas || []).filter((p) => !encaminhamento.perfil || p.perfil === encaminhamento.perfil),
    [pessoas, encaminhamento.perfil],
  )

  if (!dados) {
    return erro
      ? <p className="text-sm text-red-700">{erro}</p>
      : <p className="text-sm text-gray-500">Carregando...</p>
  }

  const { chamado, historico, permissoes } = dados
  const statusPossiveis = permissoes.status.filter((s) => s !== chamado.status)
  const encerrando = novoStatus.status === 'resolvido' || novoStatus.status === 'cancelado'

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Esquerda: o chamado e o que aconteceu com ele */}
      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${CLASSE_DO_STATUS[chamado.status]}`}>{STATUS[chamado.status]}</span>
          <span className="badge badge-info">{CATEGORIAS[chamado.categoria]}</span>
          {destinoDe(chamado) && <span className="badge badge-neutral">Com: {destinoDe(chamado)}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Solicitante</dt><dd className="font-medium text-gray-900">{chamado.nome}</dd>
          <dt className="text-gray-500">CPF</dt><dd className="font-medium text-gray-900">{chamado.cpf}</dd>
          <dt className="text-gray-500">E-mail</dt><dd className="font-medium text-gray-900 break-all">{chamado.email}</dd>
          <dt className="text-gray-500">Aberto em</dt><dd className="text-gray-900">{formatarDataHora(chamado.criadoEm)}</dd>
          {chamado.resolvidoEm && (<><dt className="text-gray-500">Resolvido em</dt><dd className="text-gray-900">{formatarDataHora(chamado.resolvidoEm)}</dd></>)}
        </dl>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Descrição</h3>
          <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3.5 text-sm text-gray-800">{chamado.descricao}</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Histórico</h3>
          <ol className="space-y-3">
            {historico.map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${COR_DO_HISTORICO[h.tipo]}`} />
                <div className="min-w-0 text-sm">
                  <div className="text-xs text-gray-500">
                    {formatarDataHora(h.criadoEm)} · {ROTULO_DO_HISTORICO[h.tipo]}
                    {h.autorNome && <> · {h.autorNome}</>}
                    {h.publico && h.tipo !== 'abertura' && <span className="ml-1 text-green-700">(visível ao solicitante)</span>}
                  </div>
                  {h.mensagem && <p className="whitespace-pre-line text-gray-800">{h.mensagem}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Direita: as acoes que o servidor liberou */}
      <div className="space-y-5 min-w-0">
        {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}
        {aviso && <p className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>}

        {permissoes.encaminhar && (
          <section className="rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><UserCheck size={15} /> Encaminhar</h3>
            <select
              className="select-field"
              value={encaminhamento.perfil}
              onChange={(e) => setEncaminhamento((s) => ({ ...s, perfil: e.target.value, responsavelId: '' }))}
            >
              <option value="">Sem encaminhamento</option>
              {(pessoas?.perfis || []).map((p) => <option key={p} value={p}>{NOMES_DE_PERFIL[p] || p}</option>)}
            </select>
            <select
              className="select-field"
              value={encaminhamento.responsavelId}
              onChange={(e) => setEncaminhamento((s) => ({ ...s, responsavelId: e.target.value }))}
              disabled={!encaminhamento.perfil}
            >
              <option value="">Qualquer pessoa do perfil</option>
              {pessoasDoPerfil.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <textarea
              className="input-field"
              rows={2}
              placeholder="Observação para quem vai resolver (opcional)"
              value={encaminhamento.observacao}
              onChange={(e) => setEncaminhamento((s) => ({ ...s, observacao: e.target.value }))}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={ocupado}
              onClick={() => executar(
                () => api.patch(`/suporte/chamados/${id}/encaminhar`, {
                  perfil: encaminhamento.perfil || null,
                  responsavelId: encaminhamento.responsavelId ? Number(encaminhamento.responsavelId) : null,
                  observacao: encaminhamento.observacao,
                }),
                'Encaminhamento salvo.',
              )}
            >
              Salvar encaminhamento
            </button>
          </section>
        )}

        {statusPossiveis.length > 0 && (
          <section className="rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Mudar status</h3>
            <select
              className="select-field"
              value={novoStatus.status}
              onChange={(e) => setNovoStatus((s) => ({ ...s, status: e.target.value }))}
            >
              <option value="">Escolha o novo status</option>
              {statusPossiveis.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
            </select>
            {novoStatus.status && (
              <>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder={novoStatus.status === 'resolvido'
                    ? 'Descreva a solução (obrigatório: vai no e-mail ao solicitante)'
                    : 'Mensagem (opcional; visível ao solicitante na consulta do protocolo)'}
                  value={novoStatus.mensagem}
                  onChange={(e) => setNovoStatus((s) => ({ ...s, mensagem: e.target.value }))}
                />
                {encerrando && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={novoStatus.notificar}
                      onChange={(e) => setNovoStatus((s) => ({ ...s, notificar: e.target.checked }))}
                    />
                    Avisar o solicitante por e-mail
                  </label>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={ocupado}
                  onClick={async () => {
                    const ok = await executar(
                      () => api.patch(`/suporte/chamados/${id}/status`, novoStatus),
                      `Status alterado para ${STATUS[novoStatus.status]}.`,
                    )
                    if (ok) setNovoStatus({ status: '', mensagem: '', notificar: true })
                  }}
                >
                  Aplicar status
                </button>
              </>
            )}
          </section>
        )}

        <section className="rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            {[
              ['resposta', 'Responder solicitante', MessageSquare],
              ['nota', 'Nota interna', StickyNote],
            ].map(([tipo, rotulo, Icone]) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setMensagem((m) => ({ ...m, tipo }))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition ${mensagem.tipo === tipo ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}
              >
                <Icone size={14} /> {rotulo}
              </button>
            ))}
          </div>
          <textarea
            className="input-field"
            rows={4}
            placeholder={mensagem.tipo === 'resposta'
              ? 'Vai por e-mail para o solicitante e aparece na consulta do protocolo.'
              : 'Só a equipe vê.'}
            value={mensagem.texto}
            onChange={(e) => setMensagem((m) => ({ ...m, texto: e.target.value }))}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={ocupado || !mensagem.texto.trim()}
            onClick={async () => {
              const rota = mensagem.tipo === 'resposta' ? 'respostas' : 'notas'
              const ok = await executar(
                () => api.post(`/suporte/chamados/${id}/${rota}`, { mensagem: mensagem.texto }),
                mensagem.tipo === 'resposta' ? 'Resposta enviada ao solicitante.' : 'Nota registrada.',
              )
              if (ok) setMensagem((m) => ({ ...m, texto: '' }))
            }}
          >
            <Send size={14} /> {mensagem.tipo === 'resposta' ? 'Enviar resposta' : 'Salvar nota'}
          </button>
        </section>
      </div>
    </div>
  )
}

export default function Atendimentos() {
  const [filtros, setFiltros] = useState({ status: 'pendentes', categoria: '', perfil: '', busca: '' })
  const [busca, setBusca] = useState('')
  const [dados, setDados] = useState({ chamados: [], totais: {}, gere: false })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null)
  const [pessoas, setPessoas] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v))
      const { data } = await api.get('/suporte/chamados', { params })
      setDados(data)
      setErro('')
    } catch (e) {
      setErro(erroDe(e, 'Não foi possível carregar os chamados.'))
    } finally {
      setCarregando(false)
    }
  }, [filtros])

  useEffect(() => { carregar() }, [carregar])

  // A busca espera a pessoa parar de digitar, para nao consultar a cada letra.
  useEffect(() => {
    const t = setTimeout(() => setFiltros((f) => (f.busca === busca ? f : { ...f, busca })), 350)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => {
    if (!dados.gere || pessoas) return
    api.get('/suporte/pessoas').then(({ data }) => setPessoas(data)).catch(() => {})
  }, [dados.gere, pessoas])

  const totalPendentes = ['aberto', 'em_andamento', 'aguardando_solicitante']
    .reduce((s, k) => s + (dados.totais[k] || 0), 0)

  const cartoes = [
    ['pendentes', 'Pendentes', totalPendentes],
    ['aberto', STATUS.aberto, dados.totais.aberto || 0],
    ['em_andamento', STATUS.em_andamento, dados.totais.em_andamento || 0],
    ['aguardando_solicitante', 'Aguardando', dados.totais.aguardando_solicitante || 0],
    ['resolvido', STATUS.resolvido, dados.totais.resolvido || 0],
    ['', 'Todos', Object.values(dados.totais).reduce((s, n) => s + n, 0)],
  ]

  const chamadoAberto = dados.chamados.find((c) => c.id === aberto)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2"><LifeBuoy size={22} /> Suporte</h1>
          <p className="page-subtitle">
            {dados.gere
              ? 'Todos os chamados abertos pelo formulário público de suporte.'
              : 'Chamados de suporte encaminhados a você ou ao seu perfil.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => exportarCsv(dados.chamados)} disabled={!dados.chamados.length}>
            <Download size={14} /> Exportar CSV
          </button>
          <button type="button" className="btn-secondary" onClick={carregar}>
            <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cartoes.map(([valor, rotulo, total]) => (
          <button
            key={rotulo}
            type="button"
            onClick={() => setFiltros((f) => ({ ...f, status: valor }))}
            className={`card !p-4 text-left transition ${filtros.status === valor ? 'ring-2 ring-brand-500' : 'hover:shadow-md'}`}
          >
            <span className="block text-xs font-medium text-gray-500">{rotulo}</span>
            <span className="block text-2xl font-bold text-gray-900">{total}</span>
          </button>
        ))}
      </div>

      <div className="card !p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field !pl-9"
            placeholder="Buscar por protocolo, nome, e-mail ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="select-field !w-auto" value={filtros.categoria} onChange={(e) => setFiltros((f) => ({ ...f, categoria: e.target.value }))}>
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        {dados.gere && (
          <select className="select-field !w-auto" value={filtros.perfil} onChange={(e) => setFiltros((f) => ({ ...f, perfil: e.target.value }))}>
            <option value="">Qualquer encaminhamento</option>
            <option value="sem_encaminhamento">Sem encaminhamento</option>
            {(pessoas?.perfis || []).map((p) => <option key={p} value={p}>{NOMES_DE_PERFIL[p] || p}</option>)}
          </select>
        )}
      </div>

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

      <div className="card !p-0 overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className="table-header">Protocolo</th>
              <th className="table-header">Aberto em</th>
              <th className="table-header">Solicitante</th>
              <th className="table-header">Categoria</th>
              <th className="table-header">Status</th>
              <th className="table-header">Encaminhado para</th>
              <th className="table-header">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dados.chamados.map((c) => (
              <tr key={c.id} onClick={() => setAberto(c.id)} className="cursor-pointer hover:bg-brand-50/40">
                <td className="table-cell font-semibold text-gray-900">{c.protocolo}</td>
                <td className="table-cell whitespace-nowrap">{formatarDataHora(c.criadoEm)}</td>
                <td className="table-cell">
                  <span className="block font-medium text-gray-900">{c.nome}</span>
                  <span className="block text-gray-500">{c.email}</span>
                </td>
                <td className="table-cell">{CATEGORIAS[c.categoria]}</td>
                <td className="table-cell"><span className={`badge ${CLASSE_DO_STATUS[c.status]}`}>{STATUS[c.status]}</span></td>
                <td className="table-cell">{destinoDe(c) || <span className="text-gray-400">—</span>}</td>
                <td className="table-cell whitespace-nowrap">{formatarDataHora(c.atualizadoEm)}</td>
              </tr>
            ))}
            {!carregando && !dados.chamados.length && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">Nenhum chamado neste filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(aberto)}
        onClose={() => setAberto(null)}
        title={chamadoAberto ? `Chamado ${chamadoAberto.protocolo}` : 'Chamado'}
        size="xl"
      >
        {aberto && <Detalhe id={aberto} pessoas={pessoas} aoMudar={carregar} />}
      </Modal>
    </div>
  )
}
