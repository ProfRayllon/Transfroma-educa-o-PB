import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, Copy, Eye, EyeOff, Fingerprint, KeyRound, Lock, LogIn } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import cursistaApi, { formatarCpf, getCursistaErrorMessage } from '../api'
import CursistaShell, { BOTAO_PRINCIPAL, CartaoCursista, TituloCartao } from '../CursistaShell'

export default function LoginCursista() {
  const { entrar } = useCursista()
  const navigate = useNavigate()
  const location = useLocation()

  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState(null) // { texto, codigo }
  const [enviando, setEnviando] = useState(false)
  const [redefinindo, setRedefinindo] = useState(false)
  const [senhaPadrao, setSenhaPadrao] = useState(null)
  const [copiado, setCopiado] = useState(false)

  // Para onde voltar depois de entrar (ex.: o curso que ele tentou se inscrever).
  const destino = location.state?.de || '/area-do-cursista'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const resultado = await entrar(cpf, senha)
      navigate(resultado.precisaDefinirSenha ? '/area-do-cursista/senha' : destino, { replace: true })
    } catch (error) {
      setErro({ texto: error.message, codigo: error.codigo })
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Esqueceu a senha (ou e o primeiro acesso): com o CPF da base, a conta volta
   * ao primeiro acesso e a senha padrao aparece aqui. CPF fora da base nao ve
   * senha nenhuma -- o servidor so a devolve para quem esta cadastrado.
   */
  const redefinir = async () => {
    const digitos = cpf.replace(/\D/g, '')
    if (digitos.length !== 11) {
      setErro({ texto: 'Digite o seu CPF completo para redefinir a senha.', codigo: null })
      return
    }
    setRedefinindo(true)
    setErro(null)
    try {
      const { data } = await cursistaApi.post('/auth/redefinir-senha', { cpf: digitos })
      setSenhaPadrao(data.senhaPadrao)
      setSenha('')
    } catch (error) {
      setErro({ texto: getCursistaErrorMessage(error, 'Não foi possível redefinir a senha agora.'), codigo: error.response?.data?.codigo || null })
    } finally {
      setRedefinindo(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senhaPadrao)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* sem area de transferencia: a senha esta visivel na tela */ }
  }

  const usarSenhaPadrao = () => {
    setSenha(senhaPadrao)
    setMostrarSenha(true)
  }

  return (
    <CursistaShell
      bloqueado
      larguraConteudo="max-w-md"
      badge="Área do Cursista"
      titulo="Entre com o seu CPF"
      descricao="Acesse para atualizar os seus dados e se inscrever nos cursos do Transforma Educação PB."
    >
      <CartaoCursista>
        <TituloCartao>Acesso do cursista</TituloCartao>

        <form onSubmit={handleSubmit} className="space-y-4">
          {senhaPadrao && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-900">
              <p className="flex items-center gap-2 font-black"><CheckCircle2 size={17} /> Senha redefinida!</p>
              <p className="mt-1.5">Entre agora com a senha padrão de primeiro acesso:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-green-300 bg-white px-3 py-1.5 font-mono text-[16px] font-bold tracking-wide text-[#1c1033]">{senhaPadrao}</code>
                <button type="button" onClick={copiar} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100">
                  {copiado ? <><Check size={13} /> Copiada</> : <><Copy size={13} /> Copiar</>}
                </button>
                <button type="button" onClick={usarSenhaPadrao} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100">
                  Usar esta senha
                </button>
              </div>
              <p className="mt-2.5 text-[12.5px] text-green-800">
                Depois de entrar, você vai criar uma <strong>senha nova, só sua</strong>. Anote-a em um lugar seguro para não precisar redefinir de novo.
              </p>
            </div>
          )}

          {erro && erro.codigo === 'senha_incorreta' && !senhaPadrao && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="flex items-start gap-2 font-bold">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> {erro.texto}
              </p>
              <p className="mt-1.5 pl-6">Esqueceu a senha? Você mesmo pode redefini-la e entrar com a senha padrão.</p>
              <div className="mt-2.5 pl-6">
                <button
                  type="button"
                  onClick={redefinir}
                  disabled={redefinindo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#6f35b5] px-3.5 py-2 text-xs font-black text-white transition hover:bg-[#5a2b94] disabled:opacity-60"
                >
                  <KeyRound size={14} /> {redefinindo ? 'Redefinindo...' : 'Redefinir minha senha'}
                </button>
              </div>
            </div>
          )}

          {erro && erro.codigo !== 'senha_incorreta' && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                {erro.texto}
                {erro.codigo === 'fora_da_base' && (
                  <> Confira se digitou o CPF certo. Se acredita que deveria estar na base, <Link to="/suporte" className="font-bold underline">abra um chamado no Suporte</Link>.</>
                )}
              </span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#566176]">CPF</label>
            <div className="relative">
              <Fingerprint size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={formatarCpf(cpf)}
                onChange={(event) => setCpf(event.target.value)}
                className="input-field pl-9"
                placeholder="000.000.000-00"
                inputMode="numeric"
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#566176]">Senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="input-field pl-9 pr-10"
                placeholder="Sua senha"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((valor) => !valor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={enviando} className={`${BOTAO_PRINCIPAL} w-full`}>
            <LogIn size={15} />
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          {/* A senha padrao so aparece depois que o servidor confirma que o CPF
              esta na base (rota de redefinicao); visitante com CPF de fora nao a
              ve. Decisao do programa para reduzir os chamados de acesso. */}
          {!senhaPadrao && (
            <p className="text-center text-[12.5px] leading-relaxed text-[#7c6a9c]">
              Primeiro acesso ou esqueceu a senha?{' '}
              <button type="button" onClick={redefinir} disabled={redefinindo} className="font-black text-[#6f35b5] hover:underline">
                Redefinir senha
              </button>
            </p>
          )}
        </form>
      </CartaoCursista>
    </CursistaShell>
  )
}
