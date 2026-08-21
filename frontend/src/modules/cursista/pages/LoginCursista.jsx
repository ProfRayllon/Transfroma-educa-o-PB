import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Fingerprint, Lock, LogIn } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import { formatarCpf } from '../api'

export default function LoginCursista() {
  const { entrar } = useCursista()
  const navigate = useNavigate()
  const location = useLocation()

  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Para onde voltar depois de entrar (ex.: o curso que ele tentou se inscrever).
  const destino = location.state?.de || '/area-do-cursista'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const resultado = await entrar(cpf, senha)
      navigate(resultado.precisaDefinirSenha ? '/area-do-cursista/senha' : destino, { replace: true })
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
          <h1 className="text-2xl font-black text-[#1c1033]">Área do Cursista</h1>
          <p className="text-sm text-[#566176] mt-1">
            Transforma Educação PB — acesse para se inscrever nos cursos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">CPF</label>
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha</label>
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

          <button type="submit" disabled={enviando} className="btn-primary w-full justify-center disabled:opacity-50">
            <LogIn size={15} />
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          {/* A senha de primeiro acesso NAO aparece aqui: e comunicada pela
              coordenacao por canal interno. Publicar o valor nesta tela o
              entregaria a qualquer visitante junto com o campo de CPF. */}
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Primeiro acesso ou esqueceu a senha? Procure a coordenação do programa.
          </p>
        </form>

        <p className="text-center text-xs text-gray-500 mt-5">
          <Link to="/" className="text-gray-400 hover:text-brand-700">
            ← Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  )
}
