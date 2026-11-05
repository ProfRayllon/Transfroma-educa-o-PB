import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, Download, FileSpreadsheet, Loader2, School, Upload } from 'lucide-react'
import api, { getApiErrorMessage } from '../../lib/api'

/**
 * Diretores escolares: importacao da planilha das GREs e o cruzamento por GRE.
 *
 * A importacao tem duas etapas, como a da base de cursistas: CONFERIR le a
 * planilha e mostra o que vai acontecer; so CONFIRMAR grava. O resumo por GRE
 * e so contagem -- nenhum dado pessoal aparece aqui.
 */

const numero = (n) => Number(n || 0).toLocaleString('pt-BR')
const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0)

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

function Conferencia({ dados, aoConfirmar, aoCancelar, gravando }) {
  const r = dados.resumo
  const itens = [
    ['Diretores lidos', r.linhas - r.ignorados],
    ['Novos na base de diretores', r.novos],
    ['Dados atualizados', r.atualizados],
    ['Já eram cursistas', r.jaEramCursistas],
    ['Contas de cursista criadas', r.contasCriadas],
    ['Ignorados', r.ignorados],
  ]
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-brand-200 p-4">
      <p className="text-sm font-semibold text-gray-800">
        {dados.gravado ? 'Importação concluída.' : 'Conferência — nada foi gravado ainda.'}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="text-[11px] text-gray-500">{rotulo}</div>
            <div className={`text-lg font-bold ${rotulo === 'Ignorados' && valor ? 'text-amber-600' : 'text-gray-900'}`}>{numero(valor)}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Por GRE: {Object.entries(dados.porGre).map(([gre, n]) => `${gre} (${n})`).join(' · ') || '—'}
        {r.linhasDeTotal > 0 && ` · ${r.linhasDeTotal} linha(s) de total ignorada(s)`}
      </p>
      {r.contasCriadas > 0 && !dados.gravado && (
        <p className="text-xs text-gray-500">
          Quem ainda não é cursista ganha a conta com a função “Diretor(a) escolar” e entra com o CPF e a senha padrão.
          Quem já é cursista só é marcado como diretor: o cadastro dele não muda.
        </p>
      )}
      {dados.totalProblemas > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-200">
          <div className="bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{numero(dados.totalProblemas)} linha(s) ignorada(s)</div>
          <div className="max-h-48 overflow-auto">
            <table className="w-full">
              <thead><tr><th className="table-header">Aba</th><th className="table-header">Linha</th><th className="table-header">CPF</th><th className="table-header">Nome</th><th className="table-header">Motivo</th></tr></thead>
              <tbody>
                {dados.problemas.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="table-cell">{p.aba}</td><td className="table-cell">{p.linha}</td>
                    <td className="table-cell font-mono">{p.cpf || '—'}</td><td className="table-cell">{p.nome || '—'}</td>
                    <td className="table-cell">{p.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!dados.gravado && (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={aoCancelar} disabled={gravando}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={aoConfirmar} disabled={gravando || r.linhas - r.ignorados === 0}>
            {gravando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Confirmar importação
          </button>
        </div>
      )}
    </div>
  )
}

export default function DiretoresPorGre({ aoImportar }) {
  const [resumo, setResumo] = useState(null)
  const [arquivo, setArquivo] = useState(null)
  const [conferencia, setConferencia] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [erro, setErro] = useState('')
  const arquivoRef = useRef(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/cursistas/admin/diretores/resumo')
      setResumo(data)
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível carregar os diretores.'))
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const enviar = async (gravar, alvo = arquivo) => {
    setOcupado(true)
    setErro('')
    try {
      const { data } = await api.post(`/cursistas/admin/diretores/importar${gravar ? '' : '/validar'}`, alvo, {
        params: { arquivo: alvo.name },
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      setConferencia(data)
      if (gravar) {
        setArquivo(null)
        carregar()
        aoImportar?.()
      }
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível ler a planilha.'))
    } finally {
      setOcupado(false)
    }
  }

  const escolher = (e) => {
    const escolhido = e.target.files?.[0]
    e.target.value = ''
    if (!escolhido) return
    setArquivo(escolhido)
    enviar(false, escolhido)
  }

  const exportar = async () => {
    setExportando(true)
    try {
      const { data } = await api.get('/cursistas/admin/diretores/exportar', { responseType: 'blob' })
      baixarBlob(data, 'diretores.xlsx')
    } catch {
      setErro('Não foi possível gerar a planilha de diretores.')
    } finally {
      setExportando(false)
    }
  }

  const gres = resumo?.gres || []
  const total = resumo?.total

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800"><School size={16} /> Diretores escolares</h3>
          <p className="text-xs text-gray-500">
            Planilha por GRE: a aba (ou o arquivo) com o nome da regional, como “15ª GRE”, e as colunas do modelo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/modelos/modelo-importacao-diretores.xlsx" download className="btn-secondary text-sm">
            <FileSpreadsheet size={14} /> Modelo de diretores
          </a>
          <input ref={arquivoRef} type="file" accept=".xlsx" className="hidden" onChange={escolher} />
          <button type="button" className="btn-secondary text-sm" onClick={() => arquivoRef.current?.click()} disabled={ocupado}>
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar diretores
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={exportar} disabled={exportando || !total?.diretores}>
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar lista
          </button>
        </div>
      </div>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {erro}
        </div>
      )}

      {conferencia && (
        <Conferencia
          dados={conferencia}
          gravando={ocupado}
          aoConfirmar={() => enviar(true)}
          aoCancelar={() => { setConferencia(null); setArquivo(null) }}
        />
      )}
      {conferencia?.gravado && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle size={15} /> Diretores gravados. O resumo abaixo já está atualizado.
        </div>
      )}

      {/* Cruzamento por GRE: so contagens. */}
      <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className="table-header">GRE</th>
              <th className="table-header text-right">Diretores</th>
              <th className="table-header text-right">Escolas</th>
              <th className="table-header text-right">Já acessaram</th>
              <th className="table-header text-right">Inscritos em curso</th>
            </tr>
          </thead>
          <tbody>
            {!resumo ? (
              <tr><td colSpan={5} className="table-cell py-5 text-center text-gray-400">Carregando...</td></tr>
            ) : gres.length === 0 ? (
              <tr><td colSpan={5} className="table-cell py-5 text-center text-gray-400">Nenhum diretor importado ainda. Baixe o modelo, preencha e importe.</td></tr>
            ) : (
              <>
                {gres.map((g) => (
                  <tr key={g.gre} className="border-t border-gray-100">
                    <td className="table-cell font-medium text-gray-800">{g.gre}</td>
                    <td className="table-cell text-right">{numero(g.diretores)}</td>
                    <td className="table-cell text-right">{numero(g.escolas)}</td>
                    <td className="table-cell text-right">{numero(g.acessaram)} <span className="text-gray-400">({pct(g.acessaram, g.diretores)}%)</span></td>
                    <td className="table-cell text-right">{numero(g.inscritos)} <span className="text-gray-400">({pct(g.inscritos, g.diretores)}%)</span></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="table-cell">Total</td>
                  <td className="table-cell text-right">{numero(total.diretores)}</td>
                  <td className="table-cell text-right">{numero(total.escolas)}</td>
                  <td className="table-cell text-right">{numero(total.acessaram)} <span className="font-normal text-gray-400">({pct(total.acessaram, total.diretores)}%)</span></td>
                  <td className="table-cell text-right">{numero(total.inscritos)} <span className="font-normal text-gray-400">({pct(total.inscritos, total.diretores)}%)</span></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
