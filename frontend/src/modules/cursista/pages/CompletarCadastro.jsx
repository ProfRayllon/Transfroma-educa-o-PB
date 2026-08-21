import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Briefcase, CheckCircle, ClipboardCheck, Fingerprint,
  GraduationCap, Mail, MapPin, Phone, Save, School,
} from 'lucide-react'
import { useCursista } from '../CursistaContext'
import { formatarCpf } from '../api'

const GENEROS = [
  '', 'Mulher cisgênero', 'Homem cisgênero', 'Mulher transgênero',
  'Homem transgênero', 'Não-binário', 'Outros', 'Prefiro não informar',
]

function formatarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

function DadoFixo({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <div className="text-sm text-gray-800 break-words">{valor || '—'}</div>
      </div>
    </div>
  )
}

/**
 * Segunda etapa obrigatoria do acesso: completar e confirmar o cadastro.
 *
 * A base oficial nao traz data de nascimento (vazia em todos os registros) nem
 * telefone, e o e-mail falta em cerca de um quinto dos casos -- por isso e o
 * cursista quem fornece. Enquanto nao concluir, o backend recusa as rotas de
 * curso e inscricao.
 */
export default function CompletarCadastro() {
  const { cursista, cadastroPendente, salvarCadastro } = useCursista()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    birthDate: '', phone: '', emailInstitucional: '', emailPessoal: '', genero: '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!cursista) return
    setForm({
      birthDate: cursista.birthDate || '',
      phone: cursista.phone || '',
      emailInstitucional: cursista.emailInstitucional || '',
      emailPessoal: cursista.emailPessoal || '',
      genero: cursista.genero || '',
    })
  }, [cursista])

  const alterar = (campo) => (event) => setForm((f) => ({ ...f, [campo]: event.target.value }))

  const pendencias = [
    { ok: Boolean(form.birthDate), texto: 'Data de nascimento' },
    { ok: String(form.phone).replace(/\D/g, '').length >= 10, texto: 'Telefone com DDD' },
    { ok: Boolean(form.emailInstitucional || form.emailPessoal), texto: 'Ao menos um e-mail' },
  ]
  const completo = pendencias.every((p) => p.ok)

  const enviar = async (event) => {
    event.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await salvarCadastro({ ...form, phone: String(form.phone).replace(/\D/g, '') })
      navigate('/area-do-cursista', { replace: true })
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!cursista) return null

  return (
    <div className="min-h-screen bg-[#f4f6fa] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-3">
            <ClipboardCheck size={24} />
          </div>
          <h1 className="text-2xl font-black text-[#1c1033]">
            {cadastroPendente ? 'Complete o seu cadastro' : 'Meus dados'}
          </h1>
          <p className="text-sm text-[#566176] mt-1">
            {cadastroPendente
              ? 'Confira os dados vindos da rede e preencha o que falta para liberar as inscrições.'
              : 'Atualize os seus dados de contato quando precisar.'}
          </p>
        </div>

        {cadastroPendente && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              Você ainda não pode se inscrever nos cursos. Conclua o cadastro abaixo para liberar.
            </span>
          </div>
        )}

        {/* Dados da base oficial */}
        <section className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Dados da rede estadual</h2>
          <p className="text-xs text-gray-500 mb-4">
            Vêm da base oficial e alimentam o certificado. Para corrigir algo aqui,
            procure a coordenação do programa.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DadoFixo icon={GraduationCap} label="Nome completo" valor={cursista.name} />
            <DadoFixo icon={Fingerprint} label="CPF" valor={formatarCpf(cursista.cpf)} />
            <DadoFixo icon={Briefcase} label="Função" valor={cursista.funcao} />
            {cursista.componenteCurricular && (
              <DadoFixo icon={School} label="Componente curricular" valor={cursista.componenteCurricular} />
            )}
            {cursista.eixoTecnologico && (
              <DadoFixo icon={School} label="Eixo tecnológico" valor={cursista.eixoTecnologico} />
            )}
          </div>

          {cursista.vinculos?.length > 0 && (
            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">
                {cursista.vinculos.length > 1
                  ? `Escolas onde você atua (${cursista.vinculos.length})`
                  : 'Escola onde você atua'}
              </div>
              <ul className="space-y-2">
                {cursista.vinculos.map((vinculo) => (
                  <li key={vinculo.ordem} className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                    <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-gray-800">{vinculo.escola}</div>
                      <div className="text-[11px] text-gray-500">
                        {vinculo.gre}{vinculo.inep ? ` · INEP ${vinculo.inep}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Dados preenchidos pelo cursista */}
        <form onSubmit={enviar} className="card">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Seus dados</h2>
          <p className="text-xs text-gray-500 mb-4">
            Estes campos não vêm da base da rede — precisamos que você informe.
          </p>

          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 mb-4">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Data de nascimento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={alterar('birthDate')}
                className="input-field"
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Telefone com DDD <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={formatarTelefone(form.phone)}
                  onChange={alterar('phone')}
                  className="input-field pl-9"
                  placeholder="(83) 99999-0000"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail institucional</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.emailInstitucional}
                  onChange={alterar('emailInstitucional')}
                  className="input-field pl-9"
                  placeholder="nome@see.pb.gov.br"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">E-mail pessoal</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.emailPessoal}
                  onChange={alterar('emailPessoal')}
                  className="input-field pl-9"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Gênero <span className="font-normal text-gray-400">— opcional</span>
              </label>
              <select value={form.genero} onChange={alterar('genero')} className="select-field">
                {GENEROS.map((g) => (
                  <option key={g || 'vazio'} value={g}>{g || 'Prefiro não informar agora'}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            Informe ao menos um e-mail. É por ele que a coordenação entra em contato
            sobre a sua formação.
          </p>

          <div className="border-t border-gray-100 mt-4 pt-4">
            <ul className="space-y-1.5 mb-4">
              {pendencias.map((p) => (
                <li key={p.texto} className={`flex items-center gap-2 text-xs ${p.ok ? 'text-green-700' : 'text-gray-400'}`}>
                  <CheckCircle size={13} className="flex-shrink-0" />
                  {p.texto}
                </li>
              ))}
            </ul>

            <button type="submit" disabled={!completo || salvando} className="btn-primary w-full justify-center disabled:opacity-40">
              <Save size={15} />
              {salvando ? 'Salvando...' : cadastroPendente ? 'Confirmar cadastro e continuar' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
