import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { telaInicial } from '../lib/perfil'
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, Mail, ShieldCheck } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { loginBg, logo } = useBranding()
  const navigate = useNavigate()

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const usuario = await login(email, password)
      // A tela inicial depende do perfil: /painel e do administrador, e mandar
      // todo mundo para la fazia a gerencia entrar e ser redirecionada na hora.
      navigate(telaInicial(usuario))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo || '/logo.png'} alt="Logo" className="w-full max-w-sm object-contain mx-auto" />
        </div>

        {/* Heading */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Acesse o sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Área da equipe — entre com seu e-mail</p>
        </div>

        {/* O cursista tem area e login proprios (CPF). Sem este aviso, quem se
            inscreve nos cursos chega aqui, tenta o CPF e nao entra -- foi o
            primeiro tropeco de quem testou. */}
        <Link
          to="/area-do-cursista"
          className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 mb-6 transition-colors hover:bg-brand-100"
        >
          <GraduationCap size={18} className="text-brand-700 flex-shrink-0" />
          <span className="flex-1 text-xs text-brand-900 leading-snug">
            <strong>É cursista?</strong> Para se inscrever nos cursos, entre pela Área
            do Cursista com o seu CPF.
          </span>
          <ArrowRight size={15} className="text-brand-700 flex-shrink-0" />
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-800 hover:bg-brand-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Entrar'}
            </button>

            <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <ShieldCheck size={12} />
              Acesso restrito a usuários autorizados
            </p>
          </form>

      </div>

      {/* Caminho de volta: esta tela agora e alcancada pelo rodape do site publico. */}
      <Link
        to="/"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-400 transition-colors hover:text-brand-700"
      >
        ← Voltar ao site
      </Link>
    </div>
  )
}
