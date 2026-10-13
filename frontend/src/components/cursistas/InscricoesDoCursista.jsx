import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import api, { getApiErrorMessage } from '../../lib/api'

/**
 * Os cursos em que o cursista esta inscrito, e a inscricao feita pelo
 * administrador em qualquer curso -- aberto, encerrado ou ainda por abrir.
 *
 * Cada acao grava na hora, sem passar pelo "Salvar" do cadastro: inscrever
 * alguem nao e editar o cadastro dele, e misturar os dois faria um erro num
 * campo do formulario segurar a inscricao.
 */

const SITUACAO = {
  aberto: { texto: 'inscrições abertas', cls: 'bg-green-50 text-green-700 border-green-200' },
  em_breve: { texto: 'em breve', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  encerrado: { texto: 'encerrado', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  sem_janela: { texto: 'sem datas', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const STATUS = {
  inscrito: 'Inscrito',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export default function InscricoesDoCursista({ cursistaId }) {
  const [dados, setDados] = useState(null)
  const [cursos, setCursos] = useState([])
  const [escolhido, setEscolhido] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)

  const carregar = useCallback(() => {
    api.get(`/cursistas/admin/cursistas/${cursistaId}/inscricoes`)
      .then(({ data }) => setDados(data))
      .catch((e) => setErro(getApiErrorMessage(e, 'Não foi possível carregar as inscrições.')))
  }, [cursistaId])

  useEffect(() => {
    carregar()
    api.get('/cursistas/admin/cursos-para-inscricao').then(({ data }) => setCursos(data)).catch(() => setCursos([]))
  }, [carregar])

  const executar = async (acao, mensagem) => {
    setOcupado(true)
    setErro(null)
    setAviso(null)
    try {
      await acao()
      setAviso(mensagem)
      carregar()
      return true
    } catch (e) {
      setErro(getApiErrorMessage(e, 'Não foi possível concluir.'))
      return false
    } finally {
      setOcupado(false)
    }
  }

  const inscrever = async () => {
    const curso = cursos.find((c) => String(c.id) === escolhido)
    if (!curso) return
    const ok = await executar(
      () => api.post(`/cursistas/admin/cursistas/${cursistaId}/inscricoes`, { courseId: curso.id }),
      `Inscrito em ${curso.nome}.`,
    )
    if (ok) setEscolhido('')
  }

  const cancelar = (inscricao) => executar(
    () => api.delete(`/cursistas/admin/cursistas/${cursistaId}/inscricoes/${inscricao.courseId}`),
    `Inscrição em ${inscricao.curso} cancelada.`,
  )

  const atuais = (dados?.inscricoes || []).filter((i) => i.edicao === dados.edicaoAtual && i.status !== 'cancelado')
  const jaInscrito = new Set(atuais.map((i) => i.courseId))
  const outras = (dados?.inscricoes || []).filter((i) => !atuais.includes(i))

  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Cursos inscritos {dados && `· ${dados.edicaoAtual}`}
        </h4>
        <p className="text-[11px] text-gray-400 mt-0.5">
          O administrador pode inscrever em qualquer curso, aberto ou não. O curso aparece na área do cursista no próximo acesso.
        </p>
      </div>

      {!dados && !erro && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Carregando…</p>}

      {dados && (
        <ul className="space-y-1.5 mb-3">
          {atuais.length === 0 && <li className="text-xs text-gray-400">Nenhuma inscrição nesta edição.</li>}
          {atuais.map((i) => {
            const sit = SITUACAO[i.situacao] || SITUACAO.sem_janela
            return (
              <li key={i.courseId} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                <span className="flex-1 min-w-0 text-sm text-gray-800 truncate" title={i.curso}>{i.curso}</span>
                {i.obrigatoria && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-brand-50 text-brand-700 border-brand-200">obrigatório</span>}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sit.cls}`}>{sit.texto}</span>
                <span className="text-[11px] text-gray-500 w-16 text-right">{STATUS[i.status] || i.status}</span>
                {i.status === 'inscrito' ? (
                  <button
                    type="button"
                    onClick={() => cancelar(i)}
                    disabled={ocupado}
                    title="Cancelar inscrição"
                    className="p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors disabled:opacity-40"
                  >
                    <X size={14} />
                  </button>
                ) : <span className="w-[22px]" />}
              </li>
            )
          })}
        </ul>
      )}

      {dados && (
        <div className="flex items-center gap-2">
          <select
            value={escolhido}
            onChange={(e) => setEscolhido(e.target.value)}
            className="select-field flex-1"
          >
            <option value="">Escolha um curso para inscrever…</option>
            {cursos.filter((c) => !jaInscrito.has(c.id)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {(SITUACAO[c.situacao] || SITUACAO.sem_janela).texto}
              </option>
            ))}
          </select>
          <button type="button" onClick={inscrever} disabled={!escolhido || ocupado} className="btn-primary text-xs disabled:opacity-40">
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Inscrever
          </button>
        </div>
      )}

      {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
      {aviso && <p className="text-xs text-green-700 mt-2">{aviso}</p>}

      {outras.length > 0 && (
        <details className="mt-3">
          <summary className="text-[11px] text-gray-400 cursor-pointer">Histórico ({outras.length})</summary>
          <ul className="mt-1.5 space-y-1">
            {outras.map((i) => (
              <li key={`${i.courseId}-${i.edicao}`} className="text-[11px] text-gray-500">
                {i.curso} · {i.edicao} · {STATUS[i.status] || i.status}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
