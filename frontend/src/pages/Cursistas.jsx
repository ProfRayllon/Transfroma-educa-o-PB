import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, Download, FileSpreadsheet, Filter,
  KeyRound, Loader2, Lock, MailX, Pencil, Search, ShieldAlert, Trash2, Upload,
  UserCheck, UserPlus, Users,
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Modal from '../components/ui/Modal'
import FormularioCursista from '../components/cursistas/FormularioCursista'
import api, { getApiErrorMessage } from '../lib/api'

const SITUACOES = [
  { value: '', label: 'Todas as situações' },
  { value: 'pendente_primeiro_acesso', label: 'Nunca acessou' },
  { value: 'pendente_confirmacao', label: 'Acessou, cadastro incompleto' },
  { value: 'completo', label: 'Cadastro confirmado' },
]

// Filtro de origem: e o que permite achar, no meio de treze mil importados, os
// cadastros que a coordenacao criou a mao -- para conferir ou desfazer.
const ORIGENS = [
  { value: '', label: 'Toda a base' },
  { value: 'importado', label: 'Veio da planilha' },
  { value: 'manual', label: 'Criado a mão' },
]

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function Indicador({ icon: Icon, valor, label, cor = 'brand', destaque }) {
  const cores = {
    brand: 'bg-brand-100 text-brand-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cores[cor]}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold leading-tight ${destaque ? 'text-amber-600' : 'text-gray-900'}`}>{valor}</div>
        <div className="text-xs text-gray-500 leading-tight">{label}</div>
      </div>
    </div>
  )
}

const SITUACAO_CURSO = {
  aberto: { texto: 'Inscrições abertas', cls: 'bg-green-50 text-green-700 border-green-200' },
  em_breve: { texto: 'Abre em breve', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  encerrado: { texto: 'Encerrado', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  fechado: { texto: 'Sem data definida', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const formatarQuando = (valor) =>
  valor ? new Date(valor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

/**
 * Inscritos por curso, com download individual da planilha.
 *
 * Mostra todo curso cadastrado, inclusive os sem inscrito e sem data: e por aqui
 * que a coordenacao percebe que um curso ficou sem janela configurada e por isso
 * nao aparece para inscricao.
 */
function InscricoesPorCurso({ cursos, edicao, aoExportar, exportando }) {
  const totalInscritos = cursos.reduce((soma, c) => soma + c.inscritos, 0)
  const semJanela = cursos.filter((c) => c.situacao === 'fechado').length

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Inscrições por curso</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Edição {edicao} · {totalInscritos.toLocaleString('pt-BR')} {totalInscritos === 1 ? 'inscrição' : 'inscrições'}
          </p>
        </div>
        <button
          onClick={() => aoExportar(null)}
          disabled={Boolean(exportando) || totalInscritos === 0}
          className="btn-secondary text-xs disabled:opacity-40"
          title={totalInscritos === 0 ? 'Nenhuma inscrição para exportar' : 'Baixar todos os cursos num arquivo'}
        >
          <Download size={13} />
          {exportando === 'todos' ? 'Gerando...' : 'Baixar tudo'}
        </button>
      </div>

      {semJanela > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mt-3">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {semJanela === 1
              ? '1 curso está sem data de inscrição e não aparece para os cursistas.'
              : `${semJanela} cursos estão sem data de inscrição e não aparecem para os cursistas.`}{' '}
            Defina as datas na tela de Cursos.
          </span>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {cursos.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">Nenhum curso cadastrado.</p>
        )}
        {cursos.map((curso) => {
          const sit = SITUACAO_CURSO[curso.situacao] || SITUACAO_CURSO.fechado
          return (
            <div key={curso.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{curso.name}</div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className={`badge border ${sit.cls}`}>{sit.texto}</span>
                  {curso.situacao !== 'fechado' && (
                    <span className="text-[11px] text-gray-400">
                      {formatarQuando(curso.enrollmentOpensAt)} até {formatarQuando(curso.enrollmentClosesAt)}
                    </span>
                  )}
                  {curso.cancelados > 0 && (
                    <span className="text-[11px] text-gray-400">{curso.cancelados} cancelada(s)</span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold leading-none text-gray-900">{curso.inscritos}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-400">inscritos</div>
              </div>

              <button
                onClick={() => aoExportar(curso)}
                disabled={Boolean(exportando) || curso.inscritos === 0}
                className="btn-secondary text-xs flex-shrink-0 disabled:opacity-30"
                title={curso.inscritos === 0 ? 'Nenhum inscrito neste curso' : 'Baixar a planilha deste curso'}
              >
                <Download size={13} />
                {exportando === curso.id ? '...' : 'Planilha'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Barra de adesão: quanto da base já passou por cada etapa. */
function Adesao({ cadastro }) {
  const total = cadastro.total || 1
  const etapas = [
    { label: 'Cadastro confirmado', valor: cadastro.cadastrosConfirmados, cor: '#16a34a' },
    { label: 'Criou senha, falta completar', valor: Math.max(0, cadastro.comSenhaDefinida - cadastro.cadastrosConfirmados), cor: '#eab308' },
    { label: 'Nunca acessou', valor: cadastro.pendentesPrimeiroAcesso, cor: '#cbd5e1' },
  ]
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Adesão da base</h3>
      <p className="text-xs text-gray-500 mb-4">{cadastro.total.toLocaleString('pt-BR')} cursistas cadastrados</p>

      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-4">
        {etapas.map((e) => (
          e.valor > 0 && (
            <div key={e.label} style={{ width: `${(e.valor / total) * 100}%`, backgroundColor: e.cor }} title={`${e.label}: ${e.valor}`} />
          )
        ))}
      </div>

      <div className="space-y-2">
        {etapas.map((e) => (
          <div key={e.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: e.cor }} />
            <span className="flex-1 text-gray-600">{e.label}</span>
            <span className="font-semibold text-gray-800">{e.valor.toLocaleString('pt-BR')}</span>
            <span className="text-gray-400 w-11 text-right">({Math.round((e.valor / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Cursistas() {
  const [estatisticas, setEstatisticas] = useState(null)
  const [resumoCursos, setResumoCursos] = useState(null)
  const [lista, setLista] = useState({ items: [], total: 0, page: 1, perPage: 50 })
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [origem, setOrigem] = useState('')
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  const [importando, setImportando] = useState(false)
  /**
   * Andamento da importacao.
   *
   * `fase: 'enviando'` traz o percentual real do upload, que o axios reporta.
   * `fase: 'processando'` nao tem percentual -- o servidor grava tudo numa
   * transacao e nao ha como saber o meio do caminho -- entao mostra o tempo
   * decorrido. Com treze mil linhas a espera passa de um minuto, e um botao
   * cinza por um minuto nao diz se esta trabalhando, travou ou morreu.
   */
  const [progresso, setProgresso] = useState(null)
  const [resultadoImport, setResultadoImport] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [confirmarReset, setConfirmarReset] = useState(null)
  const arquivoRef = useRef(null)

  // `null` = fechado; `{ id }` = editando; `{ id: null }` = criando.
  const [formulario, setFormulario] = useState(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(null)

  const mostrar = (tipo, texto) => {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 5000)
  }

  const carregarEstatisticas = useCallback(async () => {
    try {
      const { data } = await api.get('/cursistas/admin/estatisticas')
      setEstatisticas(data)
    } catch (error) {
      mostrar('erro', getApiErrorMessage(error, 'Erro ao carregar o painel.'))
    }
  }, [])

  const carregarLista = useCallback(async () => {
    setCarregando(true)
    try {
      // POST, e nao GET com query string: o termo pode ser um CPF, e a URL
      // completa iria para o access.log do nginx e para o historico do navegador.
      const { data } = await api.post('/cursistas/admin/cursistas/buscar', {
        search: busca, situacao, origem, page: pagina, perPage: 50,
      })
      setLista(data)
    } catch (error) {
      mostrar('erro', getApiErrorMessage(error, 'Erro ao carregar os cursistas.'))
    } finally {
      setCarregando(false)
    }
  }, [busca, situacao, origem, pagina])

  const carregarResumoCursos = useCallback(async () => {
    try {
      const { data } = await api.get('/cursistas/admin/inscricoes/resumo')
      setResumoCursos(data)
    } catch (error) {
      mostrar('erro', getApiErrorMessage(error, 'Erro ao carregar as inscrições por curso.'))
    }
  }, [])

  useEffect(() => { carregarEstatisticas() }, [carregarEstatisticas])
  useEffect(() => { carregarLista() }, [carregarLista])
  useEffect(() => { carregarResumoCursos() }, [carregarResumoCursos])

  const importar = async (event) => {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return

    setImportando(true)
    setResultadoImport(null)
    setProgresso({ fase: 'enviando', percentual: 0, segundos: 0 })

    const inicio = Date.now()
    const relogio = setInterval(() => {
      setProgresso((atual) => (atual ? { ...atual, segundos: Math.floor((Date.now() - inicio) / 1000) } : atual))
    }, 1000)

    try {
      // Envia os bytes do .xlsx direto; base64 inflaria o arquivo em 33% a toa.
      const { data } = await api.post('/cursistas/admin/cursistas/importar', arquivo, {
        headers: { 'Content-Type': TIPO_XLSX },
        onUploadProgress: (evento) => {
          const percentual = evento.total ? Math.round((evento.loaded * 100) / evento.total) : 0
          setProgresso((atual) => ({
            ...atual,
            // Terminado o envio, o que resta e o servidor gravando.
            fase: percentual >= 100 ? 'processando' : 'enviando',
            percentual,
          }))
        },
      })
      setResultadoImport(data)
      await Promise.all([carregarEstatisticas(), carregarLista()])
    } catch (error) {
      /**
       * Conexao perdida nao quer dizer importacao perdida.
       *
       * O nginx corta a conexao que passa de 60 s, mas o servidor continua e a
       * transacao commita do mesmo jeito. Anunciar "erro ao importar" faria a
       * coordenacao repetir a carga achando que nada entrou -- ou pior, achar
       * que a base ficou pela metade. Sem resposta do servidor, a unica coisa
       * honesta a dizer e que nao deu para saber, e onde conferir.
       */
      const status = error.response?.status

      if (!error.response) {
        await Promise.all([carregarEstatisticas(), carregarLista()])
        mostrar('erro', 'A conexão caiu antes da resposta, mas a importação pode ter concluído no servidor. Confira o total em "Cursistas na base" — se estiver certo, não precisa repetir. Repetir também é seguro: a importação é por CPF e não duplica ninguém.')
      } else if (status === 413) {
        /**
         * 413 vem do nginx, nao da API: e uma pagina HTML de erro, sem o campo
         * `message` que a tela le. Sem este caso, o arquivo grande demais dava
         * "Erro ao importar a base" -- que nao diz o que houve nem o que fazer,
         * e manda a pessoa procurar defeito na planilha.
         */
        const mb = (arquivo.size / 1024 / 1024).toFixed(1)
        mostrar('erro', `O arquivo tem ${mb} MB e o servidor aceita até 8 MB. Nada foi importado. Salve a planilha sem formatação, imagens ou abas extras — a base de 13 mil linhas costuma ficar perto de 2 MB.`)
      } else {
        mostrar('erro', getApiErrorMessage(error, 'Erro ao importar a base.'))
      }
    } finally {
      clearInterval(relogio)
      setImportando(false)
      setProgresso(null)
      if (arquivoRef.current) arquivoRef.current.value = ''
    }
  }

  /**
   * Baixa a planilha de inscritos. Sem `curso`, traz a edicao inteira.
   *
   * O arquivo carrega o CPF de todos os inscritos, entao o backend restringe a
   * administrador e registra cada download na trilha de auditoria.
   */
  const exportar = async (curso = null) => {
    setExportando(curso ? curso.id : 'todos')
    try {
      const resposta = await api.get('/cursistas/admin/inscricoes/exportar', {
        params: curso ? { courseId: curso.id } : {},
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      // Nome de arquivo a partir do nome do curso: separa o acento da letra
      // (NFD), remove as marcas por faixa unicode explicita -- escrever os
      // caracteres combinantes direto na regex os deixa invisiveis no editor --
      // e troca o resto por hifen.
      const sufixo = curso
        ? curso.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
        : 'todos-os-cursos'
      link.download = `inscritos-${sufixo}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      mostrar('ok', 'Planilha gerada. O download foi registrado na trilha de auditoria.')
    } catch (error) {
      mostrar('erro', getApiErrorMessage(error, 'Erro ao gerar a planilha.'))
    } finally {
      setExportando(false)
    }
  }

  const resetar = async () => {
    if (!confirmarReset) return
    try {
      await api.post(`/cursistas/admin/cursistas/${confirmarReset.id}/resetar-senha`)
      mostrar('ok', `Senha de ${confirmarReset.name} resetada. A conta volta ao primeiro acesso: entra com a senha padrão e define uma nova.`)
      await Promise.all([carregarEstatisticas(), carregarLista()])
    } catch (error) {
      mostrar('erro', getApiErrorMessage(error, 'Erro ao resetar a senha.'))
    } finally {
      setConfirmarReset(null)
    }
  }

  const aoSalvarCadastro = async (cursista, { criado }) => {
    mostrar('ok', criado
      ? `${cursista.name} cadastrado. Ele acessa com o CPF e a senha padrão.`
      : `Cadastro de ${cursista.name} atualizado.${cursista.cpfAlterado ? ' O CPF de acesso mudou — avise-o.' : ''}`)
    await Promise.all([carregarEstatisticas(), carregarLista()])
  }

  /**
   * Exclui o cadastro, em dois passos quando ha inscricoes.
   *
   * O backend recusa com 409 na primeira tentativa se o cursista tem inscricao,
   * informando quantas. A tela reabre a confirmacao dizendo o numero -- e a
   * unica parte da exclusao que nao volta, entao quem confirma precisa saber o
   * que esta perdendo antes, e nao depois.
   */
  const excluir = async (cursista, confirmandoInscricoes = false) => {
    try {
      await api.delete(`/cursistas/admin/cursistas/${cursista.id}`, {
        params: confirmandoInscricoes ? { confirmarInscricoes: 'true' } : {},
      })
      mostrar('ok', `Cadastro de ${cursista.name} excluído.`)
      await Promise.all([carregarEstatisticas(), carregarLista(), carregarResumoCursos()])
    } catch (error) {
      const dados = error.response?.data
      if (error.response?.status === 409 && dados?.precisaConfirmarInscricoes) {
        setConfirmarExclusao({ cursista, dependencias: dados.dependencias })
        return
      }
      mostrar('erro', getApiErrorMessage(error, 'Erro ao excluir o cadastro.'))
    }
  }

  const situacaoDoCursista = (c) => {
    if (!c.passwordDefined) return { texto: 'Nunca acessou', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    if (!c.cadastroConfirmado) return { texto: 'Cadastro incompleto', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    return { texto: 'Confirmado', cls: 'bg-green-50 text-green-700 border-green-200' }
  }

  const totalPaginas = Math.max(1, Math.ceil(lista.total / lista.perPage))
  const cad = estatisticas?.cadastro

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Cursistas</h1>
          <p className="page-subtitle">Acesso, cadastro e inscrições dos profissionais da rede.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={arquivoRef} type="file" accept=".xlsx" onChange={importar} className="hidden" />
          <button onClick={() => setFormulario({ id: null })} className="btn-secondary text-sm">
            <UserPlus size={14} /> Novo cursista
          </button>
          <button
            onClick={() => arquivoRef.current?.click()}
            disabled={importando}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            <Upload size={14} />
            {importando ? 'Importando...' : 'Importar base (.xlsx)'}
          </button>
          {/* `() => exportar(null)` e nao `exportar`: como handler direto, o
              onClick passaria o evento do clique no lugar do curso. */}
          <button onClick={() => exportar(null)} disabled={Boolean(exportando)} className="btn-primary text-sm disabled:opacity-50">
            <Download size={14} />
            {exportando === 'todos' ? 'Gerando...' : 'Exportar inscritos'}
          </button>
        </div>
      </div>

      {aviso && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border ${
          aviso.tipo === 'erro' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
        }`}>
          {aviso.tipo === 'erro' ? <AlertTriangle size={16} className="mt-0.5" /> : <CheckCircle size={16} className="mt-0.5" />}
          <span>{aviso.texto}</span>
        </div>
      )}

      {progresso && (
        <div className="card border-brand-200 bg-brand-50/40">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={17} className="text-brand-700 animate-spin flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-800">
                {progresso.fase === 'enviando' ? 'Enviando a planilha...' : 'Gravando os cadastros...'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {progresso.fase === 'enviando'
                  ? `${progresso.percentual}% enviado`
                  : 'O servidor está gravando tudo de uma vez. Não feche nem recarregue esta página.'}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold leading-none text-brand-800 tabular-nums">{progresso.segundos}s</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">decorridos</div>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-brand-100 overflow-hidden">
            {progresso.fase === 'enviando' ? (
              <div className="h-full bg-brand-700 transition-all duration-300" style={{ width: `${progresso.percentual}%` }} />
            ) : (
              // Sem percentual: a gravacao e uma transacao unica, e inventar uma
              // barra que avanca sozinha mentiria sobre o andamento.
              <div className="h-full w-1/3 bg-brand-700 animate-pulse" />
            )}
          </div>

          {progresso.fase === 'processando' && progresso.segundos > 25 && (
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Com 13 mil linhas isso leva cerca de um minuto. Se a conexão cair antes da
              resposta, a gravação continua no servidor — basta conferir o total depois.
            </p>
          )}
        </div>
      )}

      {/* Painel de acesso — apenas números agregados, sem identificar ninguém. */}
      {cad && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Indicador icon={Users} valor={cad.total.toLocaleString('pt-BR')} label="Cursistas na base" />
            <Indicador icon={UserCheck} valor={cad.cadastrosConfirmados.toLocaleString('pt-BR')} label="Cadastros confirmados" cor="green" />
            <Indicador icon={Clock} valor={cad.pendentesPrimeiroAcesso.toLocaleString('pt-BR')} label="Nunca acessaram" cor="amber" />
            <Indicador icon={FileSpreadsheet} valor={(estatisticas.inscricoes.cursistasInscritos || 0).toLocaleString('pt-BR')} label="Cursistas inscritos" cor="brand" />
            <Indicador icon={Lock} valor={cad.bloqueadas.toLocaleString('pt-BR')} label="Contas bloqueadas" cor={cad.bloqueadas > 0 ? 'red' : 'gray'} destaque={cad.bloqueadas > 0} />
          </div>

          {resumoCursos && (
            <InscricoesPorCurso
              cursos={resumoCursos.cursos}
              edicao={resumoCursos.edicao}
              aoExportar={exportar}
              exportando={exportando}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Adesao cadastro={cad} />

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Pontos de atenção</h3>
              <p className="text-xs text-gray-500 mb-4">Últimos 7 dias e lacunas de contato.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <ShieldAlert size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-600">Tentativas de acesso sem sucesso</span>
                  <span className="font-semibold text-gray-800">{(estatisticas.seguranca?.login_falha || 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Lock size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-600">Contas que atingiram o bloqueio</span>
                  <span className="font-semibold text-gray-800">{(estatisticas.seguranca?.conta_bloqueada || 0).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <CheckCircle size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-600">Acessaram nos últimos 7 dias</span>
                  <span className="font-semibold text-gray-800">{cad.ativosUltimos7Dias.toLocaleString('pt-BR')}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center gap-2.5 text-sm">
                  <MailX size={15} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-gray-600">Sem nenhum e-mail cadastrado</span>
                  <span className="font-semibold text-gray-800">{cad.semEmail.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
                Este painel mostra apenas totais. Acompanhar a adesão não exige abrir o
                cadastro de ninguém.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">
            Cursistas {lista.total > 0 && <span className="font-normal text-gray-400">· {lista.total.toLocaleString('pt-BR')}</span>}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
                placeholder="Nome, CPF completo ou USR000001"
                className="input-field pl-8 text-xs py-2 w-64"
              />
            </div>
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={situacao}
                onChange={(e) => { setSituacao(e.target.value); setPagina(1) }}
                className="select-field pl-8 text-xs py-2 w-56"
              >
                {SITUACOES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <select
              value={origem}
              onChange={(e) => { setOrigem(e.target.value); setPagina(1) }}
              className="select-field text-xs py-2 w-40"
            >
              {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header px-3">Nome</th>
                <th className="table-header px-3 w-40">CPF</th>
                <th className="table-header px-3 w-28">Matrícula</th>
                <th className="table-header px-3 w-44">Situação</th>
                <th className="table-header px-3 w-36">Último acesso</th>
                <th className="table-header px-3 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan={6} className="table-cell text-center py-10 text-gray-400 text-sm">Carregando...</td></tr>
              ) : lista.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell text-center py-12">
                    <Users size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">
                      {busca || situacao || origem ? 'Nenhum cursista encontrado com esses filtros.' : 'Nenhum cursista na base ainda.'}
                    </p>
                    {!busca && !situacao && !origem && (
                      <p className="text-xs text-gray-400 mt-1">
                        Use "Importar base (.xlsx)" para carregar os cadastros, ou "Novo cursista" para criar um a um.
                      </p>
                    )}
                  </td>
                </tr>
              ) : lista.items.map((c) => {
                const sit = situacaoDoCursista(c)
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-800 truncate max-w-xs" title={c.name}>{c.name}</span>
                        {/* So o cadastro manual ganha etiqueta: marcar os treze mil
                            importados seria ruido em cada linha da tabela. */}
                        {c.origem === 'manual' && (
                          <span className="badge border border-brand-200 bg-brand-50 text-brand-700 flex-shrink-0" title="Criado à mão pela coordenação">
                            manual
                          </span>
                        )}
                      </div>
                      {c.funcao && <div className="text-[11px] text-gray-400 truncate max-w-xs">{c.funcao}</div>}
                    </td>
                    <td className="table-cell px-3 font-mono text-[11px] text-gray-500">{c.cpf}</td>
                    <td className="table-cell px-3 text-gray-500">{c.usuarioId || '—'}</td>
                    <td className="table-cell px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sit.cls}`}>
                        {sit.texto}
                      </span>
                    </td>
                    <td className="table-cell px-3 text-gray-500">
                      {c.lastAccessAt ? new Date(c.lastAccessAt).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="table-cell px-3">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setFormulario({ id: c.id })}
                          title="Editar cadastro"
                          className="p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmarReset(c)}
                          disabled={!c.passwordDefined}
                          title={c.passwordDefined ? 'Resetar senha' : 'Ainda não definiu senha'}
                          className="p-1.5 text-gray-400 hover:bg-brand-50 hover:text-brand-700 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmarExclusao({ cursista: c, dependencias: null })}
                          title="Excluir cadastro"
                          className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Página {lista.page} de {totalPaginas}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={lista.page <= 1} className="btn-secondary text-xs py-1.5 disabled:opacity-40">Anterior</button>
              <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={lista.page >= totalPaginas} className="btn-secondary text-xs py-1.5 disabled:opacity-40">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* Resultado da importação */}
      <Modal
        open={Boolean(resultadoImport)}
        onClose={() => setResultadoImport(null)}
        title="Importação concluída"
        size="md"
        footer={<button onClick={() => setResultadoImport(null)} className="btn-primary">Fechar</button>}
      >
        {resultadoImport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2.5">
                <div className="text-xl font-bold text-green-700">{resultadoImport.inseridos}</div>
                <div className="text-xs text-green-700">novos cadastros</div>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                <div className="text-xl font-bold text-blue-700">{resultadoImport.atualizados}</div>
                <div className="text-xs text-blue-700">atualizados</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <div>Linhas lidas: <strong>{resultadoImport.totalLinhas}</strong></div>
              {resultadoImport.comMultiplosVinculos > 0 && (
                <div>Com mais de uma escola: <strong>{resultadoImport.comMultiplosVinculos}</strong></div>
              )}
              {resultadoImport.semPerfil > 0 && (
                <div className="text-amber-700">Sem par na aba de perfil: <strong>{resultadoImport.semPerfil}</strong></div>
              )}
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600 space-y-1.5">
              <p>
                <strong>A importação soma, não substitui.</strong> Só as linhas do arquivo
                são tocadas — quem já estava na base e não aparece nele continua
                exatamente como estava. Nada é excluído por importação.
              </p>
              <p>
                Quem já tinha senha continua com ela: a importação atualiza o cadastro
                e nunca derruba o acesso de quem já entrou.
              </p>
            </div>

            {resultadoImport.rejeitados > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 mb-2">
                  <AlertTriangle size={15} />
                  {resultadoImport.rejeitados} linha(s) rejeitada(s)
                </div>
                <ul className="text-xs text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                  {resultadoImport.exemplosRejeitados.map((r) => (
                    <li key={r.linha} className="flex gap-2">
                      <span className="text-gray-400 flex-shrink-0">linha {r.linha}:</span>
                      <span>{r.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmarReset)}
        onClose={() => setConfirmarReset(null)}
        onConfirm={resetar}
        title="Resetar senha"
        message={
          confirmarReset
            ? `A conta de ${confirmarReset.name} volta ao primeiro acesso: ele entra com a senha padrão e é obrigado a criar uma nova. Confirma?`
            : ''
        }
        confirmLabel="Resetar"
      />

      <FormularioCursista
        open={Boolean(formulario)}
        cursistaId={formulario?.id || null}
        onClose={() => setFormulario(null)}
        onSalvo={aoSalvarCadastro}
      />

      {/* Duas confirmações: a segunda só aparece quando o backend recusa a
          primeira por haver inscrições, e aí ela diz quantas. */}
      <ConfirmDialog
        open={Boolean(confirmarExclusao)}
        onClose={() => setConfirmarExclusao(null)}
        onConfirm={() => excluir(confirmarExclusao.cursista, Boolean(confirmarExclusao.dependencias))}
        title={confirmarExclusao?.dependencias ? 'Este cursista tem inscrições' : 'Excluir cadastro'}
        message={
          !confirmarExclusao ? '' : confirmarExclusao.dependencias
            ? `${confirmarExclusao.cursista.name} tem ${confirmarExclusao.dependencias.inscricoes} inscrição(ões) registrada(s), que serão apagadas junto e não podem ser recuperadas. Excluir mesmo assim?`
            : `O cadastro de ${confirmarExclusao.cursista.name} será apagado e o CPF ficará livre para um novo cadastro. Isso não pode ser desfeito. Confirma?`
        }
        confirmLabel={confirmarExclusao?.dependencias ? 'Excluir com as inscrições' : 'Excluir'}
      />
    </div>
  )
}
