import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import CursistaShell, { CartaoCursista } from '../modules/cursista/CursistaShell'
import publicApi from '../lib/publicApi'

/**
 * Validacao publica de certificado, pelo codigo impresso nele.
 *
 * O QR Code do certificado abre /validar/<codigo> e o resultado aparece direto;
 * quem digita o link chega em /validar e informa o codigo. O endereco muda com
 * a consulta, para o resultado poder ser compartilhado.
 */

/** Mascara enquanto digita: 9999-9999-9999. */
function mascarar(valor) {
  const d = String(valor).replace(/\D/g, '').slice(0, 12)
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12)].filter(Boolean).join('-')
}

const dataLonga = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function Linha({ rotulo, children }) {
  return (
    <div className="grid gap-0.5 border-b border-[#f0ecf7] py-3 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[12px] font-black uppercase tracking-wider text-[#9070c8]">{rotulo}</dt>
      <dd className="text-[15px] font-semibold text-[#1c1033]">{children}</dd>
    </div>
  )
}

function Resultado({ dados }) {
  if (!dados.encontrado) {
    return (
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
        <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-black">Nenhum certificado encontrado com este código.</p>
          <p className="mt-1 text-sm">Confira se digitou os 12 números exatamente como aparecem no certificado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-[#e9e3f4]">
      <div className={`flex items-center gap-3 px-5 py-4 ${dados.valido ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
        {dados.valido ? <CheckCircle2 size={26} className="flex-shrink-0" /> : <XCircle size={26} className="flex-shrink-0" />}
        <div>
          <p className="text-[17px] font-black">{dados.valido ? 'Certificado válido' : 'Certificado revogado'}</p>
          <p className="text-sm">
            {dados.valido
              ? 'Este certificado foi emitido pelo Programa Transforma Educação PB.'
              : 'Este certificado foi emitido, mas não tem mais validade.'}
          </p>
        </div>
      </div>
      <dl className="px-5 py-2">
        <Linha rotulo="Cursista">{dados.nome}</Linha>
        <Linha rotulo="CPF">{dados.cpf}</Linha>
        <Linha rotulo="Curso">{dados.curso}</Linha>
        {dados.cargaHoraria && <Linha rotulo="Carga horária">{dados.cargaHoraria} horas</Linha>}
        {dados.periodo && <Linha rotulo="Período">{dados.periodo}</Linha>}
        <Linha rotulo="Código">{dados.codigo}</Linha>
        {dataLonga(dados.emitidoEm) && <Linha rotulo="Emitido em">{dataLonga(dados.emitidoEm)}</Linha>}
      </dl>
    </div>
  )
}

export default function ValidarCertificado() {
  const { codigo: codigoDaUrl = '' } = useParams()
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState(mascarar(codigoDaUrl))
  const [dados, setDados] = useState(null)
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const alvo = mascarar(codigoDaUrl)
    setCodigo(alvo)
    setDados(null)
    setErro('')
    if (alvo.length !== 14) return
    let ativo = true
    setConsultando(true)
    publicApi.get(`/certificados/publico/validar/${alvo}`)
      .then(({ data }) => { if (ativo) setDados(data) })
      .catch(() => { if (ativo) setErro('Não foi possível consultar agora. Tente novamente em instantes.') })
      .finally(() => { if (ativo) setConsultando(false) })
    return () => { ativo = false }
  }, [codigoDaUrl])

  const consultar = (e) => {
    e.preventDefault()
    if (codigo.length !== 14) {
      setErro('O código tem 12 números, no formato 0000-0000-0000.')
      return
    }
    navigate(`/validar/${codigo}`)
  }

  return (
    <CursistaShell
      badge="Validação de certificado"
      titulo="Verifique a autenticidade"
      descricao="Digite o código de validação que aparece no certificado, abaixo do QR Code."
    >
      <CartaoCursista className="sm:p-8">
        <form onSubmit={consultar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-sm font-bold text-[#1c1033]">Código de validação</span>
            <input
              value={codigo}
              onChange={(e) => { setCodigo(mascarar(e.target.value)); setErro('') }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000-0000-0000"
              className="w-full rounded-xl border border-[#ded6ea] bg-white px-4 py-3 font-mono text-[18px] tracking-[0.12em] text-[#1c1033] outline-none transition focus:border-[#6f35b5] focus:ring-2 focus:ring-[#6f35b5]/15"
            />
          </label>
          <button
            type="submit"
            disabled={consultando}
            className="rounded-xl bg-[#6f35b5] px-7 py-3.5 text-[15px] font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-60"
          >
            {consultando ? 'Consultando...' : 'Validar'}
          </button>
        </form>

        {erro && <p className="mt-3 text-sm font-semibold text-red-600">{erro}</p>}
        {dados && <Resultado dados={dados} />}
      </CartaoCursista>
    </CursistaShell>
  )
}
