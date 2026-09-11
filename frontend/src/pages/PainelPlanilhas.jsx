import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, GraduationCap, Star, MapPin, Upload, FileSpreadsheet, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, X, ArrowRight,
} from 'lucide-react'
import api, { getApiErrorMessage } from '../lib/api'

/**
 * Onde as planilhas dos painéis entram no sistema.
 *
 * Duas etapas, como a importação da base de cursistas: CONFERIR lê o arquivo e
 * mostra o que ele vai gravar -- sem gravar nada --, e só então GRAVAR troca o
 * que o painel mostra. É o que pega a planilha do curso errado antes que ela
 * apareça no dashboard da coordenação.
 *
 * Reenviar a mesma planilha, do mesmo curso e da mesma data, atualiza por cima.
 * A tela diz isso na hora de gravar, com a data e o nome de quem enviou a
 * anterior -- substituir é uma decisão, e merece ser tomada sabendo.
 */

const TIPOS = [
  {
    chave: 'consolidado',
    icone: GraduationCap,
    titulo: 'Consolidado do curso',
    descricao: 'Quem concluiu e quem não concluiu, com CPF, GRE e escola.',
    painel: '/painel/concluintes',
    porCurso: true,
    comData: true,
  },
  {
    chave: 'avaliacao',
    icone: Star,
    titulo: 'Avaliação do curso',
    descricao: 'As respostas do formulário de avaliação. Anônimo.',
    painel: '/painel/progresso',
    porCurso: true,
    comData: false,
  },
  {
    chave: 'municipios',
    icone: MapPin,
    titulo: 'Escolas e municípios',
    descricao: 'O código INEP de cada escola com o município. Vale para todos os cursos.',
    painel: '/painel/concluintes',
    porCurso: false,
    comData: false,
  },
]

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dataBr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
const tamanho = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`)
const br = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v)

/**
 * Uma planilha de um curso: quando foi, quanto tinha, quem mandou.
 *
 * Linha, e nao celula de tabela: com o nome do curso numa coluna e as duas
 * planilhas em outras duas, a lista nao cabia ao lado do formulario -- os nomes
 * quebravam em quatro linhas e o botao da ultima coluna saia cortado na borda.
 */
function LinhaDeEnvio({ rotulo, envio, semanas, aoAtualizar }) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1">
      <span className="text-[12px] text-gray-500 dark:text-gray-400">{rotulo}</span>
      {envio ? (
        <span className="min-w-0 text-[12.5px] text-gray-700 dark:text-gray-200 truncate"
          title={`${envio.arquivo} · enviado em ${envio.em}`}>
          <b className="font-semibold tabular-nums">{dataBr(envio.referencia)}</b>
          <span className="text-gray-500 dark:text-gray-400">
            {' '}· {envio.linhas.toLocaleString('pt-BR')} linhas · {envio.por}
            {semanas > 1 ? ` · ${semanas} semanas` : ''}
          </span>
        </span>
      ) : (
        <span className="text-[12.5px] text-gray-400">Nenhuma ainda</span>
      )}
      <button
        type="button"
        onClick={aoAtualizar}
        className="text-[12px] font-medium text-brand-700 dark:text-brand-300 hover:underline"
      >
        {envio ? 'Atualizar' : 'Enviar'}
      </button>
    </div>
  )
}

export default function PainelPlanilhas() {
  const [envios, setEnvios] = useState(null)
  const [erroLista, setErroLista] = useState(null)

  const [tipo, setTipo] = useState('consolidado')
  const [cursoId, setCursoId] = useState('')
  const [referencia, setReferencia] = useState(hoje())
  const [arquivo, setArquivo] = useState(null)

  // 'conferindo' | 'conferido' | 'gravando' | 'gravado'
  const [fase, setFase] = useState(null)
  const [conferencia, setConferencia] = useState(null)
  const [erro, setErro] = useState(null)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef(null)
  const formulario = useRef(null)

  const def = TIPOS.find((t) => t.chave === tipo)

  const carregarEnvios = useCallback(() => {
    api.get('/resultados/envios')
      .then(({ data }) => { setEnvios(data); setErroLista(null) })
      .catch((e) => setErroLista(getApiErrorMessage(e, 'Não foi possível carregar os envios.')))
  }, [])

  useEffect(carregarEnvios, [carregarEnvios])

  /**
   * Qualquer mudança no formulário desfaz a conferência.
   *
   * O botão de gravar reenvia o arquivo com os campos que estão na tela. Se a
   * pessoa conferisse o curso A, trocasse para o B e gravasse, iria para o B
   * uma planilha que ela só viu conferida como A.
   */
  useEffect(() => {
    setConferencia(null)
    setFase(null)
    setErro(null)
  }, [tipo, cursoId, referencia, arquivo])

  // Trocar de tipo limpa o arquivo: a planilha de avaliação não é a do
  // consolidado, e deixá-la escolhida convida ao envio no lugar errado.
  const trocarTipo = (novo) => {
    setTipo(novo)
    setArquivo(null)
    if (entrada.current) entrada.current.value = ''
  }

  const escolherArquivo = (lista) => {
    const f = lista?.[0]
    if (!f) return
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      setErro('Envie a planilha em .xlsx ou .csv. Arquivos .xls antigos precisam ser salvos de novo como .xlsx no Excel.')
      return
    }
    setArquivo(f)
  }

  /** A atalho da tabela: já deixa tipo e curso escolhidos. */
  const prepararEnvio = (novoTipo, novoCurso) => {
    setTipo(novoTipo)
    setCursoId(novoCurso ? String(novoCurso) : '')
    setArquivo(null)
    if (entrada.current) entrada.current.value = ''
    formulario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const parametros = () => ({
    tipo,
    ...(def.porCurso ? { curso: cursoId } : {}),
    referencia: def.comData ? referencia : hoje(),
    arquivo: arquivo?.name,
  })

  const podeConferir = arquivo && (!def.porCurso || cursoId) && (!def.comData || referencia)

  const enviar = async (simular) => {
    setErro(null)
    setFase(simular ? 'conferindo' : 'gravando')
    try {
      // Os bytes vão crus, sem base64 nem formulário: a base enriquecida pesa
      // 5 MB, e base64 inflaria 33% sem ganho nenhum.
      const { data } = await api.post(simular ? '/resultados/conferir' : '/resultados/enviar', arquivo, {
        params: parametros(),
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      setConferencia(data)
      setFase(simular ? 'conferido' : 'gravado')
      if (!simular) carregarEnvios()
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível processar a planilha.'))
      setFase(simular ? null : 'conferido')
    }
  }

  /**
   * O que a gravação vai substituir.
   *
   * Consolidado de outra data não substitui: vira uma semana nova no histórico.
   * Mesma data substitui aquela semana. A avaliação e o de-para sempre trocam o
   * que havia -- e a frase diz qual das três coisas vai acontecer.
   */
  const substituicao = useMemo(() => {
    if (!envios) return null
    if (tipo === 'municipios') {
      return envios.escolas.escolas
        ? `Atualiza a lista atual de ${envios.escolas.escolas.toLocaleString('pt-BR')} escolas: o que mudou é corrigido, o que não está na planilha continua como está.`
        : null
    }
    const curso = envios.cursos.find((c) => String(c.id) === String(cursoId))
    const anterior = curso?.[tipo]
    if (!anterior) return null
    if (tipo === 'consolidado') {
      return anterior.referencia === referencia
        ? `Substitui o consolidado de ${dataBr(anterior.referencia)}, enviado por ${anterior.por}.`
        : `Cria uma semana nova (${dataBr(referencia)}). O consolidado de ${dataBr(anterior.referencia)} continua no histórico de evolução.`
    }
    return `Substitui a avaliação enviada em ${dataBr(anterior.referencia)} por ${anterior.por}.`
  }, [envios, tipo, cursoId, referencia])

  const ocupado = fase === 'conferindo' || fase === 'gravando'

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link to="/painel"
          className="inline-flex items-center gap-1.5 text-[13px] mb-1 text-gray-500 hover:underline">
          <ArrowLeft size={14} />
          Painéis
        </Link>
        <h1 className="page-title">Planilhas dos painéis</h1>
        <p className="page-subtitle max-w-3xl">
          Envie as planilhas de cada curso. Reenviar a mesma planilha, do mesmo curso e da
          mesma data, atualiza os dados por cima.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-5 items-start">
        {/* ─── Envio ─── */}
        <section ref={formulario} className="card space-y-5 scroll-mt-6">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">Enviar planilha</h2>

          <fieldset>
            <legend className="text-[12px] font-medium text-gray-500 mb-2">Que planilha é esta?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TIPOS.map((t) => {
                const ativo = t.chave === tipo
                return (
                  <label
                    key={t.chave}
                    className={`relative flex flex-col gap-1.5 p-3 rounded-xl border cursor-pointer transition-colors
                      ${ativo
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                        : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={t.chave}
                      checked={ativo}
                      onChange={() => trocarTipo(t.chave)}
                      className="sr-only"
                    />
                    <t.icone size={18} className={ativo ? 'text-brand-700 dark:text-brand-300' : 'text-gray-400'} />
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                      {t.titulo}
                    </span>
                    <span className="text-[11.5px] text-gray-500 dark:text-gray-400 leading-snug">{t.descricao}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {(def.porCurso || def.comData) && (
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_180px] gap-3">
              {def.porCurso && (
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1.5">Curso</span>
                  {/* O curso é escolhido, e não deduzido do arquivo: a planilha do
                      Google traz "Google for Educacion", com erro de grafia, e
                      casar pelo nome gravaria resultado no curso errado. */}
                  <select
                    value={cursoId}
                    onChange={(e) => setCursoId(e.target.value)}
                    className="select-field"
                  >
                    <option value="">Escolha o curso…</option>
                    {(envios?.cursos || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </label>
              )}
              {def.comData && (
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1.5">Data de referência</span>
                  <input
                    type="date"
                    value={referencia}
                    max={hoje()}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="input-field"
                  />
                </label>
              )}
            </div>
          )}

          {def.comData && (
            <p className="text-[12px] text-gray-500 dark:text-gray-400 -mt-2">
              O dia a que os números da planilha se referem. Uma data nova vira mais uma
              semana no gráfico de evolução; a mesma data substitui aquela semana.
            </p>
          )}

          {/* Área de arquivo. É um <label> de verdade: clicar em qualquer ponto
              abre o seletor, e o teclado chega nela pelo input escondido. */}
          <label
            onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); escolherArquivo(e.dataTransfer.files) }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors
              focus-within:ring-2 focus-within:ring-brand-500
              ${arrastando ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'}`}
          >
            <input
              ref={entrada}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              onChange={(e) => escolherArquivo(e.target.files)}
            />
            <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-brand-100 dark:bg-brand-900/50">
              {arquivo
                ? <FileSpreadsheet size={19} className="text-brand-700 dark:text-brand-300" />
                : <Upload size={19} className="text-brand-700 dark:text-brand-300" />}
            </span>
            <span className="min-w-0 flex-1">
              {arquivo ? (
                <>
                  <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate">{arquivo.name}</span>
                  <span className="block text-[12px] text-gray-500">{tamanho(arquivo.size)} · clique para trocar</span>
                </>
              ) : (
                <>
                  <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-100">
                    Escolha o arquivo ou arraste para cá
                  </span>
                  <span className="block text-[12px] text-gray-500">
                    .xlsx ou .csv, do jeito que saiu da planilha — não precisa limpar nada
                  </span>
                </>
              )}
            </span>
          </label>

          {erro && (
            <div role="alert" className="flex gap-2.5 p-3 rounded-xl text-[13px] bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {!conferencia && (
            <button
              type="button"
              onClick={() => enviar(true)}
              disabled={!podeConferir || ocupado}
              className="btn-primary justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fase === 'conferindo'
                ? <><Loader2 size={16} className="animate-spin" /> Lendo a planilha…</>
                : 'Conferir planilha'}
            </button>
          )}

          {/* ─── Conferência / resultado ─── */}
          {conferencia && (
            <div className={`rounded-xl border p-4 space-y-4 ${fase === 'gravado'
              ? 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30'
              : 'border-brand-200 bg-brand-50/50 dark:border-brand-800 dark:bg-brand-950/30'}`}>
              <div className="flex items-start gap-2.5">
                {fase === 'gravado'
                  ? <CheckCircle2 size={18} className="text-green-700 dark:text-green-400 shrink-0 mt-0.5" />
                  : <FileSpreadsheet size={18} className="text-brand-700 dark:text-brand-300 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50">
                    {fase === 'gravado' ? 'Gravado. O painel já mostra os números novos.' : 'Conferência — nada foi gravado ainda'}
                  </p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {conferencia.curso ? `${conferencia.curso.nome} · ` : ''}
                    aba “{conferencia.aba}” · {conferencia.linhasLidas.toLocaleString('pt-BR')} linhas lidas
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {conferencia.resumo.map((x) => (
                  <div key={x.rotulo}>
                    <dt className="text-[11.5px] text-gray-500 dark:text-gray-400">{x.rotulo}</dt>
                    <dd className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-gray-50">{br(x.valor)}</dd>
                  </div>
                ))}
              </dl>

              {conferencia.avisos.length > 0 && (
                <ul className="space-y-1.5">
                  {conferencia.avisos.map((a) => (
                    <li key={a} className="flex gap-2 text-[12.5px] text-amber-800 dark:text-amber-200">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              )}

              {fase !== 'gravado' && substituicao && (
                <p className="text-[12.5px] font-medium text-gray-700 dark:text-gray-200 pt-3 border-t border-brand-200/70 dark:border-brand-800">
                  {substituicao}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {fase === 'gravado' ? (
                  <>
                    <Link to={def.painel} className="btn-primary">
                      Ver no painel <ArrowRight size={15} />
                    </Link>
                    <button type="button" onClick={() => { setArquivo(null); if (entrada.current) entrada.current.value = '' }}
                      className="btn-secondary">
                      Enviar outra
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => enviar(false)}
                      disabled={ocupado}
                      className="btn-primary disabled:opacity-50"
                    >
                      {fase === 'gravando'
                        ? <><Loader2 size={16} className="animate-spin" /> Gravando…</>
                        : 'Gravar no painel'}
                    </button>
                    <button type="button" onClick={() => { setConferencia(null); setFase(null) }}
                      disabled={ocupado} className="btn-secondary">
                      <X size={15} /> Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ─── O que já foi enviado ─── */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">O que já foi enviado</h2>
            <button type="button" onClick={carregarEnvios} title="Atualizar lista"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
              <RefreshCw size={14} />
            </button>
          </div>

          {erroLista && <p className="text-[13px] text-red-700 dark:text-red-300">{erroLista}</p>}
          {!envios && !erroLista && <p className="text-[13px] text-gray-400">Carregando…</p>}

          {envios && (
            <>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800 -mt-1">
                {envios.cursos.map((c) => (
                  <li key={c.id} className="py-3">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-1">{c.nome}</p>
                    <LinhaDeEnvio rotulo="Consolidado" envio={c.consolidado} semanas={c.semanas}
                      aoAtualizar={() => prepararEnvio('consolidado', c.id)} />
                    <LinhaDeEnvio rotulo="Avaliação" envio={c.avaliacao}
                      aoAtualizar={() => prepararEnvio('avaliacao', c.id)} />
                  </li>
                ))}
              </ul>

              <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className="flex gap-2.5 min-w-0">
                  <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100">Escolas e municípios</p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400">
                      {envios.escolas.escolas
                        ? `${envios.escolas.escolas.toLocaleString('pt-BR')} escolas em ${envios.escolas.municipios} municípios · atualizado em ${dataBr(envios.escolas.atualizadoEm)}`
                        : 'Nenhuma lista enviada. Sem ela, o gráfico por município não aparece.'}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => prepararEnvio('municipios', null)}
                  className="shrink-0 text-[12px] font-medium text-brand-700 dark:text-brand-300 hover:underline">
                  {envios.escolas.escolas ? 'Atualizar' : 'Enviar'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
