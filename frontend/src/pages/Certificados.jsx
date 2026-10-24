import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Award, CheckCircle2, Download, Eye, FileSpreadsheet, ImagePlus, Loader2, RotateCcw, Search, Trash2, Upload, UserPlus,
} from 'lucide-react'
import api, { getApiErrorMessage } from '../lib/api'
import VisualizadorPdf from '../components/public/VisualizadorPdf'
import ConfirmDialog from '../components/ui/ConfirmDialog'

/**
 * Certificados por curso, so para o administrador.
 *
 * Tres partes, nesta ordem de uso: a CONFIGURACAO (arte, textos, prévia), a
 * BASE de quem tem direito (planilha com CPF e nome) e a lista de EMITIDOS.
 * Nenhum PDF fica guardado: o sistema monta cada certificado na hora do
 * download, a partir da arte e dos dados.
 */

const ABAS = [
  { chave: 'config', rotulo: 'Configuração' },
  { chave: 'base', rotulo: 'Adicionar concluintes' },
  { chave: 'emitidos', rotulo: 'Emitidos' },
]

const numero = (n) => Number(n || 0).toLocaleString('pt-BR')

/** Mensagem de erro que veio dentro de um blob (respostas de PDF). */
async function mensagemDoBlob(erro, padrao) {
  try { return JSON.parse(await erro.response.data.text()).message || padrao } catch { return getApiErrorMessage(erro, padrao) }
}

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Aviso({ tipo = 'erro', children }) {
  const cor = tipo === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : tipo === 'info' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-red-200 bg-red-50 text-red-700'
  const Icone = tipo === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${cor}`}>
      <Icone size={16} className="mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------- configuracao

function AbaConfiguracao({ curso, config, aoSalvar, aoVerPdf }) {
  const [form, setForm] = useState(null)
  const [arteUrl, setArteUrl] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoArte, setEnviandoArte] = useState(false)
  const [gerandoPrevia, setGerandoPrevia] = useState(false)
  const [aviso, setAviso] = useState(null)
  const arquivoRef = useRef(null)

  useEffect(() => {
    setForm({
      nomeCurso: config.nomeCurso || '',
      periodo: config.periodo || '',
      cargaHoraria: config.cargaHoraria || 30,
      texto: config.texto || '',
      prefixoCodigo: config.prefixoCodigo || '',
      liberado: config.liberado,
    })
    setAviso(null)
  }, [config])

  // Miniatura da arte: vem com o token, entao por axios e nao por <img src>.
  useEffect(() => {
    if (!config.arte) { setArteUrl(null); return undefined }
    let url = null
    api.get(`/certificados/admin/cursos/${curso.id}/arte`, { responseType: 'blob', params: { v: config.atualizadoEm } })
      .then(({ data }) => { url = URL.createObjectURL(data); setArteUrl(url) })
      .catch(() => setArteUrl(null))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [curso.id, config.arte, config.atualizadoEm])

  if (!form) return null
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const enviarArte = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setEnviandoArte(true)
    setAviso(null)
    try {
      const { data } = await api.put(`/certificados/admin/cursos/${curso.id}/arte`, arquivo, {
        params: { nome: arquivo.name },
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      aoSalvar(data)
      setAviso({ tipo: 'ok', texto: 'Arte atualizada.' })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: getApiErrorMessage(erro, 'Não foi possível enviar a arte.') })
    } finally {
      setEnviandoArte(false)
    }
  }

  const salvar = async () => {
    setSalvando(true)
    setAviso(null)
    try {
      const { data } = await api.put(`/certificados/admin/cursos/${curso.id}`, { ...form, cargaHoraria: Number(form.cargaHoraria) })
      aoSalvar(data)
      setAviso({ tipo: 'ok', texto: data.liberado ? 'Salvo. O download está liberado para os cursistas da base.' : 'Salvo. O download continua fechado para os cursistas.' })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: getApiErrorMessage(erro, 'Não foi possível salvar.') })
    } finally {
      setSalvando(false)
    }
  }

  const verPrevia = async () => {
    setGerandoPrevia(true)
    setAviso(null)
    try {
      const { data } = await api.post(`/certificados/admin/cursos/${curso.id}/previa`, { ...form, cargaHoraria: Number(form.cargaHoraria) }, { responseType: 'blob' })
      aoVerPdf({ blob: data, titulo: `Prévia — ${form.nomeCurso}`, nomeArquivo: 'previa-certificado.pdf' })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: await mensagemDoBlob(erro, 'Não foi possível gerar a prévia.') })
    } finally {
      setGerandoPrevia(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Arte */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Arte de fundo</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="aspect-[1.414] w-full max-w-[340px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {arteUrl
              ? <img src={arteUrl} alt="Arte do certificado" className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">Nenhuma arte enviada</div>}
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p>A imagem do certificado <strong>sem os dados do cursista</strong>, em A4 deitado (JPEG ou PNG, até 6 MB).</p>
            <p className="text-xs text-gray-500">O sistema escreve por cima o nome, o texto, o código e um QR Code que leva à validação no site. O quadro de verificação da arte é coberto por um novo, no mesmo lugar.</p>
            {config.arte && <p className="text-xs text-gray-500">Atual: {config.arte.nome} · {Math.round(config.arte.tamanho / 1024)} KB</p>}
            <input ref={arquivoRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={enviarArte} />
            <button type="button" className="btn-secondary" onClick={() => arquivoRef.current?.click()} disabled={enviandoArte}>
              {enviandoArte ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
              {config.arte ? 'Trocar arte' : 'Enviar arte'}
            </button>
          </div>
        </div>
      </section>

      {/* Textos */}
      <section className="grid gap-4 sm:grid-cols-[1fr_190px_110px_110px]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Nome do curso no certificado</span>
          <input className="input-field" value={form.nomeCurso} onChange={mudar('nomeCurso')} maxLength={255} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Período</span>
          <input className="input-field" value={form.periodo} onChange={mudar('periodo')} placeholder="março a julho de 2026" maxLength={150} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Carga horária (h)</span>
          <input className="input-field" type="number" min={1} max={999} value={form.cargaHoraria} onChange={mudar('cargaHoraria')} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">Prefixo do código</span>
          <input
            className="input-field font-mono uppercase"
            value={form.prefixoCodigo}
            onChange={(e) => setForm((f) => ({ ...f, prefixoCodigo: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) }))}
            maxLength={4}
            placeholder="LEG"
          />
        </label>
      </section>
      <p className="-mt-3 text-xs text-gray-500">
        Os códigos são gerados pelo sistema: <span className="font-mono font-semibold text-gray-700">{form.prefixoCodigo || 'LEG'}-A7K9-X2M4</span>.
        {' '}Trocar o prefixo vale para os próximos; quem já tem certificado mantém o código.
      </p>

      <section>
        <div className="mb-1 flex items-end justify-between gap-2">
          <span className="block text-xs font-semibold text-gray-600">Texto do certificado</span>
          <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setForm((f) => ({ ...f, texto: config.textoPadrao }))}>
            Restaurar texto padrão
          </button>
        </div>
        <textarea className="input-field min-h-[120px] leading-relaxed" value={form.texto} onChange={mudar('texto')} maxLength={2000} />
        <p className="mt-1.5 text-xs text-gray-500">
          Campos preenchidos pelo sistema: <code className="rounded bg-gray-100 px-1">{'{cpf}'}</code>{' '}
          <code className="rounded bg-gray-100 px-1">{'{curso}'}</code>{' '}
          <code className="rounded bg-gray-100 px-1">{'{periodo}'}</code>{' '}
          <code className="rounded bg-gray-100 px-1">{'{carga}'}</code> (vira “30 (trinta)”). O nome do cursista sai em destaque acima do texto.
        </p>
      </section>

      <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${form.liberado ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-700" checked={form.liberado} onChange={mudar('liberado')} />
        <span>
          <span className="block text-sm font-semibold text-gray-800">Liberar download para os cursistas</span>
          <span className="block text-xs text-gray-500">
            Com a opção ligada, quem está na base vê o certificado na área do cursista e o código passa a validar no site.
            {' '}Base atual: {numero(config.totais.validos)} certificados válidos.
          </span>
        </span>
      </label>

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={verPrevia} disabled={gerandoPrevia || !config.arte}>
          {gerandoPrevia ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Ver prévia
        </button>
        <button type="button" className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Salvar
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- base

const MODOS_DE_ENVIO = [
  {
    chave: 'adicionar',
    titulo: 'Adicionar à base',
    texto: 'Só entra quem é novo. Quem já tem certificado não é alterado.',
  },
  {
    chave: 'completa',
    titulo: 'Substituir pela lista completa',
    texto: 'Atualiza os nomes e revoga o certificado de quem não estiver na planilha.',
  },
]

function Resumo({ resultado, modo, aoBaixarIgnorados, baixandoIgnorados }) {
  const r = resultado.resumo
  const itens = [
    ['Linhas lidas', r.linhas],
    ['Novos certificados', r.novos],
    [modo === 'completa' ? 'Sem alteração' : 'Já estavam na base', r.inalterados],
    ['Reativados', r.reativados],
    ...(modo === 'completa' ? [['Nomes atualizados', r.atualizados], ['Revogados', r.revogados]] : []),
    ['Nome do cadastro', r.nomeDoCadastro || 0],
    ['Ignorados', r.ignorados],
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="text-[11px] text-gray-500">{rotulo}</div>
            <div className={`text-lg font-bold ${rotulo === 'Ignorados' && valor ? 'text-amber-600' : rotulo === 'Revogados' && valor ? 'text-red-600' : 'text-gray-900'}`}>{numero(valor)}</div>
          </div>
        ))}
      </div>
      {r.codigoMantido > 0 && (
        <Aviso tipo="info">{numero(r.codigoMantido)} linha(s) trouxeram um código diferente do já emitido. O código original foi mantido: ele pode já estar impresso.</Aviso>
      )}
      {resultado.totalProblemas > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-3 py-2">
            <span className="text-xs font-semibold text-amber-800">
              {numero(resultado.totalProblemas)} linha(s) ignorada(s){resultado.totalProblemas > resultado.problemas.length ? ` — mostrando as ${resultado.problemas.length} primeiras` : ''}
            </span>
            {aoBaixarIgnorados && (
              <button type="button" onClick={aoBaixarIgnorados} disabled={baixandoIgnorados} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">
                {baixandoIgnorados ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Baixar linhas ignoradas (.xlsx)
              </button>
            )}
          </div>
          <div className="max-h-56 overflow-auto">
            <table className="w-full">
              <thead><tr><th className="table-header">Linha</th><th className="table-header">CPF na planilha</th><th className="table-header">Nome</th><th className="table-header">Motivo</th></tr></thead>
              <tbody>
                {resultado.problemas.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="table-cell">{p.linha}</td>
                    <td className="table-cell font-mono">{p.cpf || <span className="text-gray-400">(vazio)</span>}</td>
                    <td className="table-cell">{p.nome || <span className="text-gray-400">—</span>}</td>
                    <td className="table-cell">{p.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/** Uma pessoa por vez, sem planilha: entra sem mexer em mais ninguém. */
function AdicionarManual({ curso, aoAtualizar }) {
  const [cpf, setCpf] = useState('')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const formatar = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
  }

  const adicionar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const { data } = await api.post(`/certificados/admin/cursos/${curso.id}/emitidos`, { cpf: cpf.replace(/\D/g, ''), nome: nome.trim() })
      setAviso({ tipo: 'ok', texto: `${data.reativado ? 'Certificado reativado' : 'Certificado criado'} para ${data.nome} — código ${data.codigo}.` })
      setCpf('')
      setNome('')
      aoAtualizar()
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: getApiErrorMessage(erro, 'Não foi possível adicionar.') })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={adicionar} className="space-y-3 rounded-2xl border border-gray-200 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800"><UserPlus size={16} /> Adicionar uma pessoa</h3>
        <p className="text-xs text-gray-500">Sem nome, vale o do cadastro do cursista no sistema.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
        <input className="input-field font-mono" placeholder="000.000.000-00" inputMode="numeric" value={formatar(cpf)} onChange={(e) => setCpf(e.target.value)} required />
        <input className="input-field" placeholder="Nome completo (opcional)" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
        <button type="submit" className="btn-primary justify-center" disabled={salvando || cpf.replace(/\D/g, '').length !== 11}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Adicionar
        </button>
      </div>
      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
    </form>
  )
}

function AbaBase({ curso, aoAtualizar }) {
  const [arquivo, setArquivo] = useState(null)
  const [modo, setModo] = useState('adicionar')
  const [conferencia, setConferencia] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [baixandoIgnorados, setBaixandoIgnorados] = useState(false)
  const [erro, setErro] = useState('')
  const arquivoRef = useRef(null)

  const enviar = async (gravar, alvo = arquivo, modoAlvo = modo) => {
    setOcupado(true)
    setErro('')
    try {
      const { data } = await api.post(`/certificados/admin/cursos/${curso.id}/base/${gravar ? 'enviar' : 'conferir'}`, alvo, {
        params: { modo: modoAlvo },
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      if (gravar) {
        setResultado(data)
        setConferencia(null)
        aoAtualizar()
      } else {
        setConferencia(data)
        setResultado(null)
      }
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível ler a planilha.'))
    } finally {
      setOcupado(false)
    }
  }

  // A lista inteira de ignorados sai da mesma planilha, reprocessada sem gravar.
  const baixarIgnorados = async () => {
    if (!arquivo) return
    setBaixandoIgnorados(true)
    try {
      const { data } = await api.post(`/certificados/admin/cursos/${curso.id}/base/ignorados`, arquivo, {
        params: { modo },
        headers: { 'Content-Type': 'application/octet-stream' },
        responseType: 'blob',
      })
      baixarBlob(data, `ignorados-${arquivo.name.replace(/\.(xlsx|csv)$/i, '')}.xlsx`)
    } catch (e) {
      setErro(await mensagemDoBlob(e, 'Não foi possível gerar a planilha de ignorados.'))
    } finally {
      setBaixandoIgnorados(false)
    }
  }

  const escolher = (e) => {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    if (!escolhido) return
    setArquivo(escolhido)
    enviar(false, escolhido)
  }

  const trocarModo = (novo) => {
    setModo(novo)
    setResultado(null)
    if (arquivo) enviar(false, arquivo, novo)
  }

  const algoAMudar = (r) => r.novos + r.atualizados + r.reativados + r.revogados > 0

  return (
    <div className="space-y-5">
      <AdicionarManual curso={curso} aoAtualizar={aoAtualizar} />

      <div className="space-y-4 rounded-2xl border border-gray-200 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800"><FileSpreadsheet size={16} /> Enviar planilha</h3>
          <p className="mt-1 text-xs text-gray-500">
            .xlsx ou .csv com a coluna <strong>CPF</strong> (obrigatória) e, se quiser, <strong>NOME_COMPLETO</strong> — sem ela, vale o nome do cadastro.
            O código de validação é gerado pelo sistema. Outras colunas são ignoradas.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          {MODOS_DE_ENVIO.map((m) => (
            <label
              key={m.chave}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${modo === m.chave ? (m.chave === 'completa' ? 'border-red-300 bg-red-50' : 'border-brand-300 bg-brand-50') : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input type="radio" name="modo-envio" className="mt-1 accent-brand-700" checked={modo === m.chave} onChange={() => trocarModo(m.chave)} />
              <span>
                <span className="block text-sm font-semibold text-gray-800">{m.titulo}</span>
                <span className="block text-xs text-gray-500">{m.texto}</span>
              </span>
            </label>
          ))}
        </div>

        <input ref={arquivoRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={escolher} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={() => arquivoRef.current?.click()} disabled={ocupado}>
            <FileSpreadsheet size={15} /> {arquivo ? 'Escolher outra planilha' : 'Escolher planilha'}
          </button>
          {arquivo && <span className="text-sm text-gray-600">{arquivo.name}</span>}
          {ocupado && <Loader2 size={16} className="animate-spin text-brand-700" />}
        </div>

        {erro && <Aviso>{erro}</Aviso>}

        {conferencia && (
          <div className="space-y-3 rounded-2xl border border-brand-200 p-4">
            <p className="text-sm font-semibold text-gray-800">Conferência — nada foi gravado ainda.</p>
            <Resumo resultado={conferencia} modo={modo} aoBaixarIgnorados={baixarIgnorados} baixandoIgnorados={baixandoIgnorados} />
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => enviar(true)} disabled={ocupado || !algoAMudar(conferencia.resumo)}>
                <Upload size={15} /> {modo === 'completa' ? 'Confirmar substituição' : 'Confirmar e adicionar'}
              </button>
            </div>
          </div>
        )}

        {resultado && (
          <div className="space-y-3">
            <Aviso tipo="ok">Base gravada. {numero(resultado.resumo.novos)} novo(s) certificado(s).</Aviso>
            <Resumo resultado={resultado} modo={modo} aoBaixarIgnorados={baixarIgnorados} baixandoIgnorados={baixandoIgnorados} />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- emitidos

function AbaEmitidos({ curso, aoAtualizar }) {
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [status, setStatus] = useState('')
  const [pagina, setPagina] = useState(1)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [baixando, setBaixando] = useState(null)
  const [confirmar, setConfirmar] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [exportando, setExportando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/certificados/admin/cursos/${curso.id}/emitidos`, { params: { busca: termo || undefined, status: status || undefined, pagina } })
      setDados(data)
      setErro('')
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível carregar a lista.'))
    }
  }, [curso.id, termo, status, pagina])

  useEffect(() => { carregar() }, [carregar])

  const baixar = async (item) => {
    setBaixando(item.id)
    try {
      const { data } = await api.get(`/certificados/admin/emitidos/${item.id}/pdf`, { responseType: 'blob' })
      baixarBlob(data, `certificado-${item.codigo}.pdf`)
    } catch (e) {
      setErro(await mensagemDoBlob(e, 'Não foi possível gerar o certificado.'))
    } finally {
      setBaixando(null)
    }
  }

  const alterarStatus = async () => {
    const item = confirmar
    setConfirmar(null)
    try {
      await api.patch(`/certificados/admin/emitidos/${item.id}`, { status: item.status === 'valido' ? 'revogado' : 'valido' })
      await carregar()
      aoAtualizar()
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível alterar.'))
    }
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const { data, headers } = await api.get(`/certificados/admin/cursos/${curso.id}/emitidos/exportar`, { params: { status: status || undefined }, responseType: 'blob' })
      const nome = /filename="([^"]+)"/.exec(headers?.['content-disposition'] || '')?.[1] || 'certificados.xlsx'
      baixarBlob(data, nome)
    } catch (e) {
      setErro(await mensagemDoBlob(e, 'Não foi possível gerar a planilha.'))
    } finally {
      setExportando(false)
    }
  }

  const excluir = async () => {
    const item = excluindo
    setExcluindo(null)
    try {
      await api.delete(`/certificados/admin/emitidos/${item.id}`)
      await carregar()
      aoAtualizar()
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível excluir.'))
    }
  }

  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); setPagina(1); setTermo(busca.trim()) }}
      >
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Nome, CPF completo ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className="select-field sm:w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPagina(1) }}>
          <option value="">Todas as situações</option>
          <option value="valido">Válidos</option>
          <option value="revogado">Revogados</option>
        </select>
        <button type="submit" className="btn-secondary justify-center">Buscar</button>
        <button type="button" className="btn-secondary justify-center" onClick={exportar} disabled={exportando} title="Baixa a lista com o filtro de situação escolhido">
          {exportando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Baixar lista
        </button>
      </form>

      {erro && <Aviso>{erro}</Aviso>}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="table-header">Nome</th>
              <th className="table-header">CPF</th>
              <th className="table-header">Código</th>
              <th className="table-header">Situação</th>
              <th className="table-header text-right">Downloads</th>
              <th className="table-header text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!dados ? (
              <tr><td colSpan={6} className="table-cell py-6 text-center text-gray-400">Carregando...</td></tr>
            ) : dados.itens.length === 0 ? (
              <tr><td colSpan={6} className="table-cell py-6 text-center text-gray-400">Nenhum certificado {termo || status ? 'encontrado' : 'nesta base ainda'}.</td></tr>
            ) : dados.itens.map((item) => (
              <tr key={item.id} className="border-t border-gray-100">
                <td className="table-cell font-medium text-gray-900">{item.nome}</td>
                <td className="table-cell">{item.cpf}</td>
                <td className="table-cell font-mono">{item.codigo}</td>
                <td className="table-cell">
                  <span className={`badge ${item.status === 'valido' ? 'badge-success' : 'badge-danger'}`}>{item.status === 'valido' ? 'Válido' : 'Revogado'}</span>
                </td>
                <td className="table-cell text-right">{numero(item.downloads)}</td>
                <td className="table-cell">
                  <div className="flex justify-end gap-1">
                    <button type="button" title="Baixar PDF" className="rounded-lg p-1.5 text-brand-700 hover:bg-brand-50" onClick={() => baixar(item)} disabled={baixando === item.id}>
                      {baixando === item.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    </button>
                    <button
                      type="button"
                      title={item.status === 'valido' ? 'Revogar' : 'Reativar'}
                      className={`rounded-lg p-1.5 ${item.status === 'valido' ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}
                      onClick={() => setConfirmar(item)}
                    >
                      {item.status === 'valido' ? <AlertTriangle size={15} /> : <RotateCcw size={15} />}
                    </button>
                    <button type="button" title="Excluir" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => setExcluindo(item)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados && dados.total > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{numero(dados.total)} certificado(s)</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary py-1.5" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
            <span>{pagina} de {totalPaginas}</span>
            <button type="button" className="btn-secondary py-1.5" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmar)}
        onClose={() => setConfirmar(null)}
        onConfirm={alterarStatus}
        title={confirmar?.status === 'valido' ? 'Revogar certificado?' : 'Reativar certificado?'}
        message={confirmar?.status === 'valido'
          ? `O certificado de ${confirmar?.nome} deixa de aparecer na área do cursista e a validação passa a mostrar "revogado".`
          : `O certificado de ${confirmar?.nome} volta a valer, com o mesmo código.`}
        confirmLabel={confirmar?.status === 'valido' ? 'Revogar' : 'Reativar'}
        variant={confirmar?.status === 'valido' ? 'danger' : 'primary'}
      />

      <ConfirmDialog
        open={Boolean(excluindo)}
        onClose={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir certificado?"
        message={excluindo
          ? `O certificado de ${excluindo.nome} (${excluindo.codigo}) será apagado e o código deixa de existir na validação.${excluindo.downloads > 0 ? ` Ele já foi baixado ${excluindo.downloads} vez(es): se já circulou, prefira revogar.` : ' Use para lançamento errado.'}`
          : ''}
        confirmLabel="Excluir"
      />
    </div>
  )
}

// ---------------------------------------------------------------- pagina

export default function Certificados() {
  const [cursos, setCursos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [selecionado, setSelecionado] = useState(null)
  const [config, setConfig] = useState(null)
  const [aba, setAba] = useState('config')
  const [erro, setErro] = useState('')
  const [pdf, setPdf] = useState(null)

  const carregarCursos = useCallback(async () => {
    try {
      const { data } = await api.get('/certificados/admin/cursos')
      setCursos(data)
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível carregar os cursos.'))
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregarCursos() }, [carregarCursos])

  const carregarConfig = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/certificados/admin/cursos/${id}`)
      setConfig(data)
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível carregar o certificado do curso.'))
    }
  }, [])

  const escolher = (curso) => {
    setSelecionado(curso)
    setConfig(null)
    setAba('config')
    setErro('')
    carregarConfig(curso.id)
  }

  const atualizar = () => {
    carregarCursos()
    if (selecionado) carregarConfig(selecionado.id)
  }

  const abrirPdf = ({ blob, titulo, nomeArquivo }) => setPdf({ url: URL.createObjectURL(blob), titulo, nomeArquivo })
  const fecharPdf = useCallback(() => {
    setPdf((atual) => { if (atual?.url) URL.revokeObjectURL(atual.url); return null })
  }, [])

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2"><Award size={22} /> Certificados</h1>
        <p className="page-subtitle">Arte, texto e base de concluintes de cada curso. O certificado é gerado na hora em que o cursista baixa.</p>
      </div>

      {erro && <Aviso>{erro}</Aviso>}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="card p-3">
          <h2 className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Cursos</h2>
          {carregando ? (
            <p className="px-2 py-4 text-sm text-gray-400">Carregando...</p>
          ) : (
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
              {cursos.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => escolher(c)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${selecionado?.id === c.id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-gray-50'}`}
                  >
                    <div className="text-sm font-medium leading-snug text-gray-900">{c.nome}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.liberado
                        ? <span className="badge badge-success">Liberado</span>
                        : c.temArte || c.validos ? <span className="badge badge-warning">Em preparo</span> : <span className="badge badge-neutral">Sem certificado</span>}
                      {c.validos > 0 && <span className="badge badge-info">{numero(c.validos)} na base</span>}
                      {c.baixados > 0 && <span className="badge badge-neutral">{numero(c.baixados)} baixaram</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card min-w-0">
          {!selecionado ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center text-gray-400">
              <Award size={36} className="mb-3 text-gray-300" />
              <p className="text-sm">Escolha um curso para configurar o certificado.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selecionado.nome}</h2>
                  {config && (
                    <p className="text-xs text-gray-500">
                      {numero(config.totais.validos)} válidos · {numero(config.totais.revogados)} revogados · {numero(config.totais.baixados)} já baixaram
                    </p>
                  )}
                </div>
                {config && (
                  <span className={`badge ${config.liberado ? 'badge-success' : 'badge-warning'}`}>
                    {config.liberado ? 'Download liberado' : 'Download fechado'}
                  </span>
                )}
              </div>

              <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-100">
                {ABAS.map((a) => (
                  <button
                    key={a.chave}
                    type="button"
                    onClick={() => setAba(a.chave)}
                    className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${aba === a.chave ? 'border-brand-700 text-brand-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                  >
                    {a.rotulo}
                  </button>
                ))}
              </div>

              {!config ? (
                <p className="py-6 text-sm text-gray-400">Carregando...</p>
              ) : aba === 'config' ? (
                <AbaConfiguracao curso={selecionado} config={config} aoSalvar={(dados) => { setConfig(dados); carregarCursos() }} aoVerPdf={abrirPdf} />
              ) : aba === 'base' ? (
                <AbaBase curso={selecionado} aoAtualizar={atualizar} />
              ) : (
                <AbaEmitidos curso={selecionado} aoAtualizar={atualizar} />
              )}
            </>
          )}
        </div>
      </div>

      <VisualizadorPdf arquivo={pdf?.url} titulo={pdf?.titulo} nomeArquivo={pdf?.nomeArquivo} aoFechar={fecharPdf} />
    </div>
  )
}
