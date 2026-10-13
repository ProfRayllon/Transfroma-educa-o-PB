import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Columns, Loader2, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import api from '../../lib/api'
import { Cartao, TituloDeBloco } from './graficos'

/**
 * A planilha da base, montada por quem está olhando.
 *
 * Os gráficos respondem perguntas que alguém previu. Esta tabela existe para as
 * outras: "os da 5ª GRE que nunca acessaram", "todo mundo da escola tal com
 * telefone". Escolhe-se as colunas e os filtros, vê-se o resultado e baixa-se
 * exatamente o que está na tela.
 *
 * ─── Por que o servidor, e não a tela, faz o recorte ───
 *
 * São treze mil cadastros. Trazer tudo para filtrar no navegador levaria alguns
 * MB por abertura do painel e travaria o celular de quem abre na reunião. Cada
 * mudança de filtro é uma consulta nova, com paginação -- e o arquivo baixado é
 * a mesma consulta sem o limite de página, montada no servidor.
 */

const ESPERA_DIGITACAO = 400

/** Junta os filtros num objeto de query, omitindo o que está vazio. */
const comoParametros = (filtros, colunas, cursoId) => ({
  // O curso vem do filtro do painel, e nao de um campo daqui: a tabela e a
  // continuacao da mesma tela, e mostrar a base inteira embaixo de cartoes ja
  // recortados faz os dois numeros parecerem brigar.
  ...(cursoId ? { curso: cursoId } : {}),
  ...(filtros.gre ? { gre: filtros.gre } : {}),
  ...(filtros.inep ? { inep: filtros.inep } : {}),
  ...(filtros.nome ? { nome: filtros.nome } : {}),
  ...(filtros.situacao ? { situacao: filtros.situacao } : {}),
  ...(filtros.inscricao ? { inscricao: filtros.inscricao } : {}),
  ...(filtros.cursosBase.length ? { cursoBase: filtros.cursosBase.join(',') } : {}),
  ...(filtros.cursosBase.length > 1 && filtros.modo === 'todos' ? { modo: 'todos' } : {}),
  colunas: colunas.join(','),
})

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

const estiloDeCampo = {
  borderColor: 'var(--p-cartaoBorda)',
  background: 'var(--p-cartao)',
  color: 'var(--p-texto)',
}

export default function PlanilhaDaBase({ gres = [], cursoId = null, cursoNome = '' }) {
  const [filtros, setFiltros] = useState({ gre: '', inep: '', nome: '', situacao: '', inscricao: '', cursosBase: [], modo: 'algum' })
  const [colunas, setColunas] = useState(null)
  const [dados, setDados] = useState(null)
  const [pagina, setPagina] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [baixando, setBaixando] = useState(false)
  const [abrirColunas, setAbrirColunas] = useState(false)
  const caixaDeColunas = useRef(null)
  const [abrirCursos, setAbrirCursos] = useState(false)
  const caixaDeCursos = useRef(null)

  useEffect(() => {
    if (!abrirCursos) return undefined
    const fora = (e) => { if (caixaDeCursos.current && !caixaDeCursos.current.contains(e.target)) setAbrirCursos(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [abrirCursos])

  /* A digitação não dispara uma consulta por tecla: o nome só vai ao servidor
     quando a pessoa para de digitar. Sem isso, escrever "MARIA" são cinco
     varreduras na base, e a última é a única que interessa. */
  const [nomeDigitado, setNomeDigitado] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.nome === nomeDigitado ? f : { ...f, nome: nomeDigitado }))
      setPagina(1)
    }, ESPERA_DIGITACAO)
    return () => clearTimeout(t)
  }, [nomeDigitado])

  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel/base', { params: { ...comoParametros(filtros, colunas || [], cursoId), pagina, porPagina: 25 } })
      .then(({ data }) => {
        setDados(data)
        setErro(null)
        // Na primeira resposta o servidor diz quais colunas existem e quais são
        // as padrão; daí em diante quem manda é a escolha de quem está na tela.
        if (!colunas) setColunas(data.colunas.map((c) => c.chave))
      })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar a planilha.'))
      .finally(() => setCarregando(false))
  }, [filtros, colunas, pagina, cursoId])

  useEffect(carregar, [carregar])

  /* Trocar o curso la em cima volta para a primeira pagina: a pagina 7 do
     recorte anterior quase nunca existe no novo, e a tabela voltaria vazia
     como se o curso nao tivesse ninguem. */
  useEffect(() => { setPagina(1) }, [cursoId])

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

  /* Em ordem numérica, e não pelo tamanho da regional: aqui a pessoa procura
     "a 7ª", e achar uma entre dezesseis fora de ordem custa mais do que vale
     ter a maior no topo. */
  const gresOrdenadas = useMemo(
    () => [...gres].sort((a, b) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99)),
    [gres])

  const catalogo = dados?.opcoes?.colunas || []
  const situacoes = dados?.opcoes?.situacoes || []
  const inscricoes = dados?.opcoes?.inscricoes || []
  const cursosDoFiltro = dados?.opcoes?.cursos || []
  const qtdCursos = filtros.cursosBase.length
  // Como os quadros e o filtro de inscricao falam do recorte de cursos.
  const doRecorte = qtdCursos === 0 ? null
    : qtdCursos === 1 ? 'neste curso'
      : filtros.modo === 'todos' ? 'em todos os cursos selecionados' : 'nos cursos selecionados'
  const resumoDosCursos = qtdCursos === 0 ? 'Todos os cursos'
    : qtdCursos === 1 ? (cursosDoFiltro.find((c) => c.id === filtros.cursosBase[0])?.nome || '1 curso')
      : `${qtdCursos} cursos`
  const alternarCurso = (id) => {
    setFiltros((f) => ({
      ...f,
      cursosBase: f.cursosBase.includes(id) ? f.cursosBase.filter((x) => x !== id) : [...f.cursosBase, id],
    }))
    setPagina(1)
  }
  const visiveis = dados?.colunas || []
  const temFiltro = Boolean(filtros.gre || filtros.inep || filtros.nome || filtros.situacao || filtros.inscricao || filtros.cursosBase.length)

  const paginas = useMemo(
    () => Math.max(1, Math.ceil((dados?.total || 0) / (dados?.porPagina || 25))),
    [dados])

  const trocarColuna = (chave) => {
    setColunas((atual) => {
      const lista = atual || []
      if (lista.includes(chave)) {
        // Sobrar zero coluna deixaria uma tabela de cabeçalho vazio; o nome é o
        // que identifica a linha, e por isso ele não sai.
        if (chave === 'nome' || lista.length === 1) return lista
        return lista.filter((c) => c !== chave)
      }
      // Entra na ordem do catálogo, e não na ordem dos cliques: assim ligar e
      // desligar uma coluna não embaralha a planilha inteira.
      const ordem = catalogo.map((c) => c.chave)
      return [...lista, chave].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
    })
    setPagina(1)
  }

  const limpar = () => {
    setFiltros({ gre: '', inep: '', nome: '', situacao: '', inscricao: '', cursosBase: [], modo: 'algum' })
    setNomeDigitado('')
    setPagina(1)
  }

  const baixar = async () => {
    setBaixando(true)
    try {
      const resposta = await api.get('/painel/base/exportar', {
        params: comoParametros(filtros, colunas || [], cursoId),
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([resposta.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }))
      const link = document.createElement('a')
      link.href = url
      link.download = `base-transforma-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
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
                <div className="absolute right-0 top-full mt-1 z-20 p-2 rounded-xl border shadow-lg w-64 max-h-80 overflow-y-auto"
                  style={{ ...estiloDeCampo, borderColor: 'var(--p-cartaoBorda)' }}>
                  {catalogo.map((c) => (
                    <label key={c.chave}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] hover:opacity-80">
                      <input
                        type="checkbox"
                        checked={(colunas || []).includes(c.chave)}
                        onChange={() => trocarColuna(c.chave)}
                        disabled={c.chave === 'nome'}
                        className="accent-current"
                      />
                      <span style={{ color: 'var(--p-texto)' }}>{c.titulo}</span>
                    </label>
                  ))}
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
              {baixando ? 'Gerando…' : 'Baixar planilha'}
            </button>
          </div>
        }
      >
        Planilha da base
      </TituloDeBloco>

      {/* Um filtro que a tabela obedece sem dizer parece tabela errada. Como
          este veio de outro controle da tela, ele fica escrito aqui. */}
      {cursoId && (
        <p className="text-[12px] mb-3 -mt-1" style={{ color: 'var(--p-texto3)' }}>
          Mostrando apenas quem está inscrito em
          <span style={{ color: 'var(--p-texto2)' }}> {cursoNome || 'no curso selecionado'}</span>.
          Para ver a base inteira, remova o filtro de curso no topo da página.
        </p>
      )}

      {/* Quantos da base nao se inscreveram em curso nenhum, sobre os mesmos
          filtros de regional, escola, nome e situacao. Clicar mostra essas
          pessoas na tabela. */}
      {dados?.resumoInscricao && (() => {
        const r = dados.resumoInscricao
        const pctSem = r.base ? Math.round((r.semInscricao / r.base) * 1000) / 10 : 0
        const caixa = 'flex flex-col rounded-xl px-3.5 py-2.5 border text-left transition-colors'
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div className={caixa} style={{ borderColor: 'var(--p-cartaoBorda)' }}>
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>Profissionais na base</span>
              <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--p-texto)' }}>{r.base.toLocaleString('pt-BR')}</span>
            </div>
            <button type="button" className={caixa} style={{ borderColor: 'var(--p-cartaoBorda)' }}
              onClick={() => { setFiltros((f) => ({ ...f, inscricao: 'inscrito' })); setPagina(1) }}
              title="Mostrar na tabela quem está inscrito">
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{doRecorte ? `Inscritos ${doRecorte}` : 'Inscritos em algum curso'}</span>
              <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--p-texto)' }}>{r.inscritos.toLocaleString('pt-BR')}</span>
            </button>
            <button type="button" className={caixa}
              style={{ borderColor: 'var(--p-r4)', background: filtros.inscricao === 'nao_inscrito' ? 'var(--p-trilho)' : 'transparent' }}
              onClick={() => { setFiltros((f) => ({ ...f, inscricao: 'nao_inscrito' })); setPagina(1) }}
              title="Mostrar na tabela quem não se inscreveu">
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{doRecorte ? `Não inscritos ${doRecorte}` : 'Não se inscreveram em nenhum curso'}</span>
              <span className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--p-r5)' }}>
                {r.semInscricao.toLocaleString('pt-BR')}
                <span className="ml-1.5 text-[13px] font-medium" style={{ color: 'var(--p-texto3)' }}>{pctSem.toLocaleString('pt-BR')}%</span>
              </span>
            </button>
          </div>
        )
      })()}

      {/* ─── Filtros ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        <Campo rotulo="GRE">
          <select
            value={filtros.gre}
            onChange={(e) => { setFiltros((f) => ({ ...f, gre: e.target.value })); setPagina(1) }}
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          >
            <option value="">Todas</option>
            {gresOrdenadas.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Campo>

        <Campo rotulo="INEP">
          <input
            value={filtros.inep}
            onChange={(e) => { setFiltros((f) => ({ ...f, inep: e.target.value.replace(/\D/g, '') })); setPagina(1) }}
            placeholder="código da escola"
            inputMode="numeric"
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          />
        </Campo>

        <Campo rotulo="Nome ou CPF">
          <input
            value={nomeDigitado}
            onChange={(e) => setNomeDigitado(e.target.value)}
            placeholder="a partir de 3 letras"
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          />
        </Campo>

        <Campo rotulo="Situação do cadastro">
          <select
            value={filtros.situacao}
            onChange={(e) => { setFiltros((f) => ({ ...f, situacao: e.target.value })); setPagina(1) }}
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          >
            <option value="">Todas</option>
            {situacoes.map((s) => <option key={s.chave} value={s.chave}>{s.rotulo}</option>)}
          </select>
        </Campo>

        {/* Inscrição é outra pergunta que situação do cadastro: dá para ter
            cadastro confirmado sem estar em curso nenhum, e o contrário
            também. Dois seletores, e não um só com as opções misturadas. */}
        {/* O curso muda a pergunta da inscricao: com ele, "inscrito" e
            "sem inscricao" passam a valer para este curso, e os quadros acima
            tambem. */}
        <Campo rotulo="Cursos">
          <div className="relative" ref={caixaDeCursos}>
            <button
              type="button"
              onClick={() => setAbrirCursos((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] border text-left"
              style={estiloDeCampo}
              title={resumoDosCursos}
            >
              <span className="truncate">{resumoDosCursos}</span>
              <ChevronDown size={14} className="shrink-0" />
            </button>
            {abrirCursos && (
              <div className="absolute left-0 top-full mt-1 z-20 p-2 rounded-xl border shadow-lg w-80 max-h-96 overflow-y-auto"
                style={{ ...estiloDeCampo, borderColor: 'var(--p-cartaoBorda)' }}>
                {/* Com dois ou mais, a pessoa escolhe o que "inscrito" quer dizer. */}
                {qtdCursos > 1 && (
                  <div className="flex gap-1 p-1 mb-2 rounded-lg" style={{ background: 'var(--p-trilho)' }}>
                    {[['algum', 'Em qualquer um'], ['todos', 'Em todos']].map(([chave, rotulo]) => (
                      <button key={chave} type="button"
                        onClick={() => { setFiltros((f) => ({ ...f, modo: chave })); setPagina(1) }}
                        className="flex-1 px-2 py-1 rounded-md text-[12px] font-medium"
                        style={filtros.modo === chave
                          ? { background: 'var(--p-cartao)', color: 'var(--p-texto)' }
                          : { color: 'var(--p-texto3)' }}>
                        {rotulo}
                      </button>
                    ))}
                  </div>
                )}
                {cursosDoFiltro.map((c) => (
                  <label key={c.id} className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] hover:opacity-80">
                    <input type="checkbox" className="mt-0.5 accent-current"
                      checked={filtros.cursosBase.includes(c.id)}
                      onChange={() => alternarCurso(c.id)} />
                    <span className="min-w-0" style={{ color: 'var(--p-texto)' }}>
                      {c.nome}
                      <span style={{ color: 'var(--p-texto3)' }}> · {c.inscritos.toLocaleString('pt-BR')}</span>
                    </span>
                  </label>
                ))}
                {qtdCursos > 0 && (
                  <button type="button"
                    onClick={() => { setFiltros((f) => ({ ...f, cursosBase: [], modo: 'algum' })); setPagina(1) }}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg text-[12px] text-left hover:opacity-80"
                    style={{ color: 'var(--p-r4)' }}>
                    Limpar seleção
                  </button>
                )}
              </div>
            )}
          </div>
        </Campo>

        <Campo rotulo="Inscrição">
          <select
            value={filtros.inscricao}
            onChange={(e) => { setFiltros((f) => ({ ...f, inscricao: e.target.value })); setPagina(1) }}
            className="px-3 py-2 rounded-lg text-[13px] border" style={estiloDeCampo}
          >
            <option value="">Todas</option>
            {inscricoes.map((i) => (
              <option key={i.chave} value={i.chave}>
                {doRecorte ? (i.chave === 'inscrito' ? `Inscrito ${doRecorte}` : `Não inscrito ${doRecorte}`) : i.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {erro && (
        <p className="text-[13px] mb-3" style={{ color: 'var(--p-negativo)' }}>{erro}</p>
      )}

      {/* ─── Tabela ─── */}
      <div className="overflow-x-auto -mx-1">
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
                {visiveis.map((c) => (
                  <td key={c.chave} className="px-2 py-2 align-top max-w-[280px] truncate"
                    style={{ color: 'var(--p-texto)' }} title={linha[c.chave]}>
                    {/* Inscricao em etiqueta: com a base toda na tela, inscritos e
                        nao inscritos no curso se separam pela cor de relance. */}
                    {c.chave === 'inscrito' && /^(Sim|Não)/.test(linha[c.chave] || '') ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-medium"
                        style={linha[c.chave].startsWith('Sim')
                          ? { background: 'rgba(22,163,74,.12)', color: '#15803d' }
                          : { background: 'var(--p-trilho)', color: 'var(--p-texto3)' }}>
                        {linha[c.chave]}
                      </span>
                    ) : (linha[c.chave] || '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {!carregando && !dados?.itens?.length && (
          <p className="text-center py-8 text-[13px]" style={{ color: 'var(--p-texto3)' }}>
            {temFiltro ? 'Nenhum cadastro com esses filtros.' : 'Nenhum cadastro na base.'}
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
          {(dados?.total || 0).toLocaleString('pt-BR')} linhas
          {temFiltro && (
            <button type="button" onClick={limpar}
              className="ml-2 inline-flex items-center gap-1 hover:underline">
              <X size={11} /> limpar filtros
            </button>
          )}
          {/* O total daqui fecha com o cartão "Profissionais na base" do topo --
              é a mesma contagem de cadastros, e foi por isso que a tabela deixou
              de trazer uma linha por vínculo. */}
          <span className="block mt-0.5">
            Uma linha por cadastro; quem tem duas escolas traz as duas na mesma
            linha. O CPF sai completo só no arquivo baixado.
          </span>
        </p>

        {paginas > 1 && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="p-1.5 rounded-lg border disabled:opacity-40" style={estiloDeCampo}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12px] tabular-nums px-1" style={{ color: 'var(--p-texto2)' }}>
              {pagina} de {paginas}
            </span>
            <button type="button" onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
              disabled={pagina >= paginas}
              className="p-1.5 rounded-lg border disabled:opacity-40" style={estiloDeCampo}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </Cartao>
  )
}
