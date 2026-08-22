import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BookOpen, Briefcase, Building2, CalendarDays, CheckCircle,
  Fingerprint, GraduationCap, Mail, MapPin, Phone, Save, School,
} from 'lucide-react'
import { useCursista } from '../CursistaContext'
import { formatarCpf } from '../api'
import CursistaShell, { BOTAO_PRINCIPAL, CartaoCursista, TituloCartao } from '../CursistaShell'

const GENEROS = [
  '', 'Mulher cisgênero', 'Homem cisgênero', 'Mulher transgênero',
  'Homem transgênero', 'Não-binário', 'Outros', 'Prefiro não informar',
]

// A data vem como "AAAA-MM-DD". Montar com `new Date(texto)` a leria como UTC e
// poderia exibir o dia anterior; por isso a montagem e por partes.
function formatarData(valor) {
  if (!valor) return ''
  const [ano, mes, dia] = String(valor).split('-')
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : valor
}

function formatarTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

function DadoFixo({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 flex-shrink-0 text-[#9070c8]" />
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9070c8]">{label}</div>
        <div className="break-words text-sm font-medium text-[#1c1033]">{valor || '—'}</div>
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
  const [salvo, setSalvo] = useState(false)

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

  const alterar = (campo) => (event) => {
    setSalvo(false)
    setForm((f) => ({ ...f, [campo]: event.target.value }))
  }

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
      // Vindo do primeiro acesso, seguir para os cursos e o proximo passo do
      // fluxo. Numa edicao voluntaria, ficar na tela e confirmar que salvou.
      if (cadastroPendente) navigate('/area-do-cursista', { replace: true })
      else setSalvo(true)
    } catch (error) {
      setErro(error.message)
    } finally {
      setSalvando(false)
    }
  }

  if (!cursista) return null

  return (
    <CursistaShell
      bloqueado={cadastroPendente}
      badge={cadastroPendente ? 'Etapa obrigatória' : 'Minha conta'}
      titulo={cadastroPendente ? 'Complete o seu cadastro' : 'Meus dados'}
      descricao={
        cadastroPendente
          ? 'Confira os dados vindos da rede e preencha o que falta para liberar as inscrições nos cursos.'
          : 'Atualize os seus dados de contato quando precisar.'
      }
    >
      {cadastroPendente && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            Você ainda não pode se inscrever nos cursos. Conclua o cadastro abaixo para liberar.
          </span>
        </div>
      )}

      {salvo && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Dados salvos.</span>
        </div>
      )}

      <CartaoCursista>
        <TituloCartao descricao="Vêm da base oficial e alimentam o certificado. Para corrigir algo aqui, procure a coordenação do programa.">
          Dados da rede estadual
        </TituloCartao>

        {/* Quatro colunas: o cartao agora ocupa a largura do site, e em tres
            colunas sobrava espaco vazio a direita. Campos que so existem para
            parte da rede (eixo, curso tecnico) aparecem quando preenchidos. */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DadoFixo icon={GraduationCap} label="Nome completo" valor={cursista.name} />
          <DadoFixo icon={Fingerprint} label="CPF" valor={formatarCpf(cursista.cpf)} />
          <DadoFixo icon={Briefcase} label="Função" valor={cursista.funcao} />
          {cursista.componenteCurricular && (
            <DadoFixo icon={School} label="Componente curricular" valor={cursista.componenteCurricular} />
          )}
          {cursista.eixoTecnologico && (
            <DadoFixo icon={School} label="Eixo tecnológico" valor={cursista.eixoTecnologico} />
          )}
          {cursista.cursoTecnico && (
            <DadoFixo icon={BookOpen} label="Curso técnico" valor={cursista.cursoTecnico} />
          )}
          {cursista.dataInicioRede && (
            <DadoFixo icon={CalendarDays} label="Início na rede" valor={formatarData(cursista.dataInicioRede)} />
          )}
          {cursista.qtdeVinculos > 1 && (
            <DadoFixo icon={Building2} label="Vínculos" valor={`${cursista.qtdeVinculos} escolas`} />
          )}
        </div>

        {cursista.vinculos?.length > 0 && (
          <div className="mt-5 border-t border-[#ede9f6] pt-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#9070c8]">
              {cursista.vinculos.length > 1
                ? `Escolas onde você atua (${cursista.vinculos.length})`
                : 'Escola onde você atua'}
            </div>
            <ul className="space-y-2.5">
              {cursista.vinculos.map((vinculo) => (
                <li key={vinculo.ordem} className="flex items-start gap-3 rounded-xl border border-[#e9e3f4] bg-[#faf8fd] px-4 py-3">
                  <MapPin size={15} className="mt-0.5 flex-shrink-0 text-[#9070c8]" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#1c1033]">{vinculo.escola}</div>
                    <div className="text-[12px] text-[#7c6a9c]">
                      {vinculo.gre}{vinculo.inep ? ` · INEP ${vinculo.inep}` : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CartaoCursista>

      <CartaoCursista>
        <TituloCartao descricao="Estes campos não vêm da base da rede — precisamos que você informe.">
          Seus dados
        </TituloCartao>

        <form onSubmit={enviar}>
          {erro && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Tres colunas na tela larga: com duas, cada campo passaria de 550px
              e o formulario ficaria esticado depois que o cartao cresceu. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">
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
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">
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
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">E-mail institucional</label>
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
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">E-mail pessoal</label>
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

            <div className="sm:col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-xs font-bold text-[#566176]">
                Gênero <span className="font-normal text-[#9070c8]">— opcional</span>
              </label>
              <select value={form.genero} onChange={alterar('genero')} className="select-field">
                {GENEROS.map((g) => (
                  <option key={g || 'vazio'} value={g}>{g || 'Prefiro não informar agora'}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-3 text-[12px] text-[#7c6a9c]">
            Informe ao menos um e-mail. É por ele que a coordenação entra em contato
            sobre a sua formação.
          </p>

          <div className="mt-5 border-t border-[#ede9f6] pt-5">
            <ul className="mb-4 space-y-1.5 rounded-xl bg-[#faf8fd] px-4 py-3">
              {pendencias.map((p) => (
                <li key={p.texto} className={`flex items-center gap-2 text-xs font-medium ${p.ok ? 'text-green-700' : 'text-[#9070c8]'}`}>
                  <CheckCircle size={13} className="flex-shrink-0" />
                  {p.texto}
                </li>
              ))}
            </ul>

            {/* Botao de largura propria, e nao 100%: num cartao de 1180px ele
                viraria uma faixa atravessando a tela inteira. */}
            <button type="submit" disabled={!completo || salvando} className={`${BOTAO_PRINCIPAL} w-full sm:w-auto`}>
              <Save size={15} />
              {salvando ? 'Salvando...' : cadastroPendente ? 'Confirmar cadastro e continuar' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </CartaoCursista>
    </CursistaShell>
  )
}
