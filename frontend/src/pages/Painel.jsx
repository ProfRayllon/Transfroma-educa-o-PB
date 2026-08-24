import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Calendar, X, Filter } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { variaveisDoTema } from '../components/painel/graficos'
import { BlocoInstitucional, BlocoOperacional } from '../components/painel/blocos'

/**
 * O dashboard.
 *
 * Uma página só, dentro do sistema, com o menu do lado. As duas visões que
 * antes eram trilhas separadas -- institucional e operacional -- viraram duas
 * faixas da mesma tela: quem abre isso quer o retrato inteiro de uma vez, e
 * trocar de aba para ver a outra metade escondia justamente a comparação
 * entre elas.
 *
 * O tema vem do sistema (`useTheme`), não de um controle próprio: o dashboard
 * é uma tela como as outras, e um segundo botão de claro/escuro só para ela
 * seriam duas verdades sobre a mesma preferência.
 */

const PAINEIS = [
  { chave: 'institucional', rotulo: 'Institucional' },
  { chave: 'operacional', rotulo: 'Operacional' },
]

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 15, rotulo: '15 dias' },
  { dias: 30, rotulo: '30 dias' },
]

function rotuloDoMes(mes) {
  const [ano, numero] = String(mes).split('-').map(Number)
  const nome = new Date(ano, numero - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

/**
 * O par de grupos de botões do topo.
 *
 * Um componente só para os dois porque são o mesmo controle: escolher UM entre
 * poucos. Dois desenhos parecidos mas não iguais lado a lado é o tipo de
 * detalhe que faz uma tela parecer montada por pessoas diferentes.
 */
function Alternador({ opcoes, valor, aoTrocar }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--p-trilho)' }}>
      {opcoes.map((o) => {
        const ativo = o.valor === valor
        return (
          <button
            key={o.valor}
            onClick={() => aoTrocar(o.valor)}
            className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              background: ativo ? 'var(--p-balao)' : 'transparent',
              color: ativo ? 'var(--p-texto)' : 'var(--p-texto3)',
              boxShadow: ativo ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
            }}
          >
            {o.rotulo}
          </button>
        )
      })}
    </div>
  )
}

export default function Painel() {
  const { dark } = useTheme()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [dias, setDias] = useState(30)
  const [painel, setPainel] = useState('institucional')
  const [cursoId, setCursoId] = useState(null)

  /**
   * Janela e curso vão para o servidor, não são recorte de tela.
   *
   * "Acessaram em N dias" e as somas por GRE do curso são consultas de banco --
   * não dá para derivá-las de uma resposta de 30 dias sem filtro. Como o
   * servidor tem cache de um minuto por combinação, voltar a um filtro já visto
   * responde na hora.
   */
  const carregar = useCallback(() => {
    setCarregando(true)
    api.get('/painel', { params: { dias, ...(cursoId ? { curso: cursoId } : {}) } })
      .then(({ data }) => { setDados(data); setErro(null) })
      .catch((e) => setErro(e?.response?.data?.message || 'Não foi possível carregar o dashboard.'))
      .finally(() => setCarregando(false))
  }, [dias, cursoId])

  useEffect(carregar, [carregar])

  const serie = dados?.institucional.serie || []

  const periodo = useMemo(() => {
    if (!serie.length) return ''
    const f = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
    return `${f(serie[0].dia)} – ${f(serie[serie.length - 1].dia)}`
  }, [serie])

  const institucional = painel === 'institucional'
  const cursoAtivo = dados?.institucional.inscricoes.find((c) => c.id === dados.cursoId) || null

  return (
    <div className="space-y-6 animate-fade-in" style={variaveisDoTema(dark)}>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            O retrato do Transforma Educação PB
            {dados && ` · atualizado às ${new Date(dados.geradoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>

          {/* O filtro ativo fica escrito, e não só destacado na lista: sem isso,
              quem chega na tela já filtrada leria os números como se fossem os
              da rede inteira. */}
          {cursoAtivo && institucional && (
            <button
              onClick={() => setCursoId(null)}
              className="mt-2 inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-medium transition-colors"
              style={{ background: 'var(--p-trilho)', color: 'var(--p-texto)' }}
              title="Remover o filtro"
            >
              <Filter size={13} style={{ color: 'var(--p-roscaA)' }} />
              {cursoAtivo.curso}
              <X size={14} style={{ color: 'var(--p-texto3)' }} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Alternador
            opcoes={PAINEIS.map((p) => ({ valor: p.chave, rotulo: p.rotulo }))}
            valor={painel}
            aoTrocar={setPainel}
          />

          {/* O período só recorta as séries diárias, que são todas do
              institucional -- os totais acumulados não dependem dele e o
              operacional nem tem série. Deixá-lo à vista no operacional seria
              oferecer um controle que não faz nada. */}
          {institucional && (
            <>
              <Alternador
                opcoes={PERIODOS.map((p) => ({ valor: p.dias, rotulo: p.rotulo }))}
                valor={dias}
                aoTrocar={setDias}
              />
              {periodo && (
                <span className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] border"
                  style={{ borderColor: 'var(--p-cartaoBorda)', color: 'var(--p-texto2)' }}>
                  <Calendar size={14} /> {periodo}
                </span>
              )}
            </>
          )}

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
        institucional
          ? (
            <BlocoInstitucional
              dados={dados}
              serie={serie}
              dias={dias}
              cursoAtivo={cursoAtivo}
              aoFiltrarCurso={(id) => setCursoId((atual) => (atual === id ? null : id))}
            />
          )
          : <BlocoOperacional dados={dados} rotuloMes={rotuloDoMes(dados.mes)} />
      ) : null}
    </div>
  )
}
