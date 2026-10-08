import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw, Calendar, X, Filter, ChevronDown, Settings } from 'lucide-react'
import api from '../lib/api'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { enviaPlanilhasDoPainel } from '../lib/perfil'
import { variaveisDoTema } from '../components/painel/graficos'
import { BlocoInstitucional } from '../components/painel/blocos'

/**
 * O dashboard institucional.
 *
 * Uma página só, dentro do sistema, com o menu do lado.
 *
 * O bloco operacional -- equipe, produção, frequência -- saiu da tela e do
 * payload a pedido da coordenação, que quis foco no institucional. O componente
 * segue em blocos.jsx e as consultas seguem em painel.repo.js, ambos intactos:
 * trazê-lo de volta é uma linha na lista de consultas da rota e outra aqui.
 *
 * O tema vem do sistema (`useTheme`), não de um controle próprio: o dashboard
 * é uma tela como as outras, e um segundo botão de claro/escuro só para ela
 * seriam duas verdades sobre a mesma preferência.
 */

/**
 * A janela das séries diárias, fixa.
 *
 * Os chips de 7/15/30 dias saíram: só recortavam o gráfico de movimento, e um
 * controle no topo da tela que muda um gráfico no meio dela parece valer para
 * tudo. Trinta dias é a janela que mostra a forma da curva sem virar histórico.
 */
const DIAS = 30

/** As janelas que o gráfico de inscrições por dia oferece. */
const PERIODOS = [['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Tudo']]

/**
 * O que cada painel e, dito na propria tela.
 *
 * O titulo nao pode ser "Dashboard" nos tres: quem chega por um link direto
 * precisa saber em qual dos tres esta. E `secao` desconhecida cai no painel
 * inteiro em vez de dar erro -- endereco digitado torto mostra tudo, que e o
 * comportamento antigo.
 */
const PAINEIS = {
  concluintes: {
    titulo: 'Docentes Concluintes',
    subtitulo: 'Quantos concluiram cada curso, e como isso se distribui pelas regionais.',
  },
  progresso: {
    titulo: 'Consolidado do Curso',
    subtitulo: 'Procura, inscricoes e a avaliacao que os cursistas fizeram de cada curso.',
  },
  sistema: {
    titulo: 'Dados do Sistema',
    subtitulo: 'O que a propria plataforma registra: base, acessos e perfil da rede.',
  },
  tudo: {
    titulo: 'Dashboard',
    subtitulo: 'O retrato do Transforma Educacao PB',
  },
}

/**
 * Um seletor para os dois filtros.
 *
 * `select` nativo, e não a lista de botões usada antes para o período: são
 * dezesseis regionais e dez cursos, e dezesseis botões numa linha viram uma
 * parede. O nativo ainda traz busca por digitação e comportamento de toque
 * correto no celular, de graça.
 */
function Seletor({ rotulo, valor, opcoes, aoTrocar }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{rotulo}</span>
      <select
        value={valor ?? ''}
        onChange={(e) => aoTrocar(e.target.value || null)}
        className="appearance-none pl-3.5 pr-9 py-2 rounded-xl text-[13px] border cursor-pointer focus:outline-none focus:ring-2"
        style={{
          borderColor: 'var(--p-cartaoBorda)',
          background: 'var(--p-cartao)',
          color: valor ? 'var(--p-texto)' : 'var(--p-texto3)',
        }}
      >
        <option value="">{rotulo}</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>{o.rotulo}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 pointer-events-none"
        style={{ color: 'var(--p-texto3)' }} />
    </label>
  )
}

export default function Painel() {
  const { dark } = useTheme()
  const { user } = useAuth()
  const podeEnviarPlanilhas = enviaPlanilhasDoPainel(user)
  // Sem seção no endereço é /painel: abre no primeiro dos três.
  const { secao = 'concluintes' } = useParams()
  const painel = PAINEIS[secao] || PAINEIS.tudo
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [cursoId, setCursoId] = useState(null)
  const [gre, setGre] = useState(null)
  const [componente, setComponente] = useState(null)
  const [janela, setJanela] = useState(String(DIAS))

  /**
   * Os filtros vão para o servidor, não são recorte de tela.
   *
   * As somas por GRE e por curso são consultas de banco -- não dá para
   * derivá-las de uma resposta sem filtro. Como o servidor guarda um minuto de
   * cache por combinação, voltar a um filtro já visto responde na hora.
   */
  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel', {
      params: {
        dias: janela,
        ...(cursoId ? { curso: cursoId } : {}),
        ...(gre ? { gre } : {}),
        ...(componente ? { componente } : {}),
      },
    })
      .then(({ data }) => { setDados(data); setErro(null) })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar o dashboard.'))
      .finally(() => setCarregando(false))
  }, [cursoId, gre, componente, janela])

  useEffect(carregar, [carregar])

  const serie = dados?.institucional.serie || []

  const periodo = useMemo(() => {
    if (!serie.length) return ''
    const f = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
    return `${f(serie[0].dia)} – ${f(serie[serie.length - 1].dia)}`
  }, [serie])

  const cursoAtivo = dados?.institucional.inscricoes.find((c) => c.id === dados.cursoId) || null
  const opcoes = dados?.opcoes || { cursos: [], gres: [] }
  const componentes = dados?.institucional?.resultados?.componentes || []
  const comResultado = useMemo(
    () => new Set(opcoes.cursos.filter((c) => c.temConsolidado || c.temAvaliacao).map((c) => c.id)),
    [opcoes.cursos])

  /**
   * Os cursos que o seletor oferece: os que têm gente dentro.
   *
   * Antes a regra era "publicado OU com planilha importada", e ela errava dos
   * dois lados ao mesmo tempo. Oferecia todo curso no ar mesmo sem uma única
   * inscrição -- e escolher um desses zerava a tela inteira, o que se lê como
   * defeito do painel e não como curso vazio. E escondia os cursos que saíram
   * do ar depois de acontecer, que são justamente os que têm história.
   *
   * O critério agora é movimento: quem tem inscrição, quem tem resultado
   * importado, e o curso que está selecionado neste momento. O último item é
   * o que impede a lista de se fechar sobre si mesma -- com uma GRE também
   * filtrada, um curso sem ninguém naquela regional sumiria do seletor
   * enquanto ainda estivesse aplicado, e não haveria como trocar de escolha.
   */
  const cursosDoSeletor = useMemo(() => {
    const todos = dados?.institucional.inscricoes || []
    return todos.filter((c) => c.inscritos > 0 || comResultado.has(c.id) || c.id === dados?.cursoId)
  }, [dados, comResultado])

  return (
    <div className="space-y-6 animate-fade-in" style={variaveisDoTema(dark)}>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">{painel.titulo}</h1>
          <p className="page-subtitle">
            {painel.subtitulo}
            {dados && ` · atualizado às ${new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>

          {/* O filtro ativo fica escrito, e não só selecionado na caixa: sem
              isso, quem chega na tela já filtrada leria os números como se
              fossem os da rede inteira. */}
          <div className="flex flex-wrap gap-2 mt-2">
            {cursoAtivo && (
              <button
                onClick={() => setCursoId(null)}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                style={{ background: 'var(--p-trilho)', color: 'var(--p-texto)' }}
                title="Remover o filtro"
              >
                <Filter size={13} style={{ color: 'var(--p-roscaA)' }} />
                {cursoAtivo.curso}
                <X size={14} style={{ color: 'var(--p-texto3)' }} />
              </button>
            )}
            {dados?.componente && (
              <button
                onClick={() => setComponente(null)}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                style={{ background: 'var(--p-trilho)', color: 'var(--p-texto)' }}
                title="Remover o filtro"
              >
                <Filter size={13} style={{ color: 'var(--p-roscaC)' }} />
                {dados.componente}
                <X size={14} style={{ color: 'var(--p-texto3)' }} />
              </button>
            )}
            {dados?.gre && (
              <button
                onClick={() => setGre(null)}
                className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-medium transition-colors"
                style={{ background: 'var(--p-trilho)', color: 'var(--p-texto)' }}
                title="Remover o filtro"
              >
                <Filter size={13} style={{ color: 'var(--p-roscaB)' }} />
                {dados.gre}
                <X size={14} style={{ color: 'var(--p-texto3)' }} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Só os cursos com movimento -- ver `cursosDoSeletor`. O ponto
              marca quais já têm planilha de resultado importada, para que
              abrir os cartões de conclusão vazios seja escolha informada e
              não surpresa. */}
          <Seletor
            rotulo="Todos os cursos"
            valor={cursoId}
            aoTrocar={(v) => setCursoId(v ? Number(v) : null)}
            opcoes={cursosDoSeletor.map((c) => ({
              valor: c.id,
              rotulo: comResultado.has(c.id) ? `● ${c.curso}` : c.curso,
            }))}
          />

          {/* A GRE recorta conclusão e base; o componente recorta a avaliação.
              Cada um aparece só no painel onde muda alguma coisa -- um filtro
              que a tela oferece e que nenhum número obedece é pior do que
              filtro nenhum. */}
          {secao !== 'progresso' && (
            <Seletor
              rotulo="Todas as GREs"
              valor={gre}
              aoTrocar={setGre}
              opcoes={opcoes.gres.map((g) => ({
                valor: g.chave,
                rotulo: `${g.chave} · ${g.total.toLocaleString('pt-BR')}`,
              }))}
            />
          )}

          {(secao === 'progresso' || secao === 'tudo') && componentes.length > 0 && (
            <Seletor
              rotulo="Todos os componentes"
              valor={componente}
              aoTrocar={setComponente}
              opcoes={componentes.map((c) => ({
                valor: c.chave,
                rotulo: `${c.chave} · ${c.total.toLocaleString('pt-BR')}`,
              }))}
            />
          )}

          {/* O periodo e a janela do grafico de movimento diario, que so existe
              no painel do sistema. Mostrado em Concluintes, ele parecia a data
              da planilha -- e nao tem relacao com ela. */}
          {periodo && (secao === 'sistema' || secao === 'tudo') && (
            <span className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] border"
              style={{ borderColor: 'var(--p-cartaoBorda)', color: 'var(--p-texto2)' }}>
              <Calendar size={14} /> {periodo}
            </span>
          )}

          {/* O coordenador ve o dashboard mas nao envia planilhas: o backend
              recusaria, entao a engrenagem nem aparece. */}
          {podeEnviarPlanilhas && (<Link
            to="/painel/planilhas"
            title="Planilhas dos painéis"
            aria-label="Planilhas dos painéis"
            className="p-2.5 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--p-cartaoBorda)', color: 'var(--p-texto2)' }}
          >
            <Settings size={15} />
          </Link>)}

          <button
            onClick={carregar}
            title="Atualizar"
            className="p-2.5 rounded-xl border transition-colors"
            style={{ borderColor: 'var(--p-cartaoBorda)', color: 'var(--p-texto2)' }}
          >
            <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {carregando && !dados ? (
        <div className="card text-center py-16 text-sm" style={{ color: 'var(--p-texto3)' }}>
          Montando o dashboard...
        </div>
      ) : erro ? (
        <div className="card text-center py-16">
          <p className="font-semibold" style={{ color: 'var(--p-texto)' }}>{erro}</p>
          <button onClick={carregar} className="text-sm mt-2" style={{ color: 'var(--p-roscaB)' }}>
            Tentar de novo
          </button>
        </div>
      ) : dados ? (
        <BlocoInstitucional
          dados={dados}
          serie={serie}
          dias={dados.dias || DIAS}
          janela={janela}
          janelas={PERIODOS}
          aoTrocarJanela={setJanela}
          cursoAtivo={cursoAtivo}
          greAtiva={dados.gre}
          secao={secao}
          aoFiltrarCurso={(id) => setCursoId((atual) => (atual === id ? null : id))}
        />
      ) : null}
    </div>
  )
}
