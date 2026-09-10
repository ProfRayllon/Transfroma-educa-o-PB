import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../lib/api'
import { Cartao, TituloDeBloco } from './graficos'

/**
 * O detalhamento da avaliação, resposta a resposta.
 *
 * Busca os próprios dados, fora do pacote do dashboard, pelo mesmo motivo da
 * lista de concluintes: dez mil linhas dentro de um payload com cache de um
 * minuto fariam toda abertura do painel carregar uma tabela que quase ninguém
 * rola.
 *
 * O formulário é anônimo na origem -- não há CPF, nome nem e-mail para esconder.
 * O que aparece é quando, de que turma, de que componente, e o que foi marcado.
 */

const br = (n) => Number(n || 0).toLocaleString('pt-BR')

/**
 * As três perguntas que viram coluna, além da nota.
 *
 * Escolhidas por serem as que a coordenação lê primeiro: se o conteúdo serve,
 * se estava claro, e se conversa com a sala de aula -- esta última por ser a
 * única que destoa das demais.
 *
 * A resposta aparece como TEXTO, do jeito que foi marcada. Converter 'Muito
 * relevante' para 5 daria uma tabela de números alinhados e uma escala
 * inventada: as perguntas têm 3, 4 e 5 opções, e o mesmo "5" significaria coisas
 * diferentes em colunas vizinhas.
 */
const COLUNAS_DE_RESPOSTA = [
  { titulo: 'Relevância', padrao: /relevante para a prática/i },
  { titulo: 'Clareza', padrao: /claros e bem estruturados/i },
  { titulo: 'Alinhamento', padrao: /desafios reais/i },
]

const BANDAS = {
  'Muito relevante': 'positiva', Relevante: 'positiva',
  'Pouco relevante': 'negativa', Irrelevante: 'negativa',
  Totalmente: 'positiva', Parcialmente: 'neutra', Pouco: 'negativa', Nada: 'negativa',
  Sim: 'positiva', Não: 'negativa',
}

const CORES = {
  positiva: { cor: '#059669', fundo: 'rgba(5,150,105,0.12)' },
  neutra: { cor: '#B45309', fundo: 'rgba(180,83,9,0.12)' },
  negativa: { cor: '#DC2626', fundo: 'rgba(220,38,38,0.12)' },
}

const FILTROS = [
  ['', 'Todas'],
  ['positiva', 'Positivas'],
  ['neutra', 'Neutras'],
  ['negativa', 'Negativas'],
]

const dataBr = (quando) => (quando ? quando.slice(0, 10).split('-').reverse().join('/') : '—')

function Marca({ valor }) {
  const banda = BANDAS[valor]
  if (!valor) return <span style={{ color: 'var(--p-texto3)' }}>—</span>
  if (!banda) return <span style={{ color: 'var(--p-texto2)' }}>{valor}</span>
  const c = CORES[banda]
  return (
    <span className="px-2 py-0.5 rounded-md text-[11.5px] font-medium whitespace-nowrap"
      style={{ background: c.fundo, color: c.cor }}>
      {valor}
    </span>
  )
}

export default function DetalheDaAvaliacao({ cursoId, componente, perguntas }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [pagina, setPagina] = useState(1)
  const [baixando, setBaixando] = useState(false)

  // A busca espera a pessoa parar de digitar: sem isso "Matemática" dispara dez
  // consultas, e a resposta da terceira pode chegar depois da décima.
  const [termo, setTermo] = useState('')
  const relogio = useRef(null)
  useEffect(() => {
    clearTimeout(relogio.current)
    relogio.current = setTimeout(() => { setTermo(busca); setPagina(1) }, 350)
    return () => clearTimeout(relogio.current)
  }, [busca])

  useEffect(() => { setPagina(1) }, [cursoId, componente, situacao])

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel/avaliacao/detalhe', {
      params: {
        ...(cursoId ? { curso: cursoId } : {}),
        ...(componente ? { componente } : {}),
        ...(situacao ? { situacao } : {}),
        ...(termo ? { busca: termo } : {}),
        pagina,
        porPagina: 25,
      },
    })
      .then(({ data }) => { setDados(data); setErro(null) })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar o detalhamento.'))
      .finally(() => setCarregando(false))
  }, [cursoId, componente, situacao, termo, pagina])

  useEffect(carregar, [carregar])

  /* A exportação passa pelo axios, e não por um link: a sessão é um Bearer no
     cabeçalho, e um <a href> não carrega cabeçalho -- voltaria 401 e o navegador
     só mostraria um download quebrado. */
  const exportar = async () => {
    setBaixando(true)
    try {
      const resposta = await api.get('/painel/avaliacao/exportar', {
        params: { ...(cursoId ? { curso: cursoId } : {}), ...(componente ? { componente } : {}) },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `avaliacao-do-curso-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não foi possível exportar a avaliação.')
    } finally {
      setBaixando(false)
    }
  }

  // A ordem da pergunta é a chave do JSON de respostas. Casada aqui pelo texto
  // para a tabela sobreviver a uma pergunta inserida no meio do formulário.
  const ordens = COLUNAS_DE_RESPOSTA.map((c) => {
    const achou = (perguntas || []).find((q) => c.padrao.test(q.pergunta))
    return { titulo: c.titulo, ordem: achou ? String(achou.ordem) : null }
  }).filter((c) => c.ordem)

  const total = dados?.total || 0
  const porPagina = dados?.porPagina || 25
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const primeira = total ? (pagina - 1) * porPagina + 1 : 0
  const ultima = Math.min(pagina * porPagina, total)

  return (
    <Cartao className="flex flex-col">
      <TituloDeBloco
        acao={
          <button
            onClick={exportar}
            disabled={baixando || !total}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
          >
            <Download size={14} />
            {baixando ? 'Gerando...' : 'Exportar respostas'}
          </button>
        }
      >
        Detalhamento das respostas
      </TituloDeBloco>

      <p className="text-[12.5px] -mt-2 mb-4" style={{ color: 'var(--p-texto3)' }}>
        Respostas anônimas. A planilha exportada traz todas as perguntas, com o texto
        que cada pessoa marcou.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--p-texto3)' }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por componente ou turma..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--p-cartaoBorda)',
              background: 'var(--p-cartao)',
              color: 'var(--p-texto)',
            }}
          />
        </label>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--p-trilho)' }}>
          {FILTROS.map(([chave, rotulo]) => (
            <button
              key={chave || 'todas'}
              onClick={() => setSituacao(chave)}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: situacao === chave ? 'var(--p-balao)' : 'transparent',
                color: situacao === chave ? 'var(--p-texto)' : 'var(--p-texto3)',
                boxShadow: situacao === chave ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <p className="py-10 text-center text-[13px]" style={{ color: 'var(--p-texto3)' }}>{erro}</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr style={{ color: 'var(--p-texto3)' }}>
                  {['Data', 'Turma', 'Componente curricular', 'Nota geral',
                    ...ordens.map((o) => o.titulo), 'Positivas'].map((c) => (
                    <th key={c} className="text-left font-medium pb-2 pr-4 whitespace-nowrap border-b"
                      style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: 'var(--p-texto)' }}>
                {(dados?.itens || []).map((l, i) => (
                  <tr key={`${l.quando}-${i}`} className="border-b"
                    style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                    <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums"
                      style={{ color: 'var(--p-texto2)' }} title={l.quando || ''}>
                      {dataBr(l.quando)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap"
                      style={{ color: 'var(--p-texto2)' }}>{l.turma || '—'}</td>
                    <td className="py-2.5 pr-4 max-w-[200px] truncate" title={l.componente || ''}>
                      {l.componente || '—'}
                    </td>
                    <td className="py-2.5 pr-4">
                      {l.nota === null ? '—' : (
                        <span className="px-2 py-0.5 rounded-md text-[11.5px] font-semibold tabular-nums"
                          style={{
                            background: CORES[l.nota >= 4 ? 'positiva' : l.nota === 3 ? 'neutra' : 'negativa'].fundo,
                            color: CORES[l.nota >= 4 ? 'positiva' : l.nota === 3 ? 'neutra' : 'negativa'].cor,
                          }}>
                          {l.nota} / 5
                        </span>
                      )}
                    </td>
                    {ordens.map((o) => (
                      <td key={o.titulo} className="py-2.5 pr-4">
                        <Marca valor={l.respostas?.[o.ordem]} />
                      </td>
                    ))}
                    <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--p-texto2)' }}>
                      {l.positivas} de {l.respondidas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!carregando && !dados?.itens?.length && (
            <p className="py-10 text-center text-[13px]" style={{ color: 'var(--p-texto3)' }}>
              {termo ? `Nenhuma resposta encontrada para "${termo}".` : 'Nenhuma resposta nesta seleção.'}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 mt-4 text-[12.5px]"
            style={{ color: 'var(--p-texto3)' }}>
            <span>
              {carregando ? 'Carregando...'
                : total ? `${br(primeira)}–${br(ultima)} de ${br(total)} respostas` : ''}
            </span>

            {paginas > 1 && (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-35"
                  style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-2 tabular-nums">{br(pagina)} / {br(paginas)}</span>
                <button
                  onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                  disabled={pagina >= paginas}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-35"
                  style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
                  aria-label="Próxima página"
                >
                  <ChevronRight size={15} />
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </Cartao>
  )
}
