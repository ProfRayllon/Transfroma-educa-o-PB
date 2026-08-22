import { useEffect, useState } from 'react'
import { AlertTriangle, Info, Plus, Trash2 } from 'lucide-react'
import Modal from '../ui/Modal'
import api, { getApiErrorMessage } from '../../lib/api'

/**
 * Cadastro de cursista pela coordenacao: criar do zero ou corrigir um existente.
 *
 * Alcanca o que a tela do cursista nao alcanca -- nome, CPF, dados funcionais e
 * escolas -- porque esses vem da base oficial e so a coordenacao responde por
 * eles. Os campos que o cursista preenche tambem aparecem aqui, para corrigir um
 * erro de digitacao a pedido dele.
 *
 * O que nao esta neste formulario, de proposito: senha, se o cadastro foi
 * confirmado e as datas de acesso. Isso e registro do que aconteceu, nao dado
 * cadastral. (Para senha existe o botao de resetar, que devolve a conta ao
 * primeiro acesso em vez de definir um valor.)
 */

const MAX_VINCULOS = 4

const VAZIO = {
  cpf: '', name: '', usuarioId: '', funcao: '', componenteCurricular: '',
  eixoTecnologico: '', cursoTecnico: '', dataInicioRede: '', birthDate: '',
  emailInstitucional: '', emailPessoal: '', phone: '', genero: '',
  status: 'ativo', formacaoEncontrada: false,
  vinculos: [{ inep: '', gre: '', escola: '' }],
}

const soData = (valor) => (valor ? String(valor).slice(0, 10) : '')

function Campo({ label, children, dica, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {dica && <p className="text-[11px] text-gray-400 mt-1">{dica}</p>}
    </div>
  )
}

export default function FormularioCursista({ open, cursistaId, onClose, onSalvo }) {
  const editando = Boolean(cursistaId)

  const [form, setForm] = useState(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [cpfOriginal, setCpfOriginal] = useState('')

  useEffect(() => {
    if (!open) return
    setErro(null)

    if (!editando) {
      setForm(VAZIO)
      setCpfOriginal('')
      return
    }

    setCarregando(true)
    api.get(`/cursistas/admin/cursistas/${cursistaId}`)
      .then(({ data }) => {
        setForm({
          ...VAZIO,
          ...data,
          birthDate: soData(data.birthDate),
          dataInicioRede: soData(data.dataInicioRede),
          // Sempre pelo menos uma linha de escola, para o formulario nao abrir vazio.
          vinculos: data.vinculos?.length ? data.vinculos : [{ inep: '', gre: '', escola: '' }],
        })
        setCpfOriginal(data.cpf || '')
      })
      .catch((error) => setErro(getApiErrorMessage(error, 'Erro ao carregar o cadastro.')))
      .finally(() => setCarregando(false))
  }, [open, cursistaId, editando])

  const set = (campo) => (evento) => {
    const alvo = evento.target
    setForm((atual) => ({ ...atual, [campo]: alvo.type === 'checkbox' ? alvo.checked : alvo.value }))
  }

  const setVinculo = (indice, campo) => (evento) => {
    const valor = evento.target.value
    setForm((atual) => ({
      ...atual,
      vinculos: atual.vinculos.map((v, i) => (i === indice ? { ...v, [campo]: valor } : v)),
    }))
  }

  const salvar = async (evento) => {
    evento.preventDefault()
    setSalvando(true)
    setErro(null)

    // Linha de escola em branco nao vira vinculo vazio no banco.
    const vinculos = form.vinculos.filter((v) => v.inep?.trim() || v.gre?.trim() || v.escola?.trim())
    const corpo = { ...form, vinculos }

    try {
      const { data } = editando
        ? await api.put(`/cursistas/admin/cursistas/${cursistaId}`, corpo)
        : await api.post('/cursistas/admin/cursistas', corpo)
      onSalvo(data, { criado: !editando })
      onClose()
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Erro ao salvar o cadastro.'))
    } finally {
      setSalvando(false)
    }
  }

  const cpfMudou = editando && form.cpf?.replace(/\D/g, '') !== cpfOriginal?.replace(/\D/g, '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar cursista' : 'Novo cursista'}
      size="xl"
      footer={(
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" form="form-cursista" disabled={salvando || carregando} className="btn-primary disabled:opacity-50">
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar cadastro'}
          </button>
        </div>
      )}
    >
      {carregando ? (
        <p className="py-8 text-center text-sm text-gray-400">Carregando cadastro...</p>
      ) : (
        <form id="form-cursista" onSubmit={salvar} className="space-y-5">
          {erro && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {!editando && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                O cadastro entra como <strong>manual</strong> e a pessoa acessa igual a quem
                veio da planilha: com o CPF e a senha padrão, trocando a senha na primeira entrada.
              </span>
            </div>
          )}

          {/* ---- Identificação ---- */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Identificação</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Campo label="CPF *" dica={editando ? 'É o login do cursista.' : 'Só números ou com pontuação.'}>
                <input
                  value={form.cpf}
                  onChange={set('cpf')}
                  required
                  placeholder="000.000.000-00"
                  className="input-field font-mono"
                />
              </Campo>
              <Campo label="Nome completo *" className="md:col-span-2" dica="Como deve sair no certificado.">
                <input value={form.name} onChange={set('name')} required maxLength={150} className="input-field" />
              </Campo>
            </div>

            {cpfMudou && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 mt-3">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  O CPF é o login. Ao salvar, <strong>{form.name || 'o cursista'}</strong> passa a
                  entrar com o número novo — avise antes que ele tente acessar. A senha não muda.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <Campo label="Matrícula (USUARIO_ID)" dica="Da base oficial. Deixe vazio se não houver.">
                <input value={form.usuarioId || ''} onChange={set('usuarioId')} maxLength={20} placeholder="USR000001" className="input-field font-mono" />
              </Campo>
              <Campo label="Situação da conta">
                <select value={form.status} onChange={set('status')} className="select-field">
                  <option value="ativo">Ativo — pode entrar</option>
                  <option value="inativo">Inativo — acesso bloqueado</option>
                </select>
              </Campo>
              <Campo label="Data de nascimento">
                <input type="date" value={form.birthDate || ''} onChange={set('birthDate')} className="input-field" />
              </Campo>
            </div>
          </div>

          {/* ---- Dados funcionais ---- */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Dados funcionais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="Função">
                <input value={form.funcao || ''} onChange={set('funcao')} maxLength={120} placeholder="Professor(a) da Formação Geral Básica" className="input-field" />
              </Campo>
              <Campo label="Componente curricular">
                <input value={form.componenteCurricular || ''} onChange={set('componenteCurricular')} maxLength={120} placeholder="Língua Portuguesa" className="input-field" />
              </Campo>
              <Campo label="Eixo tecnológico">
                <input value={form.eixoTecnologico || ''} onChange={set('eixoTecnologico')} maxLength={120} className="input-field" />
              </Campo>
              <Campo label="Curso técnico">
                <input value={form.cursoTecnico || ''} onChange={set('cursoTecnico')} maxLength={120} className="input-field" />
              </Campo>
              <Campo label="Início na rede estadual">
                <input type="date" value={form.dataInicioRede || ''} onChange={set('dataInicioRede')} className="input-field" />
              </Campo>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.formacaoEncontrada)} onChange={set('formacaoEncontrada')} className="rounded" />
                  Formação encontrada na base
                </label>
              </div>
            </div>
          </div>

          {/* ---- Contato ---- */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Contato</h4>
            <p className="text-[11px] text-gray-400 mb-3">
              Campos que o próprio cursista preenche no primeiro acesso. Edite aqui apenas para corrigir a pedido dele.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Campo label="E-mail institucional">
                <input type="email" value={form.emailInstitucional || ''} onChange={set('emailInstitucional')} maxLength={150} className="input-field" />
              </Campo>
              <Campo label="E-mail pessoal">
                <input type="email" value={form.emailPessoal || ''} onChange={set('emailPessoal')} maxLength={150} className="input-field" />
              </Campo>
              <Campo label="Telefone">
                <input value={form.phone || ''} onChange={set('phone')} maxLength={20} placeholder="83999990000" className="input-field" />
              </Campo>
              <Campo label="Gênero">
                <input value={form.genero || ''} onChange={set('genero')} maxLength={40} className="input-field" />
              </Campo>
            </div>
          </div>

          {/* ---- Escolas ---- */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Escolas</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">Até {MAX_VINCULOS} vínculos, na ordem em que aparecem.</p>
              </div>
              {form.vinculos.length < MAX_VINCULOS && (
                <button
                  type="button"
                  onClick={() => setForm((a) => ({ ...a, vinculos: [...a.vinculos, { inep: '', gre: '', escola: '' }] }))}
                  className="btn-secondary text-xs"
                >
                  <Plus size={13} /> Adicionar escola
                </button>
              )}
            </div>

            <div className="space-y-2">
              {form.vinculos.map((vinculo, indice) => (
                <div key={indice} className="flex items-start gap-2">
                  <input
                    value={vinculo.inep || ''}
                    onChange={setVinculo(indice, 'inep')}
                    placeholder="INEP"
                    maxLength={12}
                    className="input-field font-mono w-28 flex-shrink-0"
                  />
                  <input
                    value={vinculo.gre || ''}
                    onChange={setVinculo(indice, 'gre')}
                    placeholder="GRE"
                    maxLength={60}
                    className="input-field w-28 flex-shrink-0"
                  />
                  <input
                    value={vinculo.escola || ''}
                    onChange={setVinculo(indice, 'escola')}
                    placeholder="Nome da escola"
                    maxLength={200}
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((a) => ({
                      ...a,
                      vinculos: a.vinculos.length === 1
                        ? [{ inep: '', gre: '', escola: '' }]
                        : a.vinculos.filter((_, i) => i !== indice),
                    }))}
                    title="Remover esta escola"
                    className="p-2.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}
