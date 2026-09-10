import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import api from '../../lib/api'
import { Cartao, TituloDeBloco } from './graficos'

/**
 * A lista de docentes do consolidado.
 *
 * Busca os próprios dados, e não vem no pacote do dashboard: aquele são dez KB
 * de agregados com cache de um minuto, e enfiar oito mil linhas de gente dentro
 * dele faria toda abertura do painel carregar uma tabela que quase ninguém
 * rola -- além de deixar dado pessoal parado na memória do processo.
 *
 * O CPF chega mascarado do servidor. Não é a tela que esconde: mascarar no
 * navegador ainda entregaria o número inteiro pela rede, e qualquer pessoa o
 * leria no inspetor. O número completo existe só na exportação.
 */

const br = (n) => Number(n || 0).toLocaleString('pt-BR')

const SITUACOES = {
  concluido: { rotulo: 'Concluído', cor: '#059669', fundo: 'rgba(5,150,105,0.12)' },
  nao_concluido: { rotulo: 'Não concluiu', cor: '#B45309', fundo: 'rgba(180,83,9,0.12)' },
  em_andamento: { rotulo: 'Em andamento', cor: '#7C3AED', fundo: 'rgba(124,58,237,0.12)' },
}

const FILTROS_SITUACAO = [
  ['concluido', 'Concluíram'],
  ['nao_concluido', 'Não concluíram'],
  ['', 'Todos'],
]

export default function ListaDeConcluintes({ cursoId, gre }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('concluido')
  const [pagina, setPagina] = useState(1)

  /**
   * A busca espera a pessoa parar de digitar.
   *
   * Sem isso, "Maria" dispara cinco consultas e a resposta da terceira pode
   * chegar depois da quinta, deixando a tela com o resultado de "Mar".
   */
  const [termo, setTermo] = useState('')
  const relogio = useRef(null)
  useEffect(() => {
    clearTimeout(relogio.current)
    relogio.current = setTimeout(() => { setTermo(busca); setPagina(1) }, 350)
    return () => clearTimeout(relogio.current)
  }, [busca])

  // Trocar de curso ou de regional muda o universo inteiro: continuar na página
  // sete de uma lista que agora tem duas seria uma tela vazia sem explicação.
  useEffect(() => { setPagina(1) }, [cursoId, gre, status])

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel/concluintes/lista', {
      params: {
        ...(cursoId ? { curso: cursoId } : {}),
        ...(gre ? { gre } : {}),
        ...(status ? { status } : {}),
        ...(termo ? { busca: termo } : {}),
        pagina,
        porPagina: 25,
      },
    })
      .then(({ data }) => { setDados(data); setErro(null) })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar a lista.'))
      .finally(() => setCarregando(false))
  }, [cursoId, gre, status, termo, pagina])

  useEffect(carregar, [carregar])

  const total = dados?.total || 0
  const paginas = Math.max(1, Math.ceil(total / (dados?.porPagina || 25)))
  const primeira = total ? (pagina - 1) * (dados?.porPagina || 25) + 1 : 0
  const ultima = Math.min(pagina * (dados?.porPagina || 25), total)

  const [baixando, setBaixando] = useState(false)

  /**
   * A exportação passa pelo axios, e não por um link direto.
   *
   * A sessão é um Bearer no cabeçalho, não um cookie -- e um `<a href>` comum
   * não carrega cabeçalho nenhum. O arquivo voltaria 401 sem que a tela
   * percebesse: o navegador só mostraria um download quebrado.
   */
  const exportar = async () => {
    setBaixando(true)
    try {
      const resposta = await api.get('/painel/concluintes/exportar', {
        params: {
          ...(cursoId ? { curso: cursoId } : {}),
          ...(gre ? { gre } : {}),
          ...(status ? { status } : {}),
        },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `docentes-concluintes-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não foi possível exportar a lista.')
    } finally {
      setBaixando(false)
    }
  }

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
            {baixando ? 'Gerando...' : 'Exportar lista'}
          </button>
        }
      >
        Lista de docentes
      </TituloDeBloco>

      <p className="text-[12.5px] -mt-2 mb-4" style={{ color: 'var(--p-texto3)' }}>
        Uma linha por vínculo com a escola — quem leciona em duas aparece duas vezes,
        que é como a planilha veio. O CPF completo sai apenas na exportação.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <label className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--p-texto3)' }} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-[13px] border focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--p-cartaoBorda)',
              background: 'var(--p-cartao)',
              color: 'var(--p-texto)',
            }}
          />
        </label>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--p-trilho)' }}>
          {FILTROS_SITUACAO.map(([chave, rotulo]) => (
            <button
              key={chave || 'todos'}
              onClick={() => setStatus(chave)}
              className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: status === chave ? 'var(--p-balao)' : 'transparent',
                color: status === chave ? 'var(--p-texto)' : 'var(--p-texto3)',
                boxShadow: status === chave ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
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
          {/* A tabela rola sozinha na horizontal. Sem isso, numa tela estreita
              ela empurraria a página inteira para o lado. */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr style={{ color: 'var(--p-texto3)' }}>
                  {['Docente', 'CPF', 'GRE', 'Escola', 'Curso', 'Situação'].map((c) => (
                    <th key={c} className="text-left font-medium pb-2 pr-4 whitespace-nowrap border-b"
                      style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ color: 'var(--p-texto)' }}>
                {(dados?.itens || []).map((l, i) => {
                  const s = SITUACOES[l.status] || SITUACOES.nao_concluido
                  return (
                    <tr key={`${l.cpf}-${l.escola}-${i}`} className="border-b"
                      style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-1.5">
                          {l.docente}
                          {/* Quem não casou com o cadastro fica marcado na
                              própria linha: some do gráfico por função sem
                              nenhum aviso, e essa é a única pista de por quê. */}
                          {!l.naBase && (
                            <AlertCircle size={13} style={{ color: 'var(--p-texto3)' }}
                              title="Não encontrado na base de cursistas" />
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--p-texto2)' }}>{l.cpf}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap"
                        style={{ color: 'var(--p-texto2)' }}>{l.gre}</td>
                      <td className="py-2.5 pr-4 max-w-[260px] truncate" title={l.escola}
                        style={{ color: 'var(--p-texto2)' }}>{l.escola}</td>
                      <td className="py-2.5 pr-4 max-w-[220px] truncate" title={l.curso}
                        style={{ color: 'var(--p-texto2)' }}>{l.curso}</td>
                      <td className="py-2.5 pr-4">
                        <span className="px-2 py-0.5 rounded-md text-[11.5px] font-medium whitespace-nowrap"
                          style={{ background: s.fundo, color: s.cor }}>
                          {s.rotulo}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!carregando && !dados?.itens?.length && (
            <p className="py-10 text-center text-[13px]" style={{ color: 'var(--p-texto3)' }}>
              {termo ? `Nenhum docente encontrado para "${termo}".` : 'Nenhum docente nesta seleção.'}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 mt-4 text-[12.5px]"
            style={{ color: 'var(--p-texto3)' }}>
            <span>
              {carregando ? 'Carregando...'
                : total ? `${br(primeira)}–${br(ultima)} de ${br(total)}` : ''}
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
