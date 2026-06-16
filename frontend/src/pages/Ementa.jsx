import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, Eye, Printer, Plus, X,
  ChevronRight, ChevronLeft, Send, FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import api, { getApiErrorMessage } from '../lib/api'

const STEPS = [
  { id: 1, title: 'Identificação', desc: 'Dados do curso (automático)' },
  { id: 2, title: 'Apresentação', desc: 'Contextualização e justificativa' },
  { id: 3, title: 'Objetivos', desc: 'Geral e específicos' },
  { id: 4, title: 'Competências', desc: 'Técnicas, pedagógicas e socioemocionais' },
  { id: 5, title: 'Ementa', desc: 'Descrição sintética dos conteúdos' },
  { id: 6, title: 'Recursos', desc: 'Recursos educacionais utilizados' },
  { id: 7, title: 'Avaliação', desc: 'Critérios e instrumentos' },
  { id: 8, title: 'Referências', desc: 'Bibliografia' },
]

const RESOURCE_OPTIONS = [
  { value: 'videoaula', label: 'Videoaula' },
  { value: 'apresentacao', label: 'Apresentação' },
  { value: 'atividade_escrita', label: 'Atividade escrita' },
  { value: 'material_complementar', label: 'Material complementar' },
  { value: 'atividade_interativa', label: 'Atividade interativa' },
  { value: 'ebook', label: 'E-book' },
  { value: 'avaliacao_final', label: 'Avaliação final' },
  { value: 'atividade_objetiva', label: 'Atividade objetiva' },
  { value: 'pdf', label: 'PDF' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'forum', label: 'Fórum' },
  { value: 'videoconferencia', label: 'Videoconferência' },
]

const EMPTY_FORM = {
  contextualization: '',
  justification: '',
  relevance: '',
  generalObjective: '',
  specificObjectives: [''],
  technicalCompetencies: '',
  pedagogicalCompetencies: '',
  socioemotionalCompetencies: '',
  syllabusDescription: '',
  educationalResources: [],
  evaluationCriteria: '',
  evaluationInstruments: '',
  referencesList: '',
}

const STATUS_LABELS = {
  rascunho: 'Rascunho',
  concluido: 'Concluído',
  pendente: 'Pendente',
  valido: 'Válido',
  nao_valido: 'Não válido',
}

const STATUS_COLORS = {
  rascunho: 'text-gray-600 bg-gray-50 border-gray-200',
  concluido: 'text-teal-700 bg-teal-50 border-teal-200',
  pendente: 'text-amber-600 bg-amber-50 border-amber-200',
  valido: 'text-green-700 bg-green-50 border-green-200',
  nao_valido: 'text-red-700 bg-red-50 border-red-200',
}

/* ─── helpers ─── */

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function Textarea({ value, onChange, placeholder, rows = 4, disabled }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`input-field resize-none w-full ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
    />
  )
}

function StatusControl({ label, value, options, canEdit, onChange }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{label}</div>
      {canEdit ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border cursor-pointer
            ${STATUS_COLORS[value] || STATUS_COLORS.pendente}`}
        >
          {options.map((o) => (
            <option key={o} value={o}>{STATUS_LABELS[o] || o}</option>
          ))}
        </select>
      ) : (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${STATUS_COLORS[value] || STATUS_COLORS.pendente}`}>
          {STATUS_LABELS[value] || value}
        </span>
      )}
    </div>
  )
}

/* ─── step components ─── */

function StepIdentificacao({ course, materials }) {
  const courseMaterials = materials.filter((m) => m.course === course.name)
  const totalContents = courseMaterials.length
  const totalModules = new Set(courseMaterials.map((m) => m.module || 1)).size
  const producers = course.producers?.map((p) => p.name).join(', ') || '—'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 bg-brand-50 border border-brand-100 rounded-xl p-4">
          <div className="text-[10px] font-bold text-brand-500 uppercase tracking-wider mb-1">Título do curso</div>
          <div className="text-base font-bold text-brand-900">{course.name}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Trilha principal</div>
          <div className="text-sm font-medium text-gray-800">{course.primaryTrail || '—'}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Trilha secundária</div>
          <div className="text-sm font-medium text-gray-800">{course.trail || '—'}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Conteúdos / Módulos</div>
          <div className="text-sm font-medium text-gray-800">{totalContents} conteúdos · {totalModules} módulo{totalModules !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Produtores</div>
          <div className="text-sm font-medium text-gray-800 truncate">{producers}</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 italic">Dados preenchidos automaticamente a partir do cadastro do curso.</p>
    </div>
  )
}

function StepApresentacao({ form, setForm, disabled }) {
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  return (
    <div className="space-y-5">
      <Field label="Contextualização do tema">
        <Textarea value={form.contextualization} onChange={update('contextualization')}
          placeholder="Descreva o contexto do tema abordado no curso..." rows={3} disabled={disabled} />
      </Field>
      <Field label="Justificativa da oferta do curso">
        <Textarea value={form.justification} onChange={update('justification')}
          placeholder="Por que este curso é ofertado? Qual a necessidade identificada?" rows={3} disabled={disabled} />
      </Field>
      <Field label="Relevância para o público-alvo">
        <Textarea value={form.relevance} onChange={update('relevance')}
          placeholder="Como este curso é relevante para os participantes?" rows={3} disabled={disabled} />
      </Field>
    </div>
  )
}

function StepObjetivos({ form, setForm, disabled }) {
  const updateSpecific = (i, val) => setForm((f) => {
    const list = [...f.specificObjectives]; list[i] = val
    return { ...f, specificObjectives: list }
  })
  const addObj = () => setForm((f) => ({ ...f, specificObjectives: [...f.specificObjectives, ''] }))
  const removeObj = (i) => setForm((f) => ({ ...f, specificObjectives: f.specificObjectives.filter((_, j) => j !== i) }))

  return (
    <div className="space-y-5">
      <Field label="Objetivo Geral">
        <Textarea value={form.generalObjective} onChange={(e) => setForm((f) => ({ ...f, generalObjective: e.target.value }))}
          placeholder="Competência principal que o participante deverá desenvolver ao final do curso..." rows={3} disabled={disabled} />
      </Field>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Objetivos Específicos</label>
        <div className="space-y-2">
          {form.specificObjectives.map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-600 w-5 flex-shrink-0">{i + 1}.</span>
              <input value={obj} onChange={(e) => updateSpecific(i, e.target.value)}
                placeholder={`Objetivo específico ${i + 1}...`} disabled={disabled}
                className={`input-field flex-1 ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`} />
              {!disabled && form.specificObjectives.length > 1 && (
                <button onClick={() => removeObj(i)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!disabled && (
          <button onClick={addObj} className="mt-2 flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium">
            <Plus size={13} /> Adicionar objetivo específico
          </button>
        )}
      </div>
    </div>
  )
}

function StepCompetencias({ form, setForm, disabled }) {
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  return (
    <div className="space-y-5">
      <Field label="Competências técnicas">
        <Textarea value={form.technicalCompetencies} onChange={update('technicalCompetencies')}
          placeholder="Descreva as competências técnicas desenvolvidas..." rows={3} disabled={disabled} />
      </Field>
      <Field label="Competências pedagógicas">
        <Textarea value={form.pedagogicalCompetencies} onChange={update('pedagogicalCompetencies')}
          placeholder="Descreva as competências pedagógicas desenvolvidas..." rows={3} disabled={disabled} />
      </Field>
      <Field label="Competências socioemocionais">
        <Textarea value={form.socioemotionalCompetencies} onChange={update('socioemotionalCompetencies')}
          placeholder="Descreva as competências socioemocionais desenvolvidas..." rows={3} disabled={disabled} />
      </Field>
    </div>
  )
}

function StepEmenta({ form, setForm, disabled }) {
  return (
    <div className="space-y-3">
      <Field label="Ementa — descrição sintética dos conteúdos">
        <Textarea value={form.syllabusDescription} onChange={(e) => setForm((f) => ({ ...f, syllabusDescription: e.target.value }))}
          placeholder="Descrição sintética dos conteúdos e temas que serão abordados no curso..." rows={8} disabled={disabled} />
      </Field>
    </div>
  )
}

function StepRecursos({ form, setForm, disabled }) {
  const toggle = (value) => {
    if (disabled) return
    setForm((f) => ({
      ...f,
      educationalResources: f.educationalResources.includes(value)
        ? f.educationalResources.filter((v) => v !== value)
        : [...f.educationalResources, value],
    }))
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Selecione os recursos educacionais utilizados no curso:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {RESOURCE_OPTIONS.map((opt) => {
          const selected = form.educationalResources.includes(opt.value)
          return (
            <label key={opt.value}
              className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border cursor-pointer transition-all select-none
                ${selected ? 'bg-brand-50 border-brand-300 text-brand-800' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}>
              <input type="checkbox" checked={selected} onChange={() => toggle(opt.value)}
                disabled={disabled} className="accent-brand-700 w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function StepAvaliacao({ form, setForm, disabled }) {
  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  return (
    <div className="space-y-5">
      <Field label="Critérios de avaliação">
        <Textarea value={form.evaluationCriteria} onChange={update('evaluationCriteria')}
          placeholder="Como o aprendizado será avaliado? Quais critérios serão utilizados?" rows={4} disabled={disabled} />
      </Field>
      <Field label="Instrumentos utilizados">
        <Textarea value={form.evaluationInstruments} onChange={update('evaluationInstruments')}
          placeholder="Quais instrumentos de avaliação serão utilizados? (provas, atividades práticas, fóruns, etc.)" rows={4} disabled={disabled} />
      </Field>
    </div>
  )
}

function StepReferencias({ form, setForm, disabled }) {
  return (
    <div className="space-y-3">
      <Field label="Referências bibliográficas">
        <Textarea value={form.referencesList} onChange={(e) => setForm((f) => ({ ...f, referencesList: e.target.value }))}
          placeholder="Liste as referências bibliográficas e demais fontes utilizadas..." rows={8} disabled={disabled} />
      </Field>
      <p className="text-xs text-gray-400">Use uma referência por linha. Sugestão: seguir normas ABNT.</p>
    </div>
  )
}

/* ─── view modal helpers ─── */

function SectionBlock({ num, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-lg bg-brand-800 text-white text-xs font-black flex items-center justify-center flex-shrink-0">{num}</span>
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
        <div className="flex-1 h-px bg-gray-100" />
      </div>
      <div className="pl-10">{children}</div>
    </div>
  )
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value || '—'}</div>
    </div>
  )
}

function TextField({ label, value }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</div>
      <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
    </div>
  )
}

/* ─── view modal ─── */

function EmentaViewModal({ course, ementa, form, materials, onClose, onPrint }) {
  const courseMaterials = materials.filter((m) => m.course === course.name)
  const totalContents = courseMaterials.length
  const totalModules = new Set(courseMaterials.map((m) => m.module || 1)).size
  const producers = course.producers?.map((p) => p.name).join(', ') || '—'
  const specificObjs = (form.specificObjectives || []).filter(Boolean)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-800 text-sm">Visualizar Ementa</h2>
          <div className="flex items-center gap-2">
            <button onClick={onPrint} className="btn-secondary text-xs gap-1.5">
              <Printer size={13} />
              Imprimir / PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Institutional header */}
          <div className="bg-gradient-to-r from-brand-900 to-brand-700 text-white px-8 py-8">
            <div className="text-[10px] font-bold tracking-[3px] text-white/60 uppercase mb-2">
              Secretaria de Educação · Transforma Educação PB
            </div>
            <div className="text-2xl font-black leading-tight">{course.name}</div>
            {(course.trail || course.primaryTrail) && (
              <div className="text-sm text-white/75 mt-1.5">{[course.trail, course.primaryTrail].filter(Boolean).join(' · ')}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {totalContents} conteúdo{totalContents !== 1 ? 's' : ''}
              </span>
              <span className="bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {totalModules} módulo{totalModules !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-6 px-8 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
            {[
              { label: 'Professor', val: ementa?.professorStatus || 'rascunho' },
              { label: 'Supervisor', val: ementa?.supervisorStatus || 'pendente' },
              { label: 'Coordenador', val: ementa?.coordinatorStatus || 'pendente' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">{s.label}:</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${STATUS_COLORS[s.val] || STATUS_COLORS.pendente}`}>
                  {STATUS_LABELS[s.val] || s.val}
                </span>
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-8">
            <SectionBlock num={1} title="Identificação do Curso">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="Título" value={course.name} />
                <InfoBox label="Trilha principal" value={course.primaryTrail} />
                <InfoBox label="Trilha secundária" value={course.trail} />
                <InfoBox label="Total de conteúdos" value={`${totalContents} conteúdos · ${totalModules} módulos`} />
              </div>
              <div className="mt-3"><InfoBox label="Produtores" value={producers} /></div>
            </SectionBlock>

            {(form.contextualization || form.justification || form.relevance) && (
              <SectionBlock num={2} title="Apresentação">
                {form.contextualization && <TextField label="Contextualização do tema" value={form.contextualization} />}
                {form.justification && <TextField label="Justificativa da oferta" value={form.justification} />}
                {form.relevance && <TextField label="Relevância para o público-alvo" value={form.relevance} />}
              </SectionBlock>
            )}

            {(form.generalObjective || specificObjs.length > 0) && (
              <SectionBlock num={3} title="Objetivos">
                {form.generalObjective && <TextField label="Objetivo Geral" value={form.generalObjective} />}
                {specificObjs.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Objetivos Específicos</div>
                    <ul className="space-y-1.5">
                      {specificObjs.map((obj, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-700">
                          <span className="font-bold text-brand-600 flex-shrink-0">{i + 1}.</span> {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </SectionBlock>
            )}

            {(form.technicalCompetencies || form.pedagogicalCompetencies || form.socioemotionalCompetencies) && (
              <SectionBlock num={4} title="Competências Desenvolvidas">
                {form.technicalCompetencies && <TextField label="Competências técnicas" value={form.technicalCompetencies} />}
                {form.pedagogicalCompetencies && <TextField label="Competências pedagógicas" value={form.pedagogicalCompetencies} />}
                {form.socioemotionalCompetencies && <TextField label="Competências socioemocionais" value={form.socioemotionalCompetencies} />}
              </SectionBlock>
            )}

            {form.syllabusDescription && (
              <SectionBlock num={5} title="Ementa">
                <p className="text-sm text-gray-700 leading-relaxed">{form.syllabusDescription}</p>
              </SectionBlock>
            )}

            {(form.educationalResources || []).length > 0 && (
              <SectionBlock num={6} title="Recursos Educacionais">
                <div className="flex flex-wrap gap-2">
                  {form.educationalResources.map((v) => (
                    <span key={v} className="bg-brand-50 text-brand-700 border border-brand-100 text-xs font-semibold px-3 py-1 rounded-full">
                      {RESOURCE_OPTIONS.find((o) => o.value === v)?.label || v}
                    </span>
                  ))}
                </div>
              </SectionBlock>
            )}

            {(form.evaluationCriteria || form.evaluationInstruments) && (
              <SectionBlock num={7} title="Avaliação da Aprendizagem">
                {form.evaluationCriteria && <TextField label="Critérios de avaliação" value={form.evaluationCriteria} />}
                {form.evaluationInstruments && <TextField label="Instrumentos utilizados" value={form.evaluationInstruments} />}
              </SectionBlock>
            )}

            {form.referencesList && (
              <SectionBlock num={8} title="Referências">
                <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{form.referencesList}</div>
              </SectionBlock>
            )}
          </div>

          <div className="px-8 pb-6 flex items-center justify-between text-xs text-gray-400 border-t border-gray-100 pt-4 mt-4">
            <span>Transforma Educação PB · {new Date().getFullYear()}</span>
            <span>Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── main page ─── */

export default function Ementa() {
  const { courseId } = useParams()
  const { user } = useAuth()
  const { courses, materials } = useData()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [ementa, setEmenta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [toast, setToast] = useState(null)

  const course = courses.find((c) => c.id === Number(courseId))
  const isCoord = user?.role === 'coordenador' || String(user?.function || '').toLowerCase().includes('coordenador')

  const canEdit = !!(
    user?.role === 'administrador'
    || course?.producers?.some((p) => Number(p.id) === Number(user?.id))
    || (user?.role === 'supervisor' && (course?.supervisorId === user?.id || course?.supervisorName === user?.name))
    || (isCoord && (course?.coordinatorId === user?.id || course?.coordinatorName === user?.name))
  )

  const isProfessor = !!(
    user?.role === 'administrador'
    || course?.producers?.some((p) => Number(p.id) === Number(user?.id))
  )

  const canEditSupStatus = !!(
    user?.role === 'administrador'
    || (user?.role === 'supervisor' && (course?.supervisorId === user?.id || course?.supervisorName === user?.name))
  )

  const canEditCoordStatus = !!(
    user?.role === 'administrador'
    || (isCoord && (course?.coordinatorId === user?.id || course?.coordinatorName === user?.name))
  )

  const isFinalizado = ementa?.professorStatus === 'concluido'
  const isApproved = isFinalizado && ementa?.supervisorStatus === 'valido' && ementa?.coordinatorStatus === 'valido'
  const formDisabled = isFinalizado && !canEdit

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/ementas/${courseId}`)
        if (data) {
          setEmenta(data)
          setForm({
            contextualization: data.contextualization || '',
            justification: data.justification || '',
            relevance: data.relevance || '',
            generalObjective: data.generalObjective || '',
            specificObjectives: data.specificObjectives?.length ? data.specificObjectives : [''],
            technicalCompetencies: data.technicalCompetencies || '',
            pedagogicalCompetencies: data.pedagogicalCompetencies || '',
            socioemotionalCompetencies: data.socioemotionalCompetencies || '',
            syllabusDescription: data.syllabusDescription || '',
            educationalResources: data.educationalResources || [],
            evaluationCriteria: data.evaluationCriteria || '',
            evaluationInstruments: data.evaluationInstruments || '',
            referencesList: data.referencesList || '',
          })
        }
      } catch {
        /* ementa ainda não existe — ok */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  const saveDraft = async () => {
    setSaving(true)
    try {
      const { data } = await api.put(`/ementas/${courseId}`, form)
      setEmenta(data)
      showToast('Rascunho salvo!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao salvar.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    if (canEdit && !isFinalizado) await saveDraft()
    setStep((s) => Math.min(8, s + 1))
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await api.put(`/ementas/${courseId}`, form)
      const { data } = await api.patch(`/ementas/${courseId}/status`, { professorStatus: 'concluido' })
      setEmenta(data)
      showToast('Ementa enviada para revisão!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao enviar.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusUpdate = async (update) => {
    try {
      const { data } = await api.patch(`/ementas/${courseId}/status`, update)
      setEmenta(data)
      showToast('Status atualizado!')
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Erro ao atualizar status.'), 'error')
    }
  }

  const handlePrint = () => {
    if (!course) return
    const courseMaterials = materials.filter((m) => m.course === course.name)
    const totalContents = courseMaterials.length
    const totalModules = new Set(courseMaterials.map((m) => m.module || 1)).size
    const producers = course.producers?.map((p) => p.name).join(', ') || '—'
    const specificObjs = (form.specificObjectives || []).filter(Boolean)
    const resources = (form.educationalResources || []).map((v) => RESOURCE_OPTIONS.find((o) => o.value === v)?.label || v)

    const sec = (num, title, content) => `
      <div class="section">
        <div class="section-title"><span class="num">${num}</span>${title}</div>
        <div class="section-body">${content}</div>
      </div>`

    const field = (label, value) => value ? `<div class="field"><div class="field-label">${label}</div><div class="field-value">${value}</div></div>` : ''

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Ementa — ${course.name}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Georgia,serif;color:#1a1a2e;font-size:12pt;line-height:1.6}
        .header{background:linear-gradient(135deg,#1e3a5f,#2d6a9f);color:#fff;padding:32px 48px}
        .header-sys{font-size:9pt;letter-spacing:3px;text-transform:uppercase;opacity:.7;margin-bottom:8px}
        .header-title{font-size:22pt;font-weight:700;line-height:1.2}
        .header-sub{font-size:11pt;opacity:.8;margin-top:6px}
        .header-chips{display:flex;gap:10px;margin-top:14px}
        .chip{background:rgba(255,255,255,.15);border-radius:20px;padding:4px 12px;font-size:9pt}
        .status-bar{display:flex;gap:24px;padding:10px 48px;background:#f8faff;border-bottom:1px solid #dce8f5}
        .s-item{display:flex;align-items:center;gap:8px;font-size:10pt}
        .dot{width:9px;height:9px;border-radius:50%}
        .dot-green{background:#22c55e}.dot-amber{background:#f59e0b}.dot-gray{background:#9ca3af}.dot-red{background:#ef4444}
        .content{padding:32px 48px}
        .section{margin-bottom:28px;page-break-inside:avoid}
        .section-title{font-size:13pt;font-weight:700;color:#1e3a5f;border-left:4px solid #2d6a9f;padding-left:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px}
        .num{background:#1e3a5f;color:#fff;font-size:9pt;font-weight:700;padding:2px 7px;border-radius:4px}
        .section-body{padding-left:20px}
        .field{margin-bottom:12px}
        .field-label{font-size:10pt;font-weight:700;color:#555;margin-bottom:3px}
        .field-value{color:#333}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
        .info-box{background:#f8faff;border:1px solid #dce8f5;border-radius:8px;padding:10px 14px}
        .info-label{font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#7a9cbf;font-weight:700;margin-bottom:3px}
        .info-val{font-size:11pt;font-weight:700;color:#1e3a5f}
        ul{padding-left:20px}li{margin-bottom:5px}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .tag{background:#e8f0fb;color:#1e3a5f;padding:3px 12px;border-radius:20px;font-size:10pt}
        .footer{margin-top:32px;padding:14px 48px;border-top:1px solid #dce8f5;display:flex;justify-content:space-between;font-size:9pt;color:#888}
        @page{margin:0}
        @media print{.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <div class="header">
        <div class="header-sys">Secretaria de Educação · Transforma Educação PB</div>
        <div class="header-title">${course.name}</div>
        ${course.trail ? `<div class="header-sub">${course.trail} · ${course.primaryTrail || ''}</div>` : ''}
        <div class="header-chips">
          <span class="chip">${totalContents} conteúdo${totalContents !== 1 ? 's' : ''}</span>
          <span class="chip">${totalModules} módulo${totalModules !== 1 ? 's' : ''}</span>
          <span class="chip">Ementa · ${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      <div class="status-bar">
        <div class="s-item"><div class="dot ${ementa?.professorStatus === 'concluido' ? 'dot-green' : 'dot-amber'}"></div>Professor: ${STATUS_LABELS[ementa?.professorStatus] || 'Rascunho'}</div>
        <div class="s-item"><div class="dot ${ementa?.supervisorStatus === 'valido' ? 'dot-green' : ementa?.supervisorStatus === 'nao_valido' ? 'dot-red' : 'dot-gray'}"></div>Supervisor: ${STATUS_LABELS[ementa?.supervisorStatus] || 'Pendente'}</div>
        <div class="s-item"><div class="dot ${ementa?.coordinatorStatus === 'valido' ? 'dot-green' : ementa?.coordinatorStatus === 'nao_valido' ? 'dot-red' : 'dot-gray'}"></div>Coordenador: ${STATUS_LABELS[ementa?.coordinatorStatus] || 'Pendente'}</div>
      </div>
      <div class="content">
        ${sec(1, 'Identificação do Curso', `
          <div class="info-grid">
            <div class="info-box"><div class="info-label">Título</div><div class="info-val">${course.name}</div></div>
            <div class="info-box"><div class="info-label">Trilha principal</div><div class="info-val">${course.primaryTrail || '—'}</div></div>
            <div class="info-box"><div class="info-label">Trilha secundária</div><div class="info-val">${course.trail || '—'}</div></div>
            <div class="info-box"><div class="info-label">Conteúdos</div><div class="info-val">${totalContents} conteúdos · ${totalModules} módulos</div></div>
          </div>
          ${field('Produtores', producers)}`)}
        ${(form.contextualization || form.justification || form.relevance) ? sec(2, 'Apresentação',
          field('Contextualização do tema', form.contextualization) +
          field('Justificativa da oferta', form.justification) +
          field('Relevância para o público-alvo', form.relevance)) : ''}
        ${(form.generalObjective || specificObjs.length) ? sec(3, 'Objetivos',
          field('Objetivo Geral', form.generalObjective) +
          (specificObjs.length ? `<div class="field"><div class="field-label">Objetivos Específicos</div><ul>${specificObjs.map((o, i) => `<li><b>${i + 1}.</b> ${o}</li>`).join('')}</ul></div>` : '')) : ''}
        ${(form.technicalCompetencies || form.pedagogicalCompetencies || form.socioemotionalCompetencies) ? sec(4, 'Competências Desenvolvidas',
          field('Competências técnicas', form.technicalCompetencies) +
          field('Competências pedagógicas', form.pedagogicalCompetencies) +
          field('Competências socioemocionais', form.socioemotionalCompetencies)) : ''}
        ${form.syllabusDescription ? sec(5, 'Ementa', `<div class="field-value">${form.syllabusDescription}</div>`) : ''}
        ${resources.length ? sec(6, 'Recursos Educacionais', `<div class="chips">${resources.map((r) => `<span class="tag">${r}</span>`).join('')}</div>`) : ''}
        ${(form.evaluationCriteria || form.evaluationInstruments) ? sec(7, 'Avaliação da Aprendizagem',
          field('Critérios de avaliação', form.evaluationCriteria) +
          field('Instrumentos utilizados', form.evaluationInstruments)) : ''}
        ${form.referencesList ? sec(8, 'Referências', `<div class="field-value">${form.referencesList.replace(/\n/g, '<br>')}</div>`) : ''}
      </div>
      <div class="footer"><span>Transforma Educação PB · ${new Date().getFullYear()}</span><span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span></div>
    </body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="text-center py-20 text-gray-500">
        <FileText size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="mb-4">Curso não encontrado.</p>
        <button onClick={() => navigate('/cursos')} className="btn-secondary">Voltar para Cursos</button>
      </div>
    )
  }

  const currentStep = STEPS[step - 1]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate('/cursos')} className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium mb-1.5 group">
            <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
            Voltar para Cursos
          </button>
          <h1 className="page-title">Ementa</h1>
          <p className="page-subtitle truncate max-w-xl">{course.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handlePrint} className="btn-secondary gap-1.5 text-sm">
            <Printer size={14} />
            Imprimir / PDF
          </button>
          <button onClick={() => setViewOpen(true)} className="btn-secondary gap-1.5 text-sm">
            <Eye size={14} />
            Visualizar
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <StatusControl
              label="Professor"
              value={ementa?.professorStatus || 'rascunho'}
              options={['rascunho', 'concluido']}
              canEdit={isProfessor}
              onChange={(val) => handleStatusUpdate({ professorStatus: val })}
            />
            <ChevronRight size={14} className="text-gray-300" />
            <StatusControl
              label="Supervisor"
              value={ementa?.supervisorStatus || 'pendente'}
              options={['pendente', 'valido', 'nao_valido']}
              canEdit={canEditSupStatus}
              onChange={(val) => handleStatusUpdate({ supervisorStatus: val })}
            />
            <ChevronRight size={14} className="text-gray-300" />
            <StatusControl
              label="Coordenador"
              value={ementa?.coordinatorStatus || 'pendente'}
              options={['pendente', 'valido', 'nao_valido']}
              canEdit={canEditCoordStatus}
              onChange={(val) => handleStatusUpdate({ coordinatorStatus: val })}
            />
          </div>

          {isApproved && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-lg border border-green-200">
              <CheckCircle size={12} /> Ementa aprovada
            </span>
          )}
        </div>
      </div>

      {/* Wizard card */}
      <div className="card p-0 overflow-hidden">
        {/* Step progress */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <button onClick={() => setStep(s.id)} title={s.title}
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all flex-shrink-0
                    ${s.id === step ? 'bg-brand-800 text-white ring-2 ring-brand-200' : s.id < step ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                  {s.id < step ? <CheckCircle size={13} /> : s.id}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${s.id < step ? 'bg-brand-200' : 'bg-gray-100'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-sm font-semibold text-gray-800">{currentStep.title}</div>
            <div className="text-xs text-gray-400">{currentStep.desc} · Etapa {step} de {STEPS.length}</div>
          </div>
        </div>

        {/* Step content */}
        <div className="p-6 min-h-[340px]">
          {step === 1 && <StepIdentificacao course={course} materials={materials} />}
          {step === 2 && <StepApresentacao form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 3 && <StepObjetivos form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 4 && <StepCompetencias form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 5 && <StepEmenta form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 6 && <StepRecursos form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 7 && <StepAvaliacao form={form} setForm={setForm} disabled={formDisabled} />}
          {step === 8 && <StepReferencias form={form} setForm={setForm} disabled={formDisabled} />}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
            className="flex items-center gap-1.5 btn-secondary disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft size={14} /> Anterior
          </button>

          <div className="flex items-center gap-2">
            {canEdit && !isFinalizado && (
              <button onClick={saveDraft} disabled={saving} className="btn-secondary">
                {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
            )}

            {step < 8 ? (
              <button onClick={handleNext} disabled={saving} className="btn-primary">
                Próximo <ChevronRight size={14} />
              </button>
            ) : (
              canEdit && !isFinalizado && (
                <button onClick={handleSubmit} disabled={saving}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors">
                  <Send size={14} />
                  {saving ? 'Enviando...' : 'Enviar para revisão'}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* View modal */}
      {viewOpen && (
        <EmentaViewModal
          course={course}
          ementa={ementa}
          form={form}
          materials={materials}
          onClose={() => setViewOpen(false)}
          onPrint={handlePrint}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in
          ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`}>
          <CheckCircle size={16} className={toast.type === 'error' ? 'text-red-200' : 'text-green-400'} />
          {toast.msg}
        </div>
      )}
    </div>
  )
}
