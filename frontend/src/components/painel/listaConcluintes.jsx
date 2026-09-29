import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Search, Download, ChevronLeft, ChevronRight, Columns, Loader2, X,
} from 'lucide-react'
import api from '../../lib/api'
import { Cartao, TituloDeBloco } from './graficos'

/**
 * A lista de docentes dos cursos.
 *
 * Uma linha por PESSOA, e uma coluna por curso. A versão anterior mostrava uma
 * linha por vínculo -- curso vezes escola --, e o rodapé somava dezoito mil para
 * uma rede de doze mil docentes: quem fazia dois cursos em duas escolas aparecia
 * quatro vezes. O número estava certo e a pergunta estava errada. Agora o
 * docente é a linha, o que ele fez em cada curso é a célula, e o total volta a
 * ser gente.
 *
 * Busca os próprios dados, e não vem no pacote do dashboard: aquele são dez KB
 * de agregados com cache de um minuto, e enfiar milhares de linhas de gente
 * dentro dele faria toda abertura do painel carregar uma tabela que quase
 * ninguém rola -- além de deixar dado pessoal parado na memória do processo.
 *
 * O CPF chega mascarado do servidor e nem vem por padrão. Não é a tela que
 * esconde: mascarar no navegador ainda entregaria o número inteiro pela rede, e
 * qualquer pessoa o leria no inspetor. O número completo existe só no arquivo.
 */

const ESPERA_DIGITACAO = 400
const br = (n) => Number(n || 0).toLocaleString('pt-BR')

const SITUACOES = {
  'Concluído': { cor: '#059669', fundo: 'rgba(5,150,105,0.12)' },
  'Não concluiu': { cor: '#B45309', fundo: 'rgba(180,83,9,0.12)' },
  'Em andamento': { cor: '#7C3AED', fundo: 'rgba(124,58,237,0.12)' },
}

const estiloDeCampo = {
  borderColor: 'var(--p-cartaoBorda)',
  background: 'var(--p-cartao)',
  color: 'var(--p-texto)',
}

function Campo({ rotulo, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--p-texto3)' }}>
        {rotulo}
      </span>
      {children}
    </label>
  )
}

export default function ListaDeConcluintes({ cursoId, gre, cursoNome = '' }) {
  const [filtros, setFiltros] = useState({ inep: '', situacao: '' })
  const [colunas, setColunas] = useState(null)
  const [dados, setDados] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [baixando, setBaixando] = useState(false)
  const [abrirColunas, setAbrirColunas] = useState(false)
  const caixaDeColunas = useRef(null)

  /* A digitação não dispara uma consulta por tecla: o nome só vai ao servidor
     quando a pessoa para de digitar. Sem isso, escrever "MARIA" são cinco
     varreduras, e a resposta da terceira pode chegar depois da quinta. */
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca); setPagina(1) }, ESPERA_DIGITACAO)
    return () => clearTimeout(t)
  }, [busca])

  /* O curso e a regional vêm do filtro do painel, lá em cima. Trocar qualquer um
     deles muda o universo inteiro: continuar na página sete de uma lista que
     agora tem duas seria uma tela vazia sem explicação. */
  useEffect(() => { setPagina(1) }, [cursoId, gre, filtros])

  const parametros = useCallback(() => ({
    ...(cursoId ? { curso: cursoId } : {}),
    ...(gre ? { gre } : {}),
    ...(filtros.inep ? { inep: filtros.inep } : {}),
    ...(filtros.situacao ? { situacao: filtros.situacao } : {}),
    ...(termo ? { busca: termo } : {}),
    colunas: (colunas || []).join(','),
  }), [cursoId, gre, filtros, termo, colunas])

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel/docentes', { params: { ...parametros(), pagina, porPagina: 25 } })
      .then(({ data }) => {
        setDados(data)
        setErro(null)
        // Na primeira resposta o servidor diz quais colunas existem e quais são
        // as padrão; daí em diante quem manda é a escolha de quem está na tela.
        if (!colunas) setColunas(data.colunas.map((c) => c.chave))
      })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar a lista.'))
      .finally(() => setCarregando(false))
  }, [parametros, pagina, colunas])

  useEffect(carregar, [carregar])

  /* Clicar fora fecha a lista de colunas. Ela cobre parte da tabela, e deixá-la
     aberta obrigaria a voltar ao botão para ver o que mudou. */
  useEffect(() => {
    if (!abrirColunas) return undefined
    const fora = (e) => {
      if (caixaDeColunas.current && !caixaDeColunas.current.contains(e.target)) setAbrirColunas(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [abrirColunas])

  const catalogo = dados?.opcoes?.colunas || []
  const situacoes = dados?.opcoes?.situacoes || []
  const visiveis = dados?.colunas || []
  const temFiltro = Boolean(filtros.inep || filtros.situacao || termo)

  const paginas = Math.max(1, Math.ceil((dados?.total || 0) / (dados?.porPagina || 25)))

  const trocarColuna = (chave) => {
    setColunas((atual) => {
      const lista = atual || []
      if (lista.includes(chave)) {
        // O nome é o que identifica a linha, e por isso ele não sai.
        if (chave === 'nome' || lista.length === 1) return lista
        return lista.filter((c) => c !== chave)
      }
      // Entra na ordem do catálogo, e não na ordem dos cliques: assim ligar e
      // desligar uma coluna não embaralha a tabela inteira.
      const ordem = catalogo.map((c) => c.chave)
      return [...lista, chave].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
    })
    setPagina(1)
  }

  const limpar = () => {
    setFiltros({ inep: '', situacao: '' })
    setBusca('')
    setPagina(1)
  }

  /**
   * O download passa pelo axios, e não por um link direto.
   *
   * A sessão é um Bearer no cabeçalho, não um cookie -- e um `<a href>` comum
   * não carrega cabeçalho nenhum. O arquivo voltaria 401 sem que a tela
   * percebesse: o navegador só mostraria um download quebrado.
   */
  const baixar = async () => {
    setBaixando(true)
    try {
      const resposta = await api.get('/painel/docentes/exportar', {
        params: parametros(),
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = `docentes-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setErro('Não foi possível gerar o arquivo.')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <Cartao className="flex flex-col">
      <TituloDeBloco
        acao={
          <div className="flex items-center gap-2">
            <div className="relative" ref={caixaDeColunas}>
              <button
                type="button"
                onClick={() => setAbrirColunas((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] border transition-colors"
                style={estiloDeCampo}
              >
                <Columns size={13} />
                Colunas ({visiveis.length})
              </button>
              {abrirColunas && (
                <div className="absolute right-0 top-full mt-1 z-20 p-2 rounded-xl border shadow-lg w-72 max-h-80 overflow-y-auto"
                  style={{ ...estiloDeCampo, borderColor: 'var(--p-cartaoBorda)' }}>
                  {/* Os cursos ficam agrupados no fim, sob um rótulo: eles são
                      colunas de outra natureza -- aparecem e somem conforme as
                      planilhas vão sendo importadas. */}
                  {['fixa', 'curso'].map((grupo) => {
                    const doGrupo = catalogo.filter((c) => (grupo === 'curso') === !!c.curso)
                    if (!doGrupo.length) return null
                    return (
                      <div key={grupo}>
                        {grupo === 'curso' && (
                          <p className="text-[10.5px] uppercase tracking-wide px-2 pt-2 pb-1"
                            style={{ color: 'var(--p-texto3)' }}>
                            Situação por curso
                          </p>
                        )}
                        {doGrupo.map((c) => (
                          <label key={c.chave}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] hover:opacity-80">
                            <input
                              type="checkbox"
                              checked={(colunas || []).includes(c.chave)}
                              onChange={() => trocarColuna(c.chave)}
                              disabled={c.chave === 'nome'}
                              className="accent-current"
                            />
                            <span className="truncate" title={c.titulo}
                              style={{ color: 'var(--p-texto)' }}>{c.titulo}</span>
                          </label>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={baixar}
              disabled={baixando || !dados?.total}
              title={dados?.total ? 'Baixar em .xlsx o que está filtrado' : 'Nada para baixar'}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--p-r4)', color: '#FFFFFF' }}
            >
              {baixando ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {baixando ? 'Gerando…' : 'Baixar lista'}
            </button>
          </div>
        }
      >
        Lista de docentes
      </TituloDeBloco>

      {/* ─── Filtros ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Campo rotulo="Nome ou CPF">
          <span className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--p-texto3)' }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="a partir de 3 letras"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
            />
          </span>
        </Campo>

        <Campo rotulo="INEP">
          <input
            value={filtros.inep}
            onChange={(e) => setFiltros((f) => ({ ...f, inep: e.target.value.replace(/\D/g, '') }))}
            placeholder="código da escola"
            inputMode="numeric"
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          />
        </Campo>

        {/* Com um curso escolhido lá em cima, a situação pergunta sobre AQUELE
            curso; sem curso, pergunta se a pessoa tem essa situação em algum. O
            rótulo diz qual das duas está valendo. */}
        <Campo rotulo={cursoNome ? `Situação em ${cursoNome}` : 'Situação em algum curso'}>
          <select
            value={filtros.situacao}
            onChange={(e) => setFiltros((f) => ({ ...f, situacao: e.target.value }))}
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          >
            <option value="">Todas</option>
            {situacoes.map((s) => <option key={s.chave} value={s.chave}>{s.rotulo}</option>)}
          </select>
        </Campo>
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
                <tr>
                  {visiveis.map((c) => (
                    <th key={c.chave}
                      className="text-left font-semibold px-2 py-2 whitespace-nowrap border-b"
                      style={{ color: 'var(--p-texto2)', borderColor: 'var(--p-cartaoBorda)' }}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dados?.itens || []).map((linha, i) => (
                  <tr key={i} style={{ background: i % 2 ? 'var(--p-trilho)' : 'transparent' }}>
                    {visiveis.map((c) => {
                      const valor = linha[c.chave]
                      const s = c.curso ? SITUACOES[valor] : null
                      return (
                        <td key={c.chave}
                          className={`px-2 py-2 align-top ${c.curso ? 'whitespace-nowrap' : 'max-w-[260px] truncate'}`}
                          style={{ color: 'var(--p-texto)' }}
                          title={c.curso ? undefined : String(valor ?? '')}>
                          {s ? (
                            <span className="px-2 py-0.5 rounded-md text-[11.5px] font-medium"
                              style={{ background: s.fundo, color: s.cor }}>
                              {valor}
                            </span>
                          ) : (
                            /* Célula de curso vazia quer dizer que a pessoa não
                               está nele -- e não que deixou de concluir. */
                            valor === '' || valor === null || valor === undefined ? '—' : valor
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {!carregando && !dados?.itens?.length && (
              <p className="text-center py-8 text-[13px]" style={{ color: 'var(--p-texto3)' }}>
                {temFiltro ? 'Nenhum docente com esses filtros.'
                  : 'Nenhuma planilha de curso importada ainda.'}
              </p>
            )}
            {carregando && (
              <p className="text-center py-8 text-[13px] flex items-center justify-center gap-2"
                style={{ color: 'var(--p-texto3)' }}>
                <Loader2 size={14} className="animate-spin" /> Carregando…
              </p>
            )}
          </div>

          {/* ─── Rodapé ─── */}
          <div className="flex items-center justify-between gap-3 flex-wrap mt-4 pt-3 border-t"
            style={{ borderColor: 'var(--p-cartaoBorda)' }}>
            <p className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
              {br(dados?.total)} docentes
              {temFiltro && (
                <button type="button" onClick={limpar}
                  className="ml-2 inline-flex items-center gap-1 hover:underline">
                  <X size={11} /> limpar filtros
                </button>
              )}
              {/* Os dois números lado a lado. O de vínculos é o que a planilha
                  original tem, e dizê-lo aqui evita a conversa de "a tela mostra
                  doze mil e a planilha tem dezoito". */}
              <span className="block mt-0.5">
                Uma linha por docente, uma coluna por curso — {br(dados?.vinculos)} vínculos
                de curso e escola estão resumidos nelas. O CPF sai completo só no
                arquivo baixado.
              </span>
            </p>

            {paginas > 1 && (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1} aria-label="Página anterior"
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={estiloDeCampo}>
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[12px] tabular-nums px-1" style={{ color: 'var(--p-texto2)' }}>
                  {br(pagina)} de {br(paginas)}
                </span>
                <button type="button" onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                  disabled={pagina >= paginas} aria-label="Próxima página"
                  className="p-1.5 rounded-lg border disabled:opacity-40" style={estiloDeCampo}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Cartao>
  )
}
