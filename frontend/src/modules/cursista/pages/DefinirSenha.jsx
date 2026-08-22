import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react'
import { useCursista } from '../CursistaContext'
import CursistaShell, { BOTAO_PRINCIPAL, CartaoCursista, TituloCartao } from '../CursistaShell'

const MIN_CARACTERES = 8

// A senha de primeiro acesso NAO e espelhada aqui. O bundle do front e publico:
// qualquer pessoa baixa o .js e le uma constante. Quem recusa a repeticao da
// senha padrao e o servidor, e a mensagem dele aparece no bloco de erro.

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

  // Usar o proprio CPF e o erro mais comum no primeiro acesso, e a lista de
  // regras sozinha nao explica o motivo -- ela so deixa o botao apagado. Este
  // aviso e local porque conferir o CPF nao expoe nada: a pessoa acabou de
  // digita-lo. A recusa da senha padrao fica no servidor, que nao precisa
  // publicar o valor para compara-lo.
  const digitados = novaSenha.replace(/\D/g, '')
  const pareceCpf = digitados.length === 11 && !/[a-zA-Z]/.test(novaSenha)

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
    <CursistaShell
      bloqueado={senhaPendente}
      larguraConteudo="max-w-2xl"
      badge={senhaPendente ? 'Primeiro acesso' : 'Minha conta'}
      titulo={senhaPendente ? 'Crie a sua senha' : 'Alterar senha'}
      descricao={
        senhaPendente
          ? 'A senha de primeiro acesso é a mesma para todos os cursistas. Escolha agora uma senha que só você saiba.'
          : 'Troque a sua senha de acesso à Área do Cursista.'
      }
    >
      <CartaoCursista>
        <TituloCartao descricao="A senha protege os seus dados e as suas inscrições.">
          {senhaPendente ? 'Sua nova senha' : 'Trocar senha'}
        </TituloCartao>

        <form onSubmit={handleSubmit} className="space-y-4">
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!senhaPendente && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">Senha atual</label>
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
            <label className="mb-1.5 block text-xs font-bold text-[#566176]">Nova senha</label>
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
            <label className="mb-1.5 block text-xs font-bold text-[#566176]">Confirme a nova senha</label>
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

          {pareceCpf && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>
                <strong>A senha não pode ser o seu CPF.</strong> Ele identifica
                você no login e não serve como senha. Crie uma senha com letras
                e números — por exemplo, o nome da sua escola com o ano.
              </span>
            </div>
          )}

          <ul className="space-y-1.5 rounded-xl bg-[#faf8fd] px-4 py-3">
            {regras.map((regra) => (
              <li key={regra.texto} className={`flex items-center gap-2 text-xs font-medium ${regra.ok ? 'text-green-700' : 'text-[#9070c8]'}`}>
                <CheckCircle size={13} className="flex-shrink-0" />
                {regra.texto}
              </li>
            ))}
          </ul>

          <button type="submit" disabled={!podeEnviar || enviando} className={`${BOTAO_PRINCIPAL} w-full`}>
            {enviando ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </CartaoCursista>
    </CursistaShell>
  )
}
