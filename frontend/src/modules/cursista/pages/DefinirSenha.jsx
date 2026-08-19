import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import { useCursista } from '../CursistaContext'

const MIN_CARACTERES = 8

export default function DefinirSenha() {
  const { senhaPendente, definirSenha } = useCursista()
  const navigate = useNavigate()

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const regras = [
    { ok: novaSenha.length >= MIN_CARACTERES, texto: `Pelo menos ${MIN_CARACTERES} caracteres` },
    { ok: /[a-zA-Z]/.test(novaSenha) && /\d/.test(novaSenha), texto: 'Letras e números' },
    { ok: novaSenha.length > 0 && novaSenha === confirmacao, texto: 'As duas senhas conferem' },
  ]
  const podeEnviar = regras.every((regra) => regra.ok) && (senhaPendente || senhaAtual.length > 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await definirSenha({ senhaAtual: senhaPendente ? undefined : senhaAtual, novaSenha })
      navigate('/area-do-cursista', { replace: true })
    } catch (error) {
      setErro(error.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-black text-[#1c1033]">
            {senhaPendente ? 'Crie a sua senha' : 'Alterar senha'}
          </h1>
          {senhaPendente && (
            <p className="text-sm text-[#566176] mt-1">
              Você entrou com o CPF. Defina uma senha pessoal para continuar.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {senhaPendente && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              Enquanto a senha for o seu CPF, outra pessoa que saiba o seu CPF consegue
              entrar na sua conta. Por isso a troca é obrigatória.
            </div>
          )}

          {!senhaPendente && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha atual</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(event) => setSenhaAtual(event.target.value)}
                  className="input-field pl-9"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nova senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={mostrar ? 'text' : 'password'}
                value={novaSenha}
                onChange={(event) => setNovaSenha(event.target.value)}
                className="input-field pl-9 pr-10"
                autoComplete="new-password"
                autoFocus={senhaPendente}
                required
              />
              <button
                type="button"
                onClick={() => setMostrar((valor) => !valor)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirme a nova senha</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                className="input-field pl-9"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <ul className="space-y-1.5">
            {regras.map((regra) => (
              <li key={regra.texto} className={`flex items-center gap-2 text-xs ${regra.ok ? 'text-green-700' : 'text-gray-400'}`}>
                <CheckCircle size={13} className="flex-shrink-0" />
                {regra.texto}
              </li>
            ))}
          </ul>

          <button type="submit" disabled={!podeEnviar || enviando} className="btn-primary w-full justify-center disabled:opacity-40">
            {enviando ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
