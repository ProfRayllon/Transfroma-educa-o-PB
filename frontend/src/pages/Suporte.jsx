import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, Copy, Search, Send } from 'lucide-react'
import PublicNav from '../components/public/PublicNav'
import PublicFooter from '../components/public/PublicFooter'
import publicApi from '../lib/publicApi'
import { useCursista } from '../modules/cursista/CursistaContext'
import {
  CATEGORIAS, DICAS_DE_CATEGORIA, STATUS, formatarCpf, formatarDataHora,
} from '../lib/suporte'

/**
 * Suporte publico: abrir um chamado e acompanhar o protocolo.
 *
 * Fica fora de qualquer sessao de proposito: quem mais precisa de suporte e
 * quem nao consegue entrar. O CPF identifica a pessoa e, junto do protocolo,
 * e o que libera a consulta depois.
 */

const campo = 'w-full rounded-xl border border-[#ded6ea] bg-white px-3.5 py-2.5 text-[15px] text-[#1c1033] placeholder-[#9ca3af] outline-none transition focus:border-[#6f35b5] focus:ring-2 focus:ring-[#e9d5ff]'
const rotulo = 'mb-1.5 block text-sm font-bold text-[#1c1033]'

const COR_DO_STATUS = {
  aberto: 'bg-red-50 text-red-700 ring-red-200',
  em_andamento: 'bg-amber-50 text-amber-700 ring-amber-200',
  aguardando_solicitante: 'bg-blue-50 text-blue-700 ring-blue-200',
  resolvido: 'bg-green-50 text-green-700 ring-green-200',
  cancelado: 'bg-gray-100 text-gray-600 ring-gray-200',
}

function mensagemDeErro(e, padrao) {
  return e?.response?.data?.message || padrao
}

/**
 * Aviso em amarelo: e-mail fora do ar (temporario, depende so de o SMTP
 * estar configurado) e chamado ja em aberto no mesmo e-mail.
 */
function AvisoAmarelo({ children }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-900">
      <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
      <div>{children}</div>
    </div>
  )
}

function BotaoCopiar({ texto }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Navegador sem acesso a area de transferencia: o caminho antigo.
      const campoTemp = document.createElement('textarea')
      campoTemp.value = texto
      document.body.appendChild(campoTemp)
      campoTemp.select()
      document.execCommand('copy')
      campoTemp.remove()
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532d] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#166534]"
    >
      {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar protocolo</>}
    </button>
  )
}

function AbrirChamado({ emailAtivo, aoAcompanhar }) {
  const { cursista } = useCursista()
  const [form, setForm] = useState({
    nome: cursista?.name || '', cpf: '', email: cursista?.email || '', categoria: '', descricao: '', site: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [protocoloEmAberto, setProtocoloEmAberto] = useState(null)
  const [protocolo, setProtocolo] = useState(null)

  const altera = (chave) => (e) => {
    const valor = chave === 'cpf' ? formatarCpf(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [chave]: valor }))
  }

  const enviar = async (e) => {
    e.preventDefault()
    setErro('')
    setProtocoloEmAberto(null)
    if (!form.categoria) { setErro('Escolha do que se trata o chamado.'); return }
    setEnviando(true)
    try {
      const { data } = await publicApi.post('/suporte/publico/chamados', form)
      setProtocolo({ numero: data.protocolo, email: data.email || form.email, emailAtivo: data.emailAtivo === true })
    } catch (e2) {
      // Ja existe chamado em aberto neste e-mail: nao e erro de preenchimento,
      // e sim um "acompanhe o que voce ja abriu" -- com o atalho para isso.
      if (e2?.response?.status === 409 && e2.response.data?.protocoloEmAberto) {
        setProtocoloEmAberto(e2.response.data.protocoloEmAberto)
      } else {
        setErro(mensagemDeErro(e2, 'Não foi possível enviar agora. Tente novamente.'))
      }
    } finally {
      setEnviando(false)
    }
  }

  if (protocolo) {
    return (
      <div className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-8 text-center">
        <CheckCircle2 size={44} className="mx-auto mb-3 text-[#16a34a]" />
        <h2 className="text-2xl font-black text-[#14532d]">Chamado registrado</h2>
        {protocolo.numero && (
          <div className="mx-auto my-5 inline-flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-4 ring-1 ring-[#bbf7d0]">
            <span className="block text-xs font-black uppercase tracking-[0.18em] text-[#166534]">Seu protocolo</span>
            <span className="select-all text-4xl font-black tracking-wide text-[#14532d]">{protocolo.numero}</span>
            <BotaoCopiar texto={protocolo.numero} />
          </div>
        )}
        {protocolo.emailAtivo ? (
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-[#374151]">
            Enviamos o número do protocolo para <strong>{protocolo.email}</strong>. Se não encontrar,
            confira a caixa de spam. Você será avisado por e-mail quando houver resposta.
          </p>
        ) : (
          <div className="mx-auto max-w-lg">
            <AvisoAmarelo>
              <strong>Anote ou copie este número.</strong> No momento o envio de e-mails está
              temporariamente indisponível, então você <strong>não</strong> vai receber o protocolo por
              e-mail. Para acompanhar o atendimento, use a aba <strong>Acompanhar protocolo</strong> com
              este número e o seu CPF.
            </AvisoAmarelo>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {protocolo.numero && (
            <button
              type="button"
              onClick={() => aoAcompanhar(protocolo.numero)}
              className="rounded-xl bg-[#6f35b5] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#5a2b94]"
            >
              Acompanhar este protocolo
            </button>
          )}
          <button
            type="button"
            onClick={() => { setProtocolo(null); setForm((f) => ({ ...f, categoria: '', descricao: '' })) }}
            className="rounded-xl border border-[#bbf7d0] bg-white px-5 py-2.5 text-sm font-bold text-[#166534] transition hover:bg-[#dcfce7]"
          >
            Abrir outro chamado
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={rotulo} htmlFor="sup-nome">Nome completo</label>
          <input id="sup-nome" className={campo} value={form.nome} onChange={altera('nome')} autoComplete="name" required />
        </div>
        <div>
          <label className={rotulo} htmlFor="sup-cpf">CPF</label>
          <input id="sup-cpf" className={campo} value={form.cpf} onChange={altera('cpf')} inputMode="numeric" placeholder="000.000.000-00" required />
        </div>
        <div>
          <label className={rotulo} htmlFor="sup-email">E-mail</label>
          <input id="sup-email" type="email" className={campo} value={form.email} onChange={altera('email')} autoComplete="email" placeholder="voce@exemplo.com" required />
        </div>
      </div>

      <fieldset>
        <legend className={rotulo}>Do que se trata?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(CATEGORIAS).map(([valor, nome]) => {
            const ativo = form.categoria === valor
            return (
              <label
                key={valor}
                className={`cursor-pointer rounded-xl border p-3.5 transition ${ativo
                  ? 'border-[#6f35b5] bg-[#f3e8ff] ring-2 ring-[#e9d5ff]'
                  : 'border-[#ded6ea] bg-white hover:border-[#c4b5fd]'}`}
              >
                <input type="radio" name="categoria" value={valor} checked={ativo} onChange={altera('categoria')} className="sr-only" />
                <span className="block text-sm font-black text-[#1c1033]">{nome}</span>
                <span className="mt-0.5 block text-xs leading-snug text-[#566176]">{DICAS_DE_CATEGORIA[valor]}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label className={rotulo} htmlFor="sup-descricao">Descreva o problema</label>
        <textarea
          id="sup-descricao"
          rows={6}
          maxLength={4000}
          className={campo}
          value={form.descricao}
          onChange={altera('descricao')}
          placeholder="Conte o que aconteceu, em qual tela e, se houver, a mensagem de erro que apareceu."
          required
        />
        <span className="mt-1 block text-right text-xs text-[#9ca3af]">{form.descricao.length}/4000</span>
      </div>

      {/* Armadilha para robo: invisivel para pessoas, o servidor descarta quem preenche. */}
      <input type="text" name="site" value={form.site} onChange={altera('site')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {!emailAtivo && (
        <AvisoAmarelo>
          O atendimento está funcionando, mas o envio de e-mails está <strong>temporariamente
          indisponível</strong>. Ao enviar, o número do protocolo aparece nesta tela: anote ou copie,
          porque é com ele e o seu CPF que você acompanha o chamado.
        </AvisoAmarelo>
      )}

      {protocoloEmAberto && (
        <AvisoAmarelo>
          <p>
            Você ainda tem um chamado em aberto neste e-mail, protocolo <strong>{protocoloEmAberto}</strong>.
            Ao finalizar esse chamado, você poderá solicitar outro.
          </p>
          <button
            type="button"
            onClick={() => aoAcompanhar(protocoloEmAberto)}
            className="mt-2 rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-amber-700"
          >
            Acompanhar este protocolo
          </button>
        </AvisoAmarelo>
      )}

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-6 py-3.5 text-[15px] font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-60"
      >
        <Send size={16} /> {enviando ? 'Enviando...' : 'Enviar chamado'}
      </button>
    </form>
  )
}

function ConsultarProtocolo({ protocoloInicial }) {
  const [protocolo, setProtocolo] = useState(protocoloInicial || '')
  const [cpf, setCpf] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [erro, setErro] = useState('')
  const [chamado, setChamado] = useState(null)

  const consultar = async (e) => {
    e.preventDefault()
    setErro('')
    setChamado(null)
    setConsultando(true)
    try {
      const { data } = await publicApi.get('/suporte/publico/consulta', { params: { protocolo, cpf } })
      setChamado(data)
    } catch (e2) {
      setErro(mensagemDeErro(e2, 'Não foi possível consultar agora.'))
    } finally {
      setConsultando(false)
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={consultar} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className={rotulo} htmlFor="con-protocolo">Protocolo</label>
          <input id="con-protocolo" className={campo} value={protocolo} onChange={(e) => setProtocolo(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="2026000123" />
        </div>
        <div>
          <label className={rotulo} htmlFor="con-cpf">CPF</label>
          <input id="con-cpf" className={campo} value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
        </div>
        <button
          type="submit"
          disabled={consultando}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6f35b5] px-5 py-2.5 text-[15px] font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-60"
        >
          <Search size={16} /> {consultando ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</p>}

      {chamado && (
        <div className="rounded-2xl border border-[#ded6ea] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.18em] text-[#a855f7]">Protocolo {chamado.protocolo}</span>
              <h3 className="mt-1 text-lg font-black text-[#1c1033]">{CATEGORIAS[chamado.categoria]}</h3>
              <p className="text-xs text-[#566176]">Aberto em {formatarDataHora(chamado.criadoEm)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${COR_DO_STATUS[chamado.status] || ''}`}>
              {STATUS[chamado.status]}
            </span>
          </div>

          <p className="mt-4 whitespace-pre-line rounded-xl bg-[#faf5ff] p-4 text-sm text-[#374151]">{chamado.descricao}</p>

          {chamado.historico?.length > 0 && (
            <ol className="mt-5 grid gap-3 border-l-2 border-[#e9d5ff] pl-4">
              {chamado.historico.map((h, i) => (
                <li key={i}>
                  <span className="block text-xs text-[#9ca3af]">{formatarDataHora(h.criadoEm)}</span>
                  <span className="whitespace-pre-line text-sm text-[#1c1033]">
                    {h.tipo === 'resposta' && <strong className="text-[#6f35b5]">Resposta da equipe: </strong>}
                    {h.mensagem}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

export default function Suporte() {
  const [params] = useSearchParams()
  const protocoloDoLink = params.get('protocolo') || ''
  const [aba, setAba] = useState(protocoloDoLink || params.get('aba') === 'consultar' ? 'consultar' : 'abrir')
  const [protocoloConsulta, setProtocoloConsulta] = useState(protocoloDoLink)
  // Ate a resposta chegar, ou se ela falhar, vale o aviso: prometer um e-mail
  // que nao chega e pior do que avisar a toa.
  const [emailAtivo, setEmailAtivo] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    publicApi.get('/suporte/publico/opcoes')
      .then(({ data }) => setEmailAtivo(data?.emailAtivo === true))
      .catch(() => setEmailAtivo(false))
  }, [])

  const acompanhar = (numero) => {
    setProtocoloConsulta(numero)
    setAba('consultar')
  }

  const abaClasse = (ativa) => `flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${ativa
    ? 'bg-white text-[#6f35b5] shadow-sm'
    : 'text-white/80 hover:text-white'}`

  return (
    <div className="min-h-screen bg-[#faf7ff] text-[#1c1033]">
      <PublicNav />
      <main>
        <section className="bg-[#3b1d7a] px-[22px] pb-24 pt-14 text-white">
          <div className="mx-auto max-w-[820px]">
            <span className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wider ring-1 ring-white/25">
              Suporte
            </span>
            <h1 className="text-[40px] font-black leading-tight">Como podemos ajudar?</h1>
            <p className="mt-3 max-w-[600px] text-[17px] leading-relaxed text-white/80">
              Não consegue acessar a plataforma, o AVA ou o certificado? Abra um chamado: você recebe
              um número de protocolo por e-mail e acompanha a resposta por aqui.
            </p>
            <div className="mt-8 flex max-w-md gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/20" role="tablist">
              <button type="button" role="tab" aria-selected={aba === 'abrir'} className={abaClasse(aba === 'abrir')} onClick={() => setAba('abrir')}>
                Abrir chamado
              </button>
              <button type="button" role="tab" aria-selected={aba === 'consultar'} className={abaClasse(aba === 'consultar')} onClick={() => setAba('consultar')}>
                Acompanhar protocolo
              </button>
            </div>
          </div>
        </section>

        <section className="px-[22px]">
          <div className="mx-auto -mt-14 mb-16 max-w-[820px] rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(42,24,70,.12)] sm:p-8">
            {aba === 'abrir'
              ? <AbrirChamado emailAtivo={emailAtivo} aoAcompanhar={acompanhar} />
              : <ConsultarProtocolo key={protocoloConsulta} protocoloInicial={protocoloConsulta} />}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
