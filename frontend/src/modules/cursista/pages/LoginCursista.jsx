import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Clock, Eye, EyeOff, Fingerprint, Lock, LogIn, ShieldAlert } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import { formatarCpf } from '../api'
import CursistaShell, { BOTAO_PRINCIPAL, CartaoCursista, TituloCartao } from '../CursistaShell'

export default function LoginCursista() {
  const { entrar } = useCursista()
  const navigate = useNavigate()
  const location = useLocation()

  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [detalhesErro, setDetalhesErro] = useState(null)
  const [esperaSegundos, setEsperaSegundos] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Para onde voltar depois de entrar (ex.: o curso que ele tentou se inscrever).
  const destino = location.state?.de || '/area-do-cursista'

  useEffect(() => {
    if (!esperaSegundos || esperaSegundos <= 0) return undefined
    const timer = window.setInterval(() => {
      setEsperaSegundos((valor) => (valor && valor > 0 ? valor - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [esperaSegundos])

  const formatarEspera = (segundos) => {
    const total = Math.max(0, Number(segundos || 0))
    const minutos = Math.floor(total / 60)
    const resto = total % 60
    return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErro('')
    setDetalhesErro(null)
    setEnviando(true)
    try {
      const resultado = await entrar(cpf, senha)
      navigate(resultado.precisaDefinirSenha ? '/area-do-cursista/senha' : destino, { replace: true })
    } catch (error) {
      setErro(error.message)
      setDetalhesErro(error.details || null)
      setEsperaSegundos(error.details?.tentarNovamenteEmSegundos || null)
    } finally {
      setEnviando(false)
    }
  }

  const bloqueioAtivo = Boolean(detalhesErro?.bloqueado && esperaSegundos > 0)

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
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0 space-y-1">
                <p>{erro}</p>
                {Number.isFinite(Number(detalhesErro?.tentativasRestantes)) && (
                  <p className="text-xs">
                    Tentativas usadas: {detalhesErro.tentativasUsadas} de {detalhesErro.maxTentativas}.
                    {' '}Restam {detalhesErro.tentativasRestantes}.
                  </p>
                )}
                {bloqueioAtivo && (
                  <p className="flex items-center gap-1.5 text-xs font-bold">
                    <Clock size={13} /> Tente novamente em {formatarEspera(esperaSegundos)}.
                  </p>
                )}
              </div>
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

          <button type="submit" disabled={enviando || bloqueioAtivo} className={`${BOTAO_PRINCIPAL} w-full`}>
            <LogIn size={15} />
            {enviando ? 'Entrando...' : bloqueioAtivo ? `Aguarde ${formatarEspera(esperaSegundos)}` : 'Entrar'}
          </button>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-800">
            <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              Por segurança, o acesso é bloqueado por 5 minutos após 5 tentativas incorretas.
            </span>
          </div>

          {/* A senha de primeiro acesso NAO aparece aqui: e comunicada pela
              coordenacao por canal interno. Publicar o valor nesta tela o
              entregaria a qualquer visitante junto com o campo de CPF. */}
          <p className="text-center text-[12px] leading-relaxed text-[#7c6a9c]">
            Primeiro acesso ou esqueceu a senha? Procure a coordenação do programa.
          </p>
        </form>
      </CartaoCursista>
    </CursistaShell>
  )
}
