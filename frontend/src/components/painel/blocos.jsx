import { useMemo, useState } from 'react'
import {
  Users, School, GraduationCap, Eye, AlertTriangle, CheckCircle2,
  FileText, Layers, Star, Info, Target, BookOpen, Compass, PlayCircle,
  Share2, ClipboardCheck, Signpost, Zap, ThumbsUp, MessageSquare,
} from 'lucide-react'
import {
  Cartao, TituloDeBloco, CartaoKpi, BarrasComLinha, BarrasRotuladas,
  Rosca, RoscaRotulada, LegendaDeRosca, ListaRanqueada, CarrosselDeCursos,
  RankingPirulito, ResumoDoRanking, MosaicoDeIndicadores,
} from './graficos'
import ListaDeConcluintes from './listaConcluintes'
import DetalheDaAvaliacao from './detalheAvaliacao'

/**
 * Os blocos do dashboard.
 *
 * Duas faixas na mesma página. "Institucional" é prestação de contas -- alcance,
 * território, jornada, procura. "Operacional" é a régua da casa -- equipe,
 * produção, frequência. Continuam separadas por título porque respondem a
 * perguntas diferentes, mas moram na mesma tela: quem abre o dashboard quer o
 * retrato inteiro, e não metade dele por vez.
 *
 * Nenhum bloco busca dados. A página carrega tudo de uma vez para que os
 * números de blocos diferentes sejam do mesmo instante -- um total no topo que
 * não fecha com a soma das GREs logo abaixo destrói a confiança na tela.
 */

const ROTULOS_PERFIL = {
  administrador: 'Administrador', gerencia: 'Gerência', coordenador: 'Coordenador',
  supervisor: 'Supervisor', professor: 'Professor', tutor: 'Tutor', tecnico: 'Apoio técnico',
  gestao: 'Gestão de Pessoas', revisor: 'Revisor', supervisor_tutoria: 'Sup. de tutoria', ti: 'TI',
}
const ROTULOS_ESTAGIO = {
  producao: 'Em produção', supervisao: 'Com a supervisão',
  coordenacao: 'Com a coordenação', publicado: 'Publicado',
}

const br = (n) => Number(n || 0).toLocaleString('pt-BR')
const pct = (parte, todo) => (todo ? String(Math.round((parte / todo) * 1000) / 10).replace('.', ',') : '0')
const diaCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const virgula = (n) => String(n).replace('.', ',')

/**
 * "1ª GRE" -> "1ª", para caber embaixo da barra.
 *
 * Antes era replace(' GRE', 'ª'), que supunha a GRE gravada sem o ordinal. A
 * base grava "1ª GRE", e o eixo mostrava "1ªª". Aqui o ordinal so e posto se
 * ainda nao estiver la, e o zero a esquerda de "01ª" cai.
 */
const rotuloGre = (gre) => {
  const curto = String(gre || '').replace(/\s*GRE\s*$/i, '').replace(/^0+(?=\d)/, '').trim()
  // Sem numero nenhum ("Sem GRE") o texto volta inteiro: cortar o "GRE" dele
  // deixaria so "Sem" embaixo da barra.
  if (!/\d/.test(curto)) return String(gre || '')
  return /ª$/.test(curto) ? curto : `${curto}ª`
}

/**
 * Percentual com uma casa, sempre.
 *
 * 93 e 95,6 na mesma coluna desalinham a leitura: o olho compara a posicao do
 * digito, e "93%" ao lado de "95,6%" parece de outra grandeza. A casa fixa
 * mantem a coluna reta mesmo quando o valor e redondo.
 */
const pctBr = (n) => Number(n || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
})
const dataCurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—')

/**
 * A pergunta do formulário, reduzida ao assunto dela.
 *
 * "O uso de recursos interativos (quizzes, mapas mentais, infográficos, etc.)
 * facilitou sua aprendizagem?" não cabe num rótulo de gráfico, e cortar no
 * caractere 30 produziria "O uso de recursos interativos (quiz…", que é o começo
 * de todas elas e não distingue nada. Cada entrada aponta a palavra que
 * identifica a pergunta; o texto inteiro fica no title, ao passar o mouse.
 *
 * O que não for reconhecido cai no corte simples -- pergunta nova aparece
 * legível, ainda que sem apelido, em vez de sumir.
 */
/**
 * O que cada escala oferecia, dito em uma linha.
 *
 * O leitor precisa saber que 80,6% de "Sim" e 75,5% de "Muito relevante" não
 * medem a mesma exigência -- sem isso, dois números lado a lado convidam à
 * comparação que o desenho justamente evita.
 */
const NOME_DA_ESCALA = {
  sim3: 'Sim / Parcialmente / Não',
  relevancia4: 'Muito relevante, entre 4 opções',
  clareza4: 'Totalmente, entre 4 opções',
  nota5: 'Nota 5, entre 1 e 5',
}

/* O ícone de cada pergunta. Existe para o mosaico ser varrido pelo desenho
   antes do texto -- onze tijolos iguais obrigam a ler os onze rótulos. */
const ICONES_DA_PERGUNTA = [
  [/relevante para a prática/i, Target],
  [/claros e bem estruturados/i, FileText],
  [/ampliar seus conhecimentos/i, GraduationCap],
  [/desafios reais/i, Compass],
  [/videoaulas/i, PlayCircle],
  [/materiais escritos/i, BookOpen],
  [/recursos interativos/i, Share2],
  [/atividades propostas/i, ClipboardCheck],
  [/orientações para realização/i, Signpost],
  [/aprendizagem ativa/i, Zap],
  [/escala de 1 a 5/i, Star],
]

const iconeDaPergunta = (texto) =>
  (ICONES_DA_PERGUNTA.find(([padrao]) => padrao.test(texto)) || [null, MessageSquare])[1]

const APELIDOS = [
  [/relevante para a prática/i, 'Relevância para a prática'],
  [/claros e bem estruturados/i, 'Clareza dos temas'],
  [/ampliar seus conhecimentos/i, 'Ampliou conhecimento'],
  [/desafios reais/i, 'Alinhado à sala de aula'],
  [/videoaulas/i, 'Videoaulas'],
  [/materiais escritos/i, 'Materiais escritos'],
  [/recursos interativos/i, 'Recursos interativos'],
  [/atividades propostas/i, 'Atividades propostas'],
  [/orientações para realização/i, 'Clareza das orientações'],
  [/aprendizagem ativa/i, 'Aprendizagem ativa'],
  [/escala de 1 a 5/i, 'Nota geral'],
]

function rotuloDaPergunta(texto) {
  const achou = APELIDOS.find(([padrao]) => padrao.test(texto))
  if (achou) return achou[1]
  return texto.length > 30 ? `${texto.slice(0, 29)}…` : texto
}

function TituloDaFaixa({ children, descricao }) {
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2 className="text-[17px] font-bold" style={{ color: 'var(--p-texto)' }}>{children}</h2>
      {descricao && (
        <span className="text-[13px]" style={{ color: 'var(--p-texto3)' }}>{descricao}</span>
      )}
    </div>
  )
}

/**
 * O par de botões que troca a visão de um cartão.
 *
 * Um componente só para os três lugares que fazem isso -- ordem das GREs, a
 * rosca e o perfil da rede. Três desenhos parecidos mas não iguais lado a lado
 * é o que faz uma tela parecer montada por pessoas diferentes.
 */
function TrocaDeVisao({ opcoes, valor, aoTrocar }) {
  return (
    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--p-trilho)' }}>
      {opcoes.map(([chave, rotulo]) => {
        const ativo = chave === valor
        return (
          <button
            key={chave}
            onClick={() => aoTrocar(chave)}
            className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
            style={{
              background: ativo ? 'var(--p-balao)' : 'transparent',
              color: ativo ? 'var(--p-texto)' : 'var(--p-texto3)',
              boxShadow: ativo ? '0 1px 3px rgba(15,23,42,0.10)' : 'none',
            }}
          >
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}

function Legenda({ itens }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-2 text-[12px]"
          style={{ color: 'var(--p-texto2)' }}>
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  )
}

/**
 * Variação percentual entre a primeira e a segunda metade da janela.
 *
 * O sistema não guarda fotografias de meses fechados, então "vs. mês anterior"
 * não existe como dado. Comparar as duas metades do período escolhido é a
 * variação que a base REALMENTE sustenta -- e o rótulo do cartão diz isso, em
 * vez de carimbar uma comparação que não foi feita.
 */
function variacaoDaSerie(serie, chave) {
  if (!serie?.length) return null
  const meio = Math.floor(serie.length / 2)
  const antes = serie.slice(0, meio).reduce((s, p) => s + p[chave], 0)
  const depois = serie.slice(meio).reduce((s, p) => s + p[chave], 0)
  if (!antes) return null
  return ((depois - antes) / antes) * 100
}

/* ══════════════════ Institucional ══════════════════ */

/**
 * Que blocos cada painel mostra.
 *
 * A tela e uma so; o que muda e o recorte. Tres componentes separados
 * duplicariam os mesmos calculos derivados -- e duas copias de uma taxa de
 * conclusao e o comeco de duas taxas de conclusao diferentes.
 *
 * `tudo` mantem a tela inteira funcionando para quem chegar por /painel/tudo ou
 * por um link antigo.
 */
const BLOCOS_POR_SECAO = {
  concluintes: ['kpiConclusao', 'situacao', 'funcao', 'gre', 'escolas', 'lista'],
  progresso: ['kpiAvaliacao', 'evolucao', 'notaRosca', 'positivas', 'indicadores', 'detalhe'],
  sistema: ['kpiBase', 'movimento', 'perfil', 'gre'],
  tudo: [
    'kpiConclusao', 'kpiCurso', 'kpiBase', 'movimento', 'rosca', 'carrossel',
    'gre', 'perfil', 'avaliacao', 'situacao', 'funcao', 'escolas', 'lista',
    'kpiAvaliacao', 'evolucao', 'notaRosca', 'positivas', 'indicadores', 'detalhe',
  ],
}

export function BlocoInstitucional({
  dados, serie, dias, cursoAtivo, greAtiva, aoFiltrarCurso, secao = 'tudo',
}) {
  const mostra = (bloco) => (BLOCOS_POR_SECAO[secao] || BLOCOS_POR_SECAO.tudo).includes(bloco)

  /**
   * A largura das colunas de uma linha, contando só os cartões que sobraram.
   *
   * Sem isso, uma linha declarada com três colunas e exibindo uma deixaria dois
   * terços em branco -- o cartão preso na primeira fatia, o resto vazio.
   *
   * Vai por variável CSS, e não por classe montada em texto: o Tailwind varre o
   * código-fonte à procura das classes que existem, e uma classe formada em
   * tempo de execução nunca chega ao CSS final.
   */
  const grade = (colunas) => {
    const vivas = colunas.filter(([bloco]) => mostra(bloco))
    if (!vivas.length) return null
    return { '--cols': vivas.map(([, largura]) => largura).join(' ') }
  }


  const [ordemGre, setOrdemGre] = useState('cursistas')
  // Duas leituras no mesmo cartao: como as inscricoes se dividem entre os
  // cursos, e quem e a rede que se inscreve. Sao perguntas vizinhas e cada uma
  // pede a tela inteira do cartao -- alternar custa um clique e nao tira nada
  // de nenhuma das duas.
  const [visaoRosca, setVisaoRosca] = useState('cursos')
  const [visaoPerfil, setVisaoPerfil] = useState('componentes')

  const t = dados.institucional.totais
  const funil = dados.institucional.funil
  const perfil = dados.institucional.perfil
  const gres = dados.institucional.porGre
  const cursos = dados.institucional.inscricoes.filter((c) => c.publicado)

  /**
   * O que veio de planilha.
   *
   * Antes da primeira importacao isto chega zerado e vazio -- e a tela precisa
   * dizer que a planilha nao chegou, e nao mostrar 0% como se ninguem tivesse
   * concluido. Sao afirmacoes muito diferentes sobre o mesmo curso.
   */
  const R = dados.institucional.resultados
  const temConclusao = R.conclusao.base > 0
  const temAvaliacao = R.nota.respostas > 0

  /**
   * Concluiu, e nao concluiu. Duas fatias, e nao tres.
   *
   * A planilha distingue apenas esses dois estados. "Em andamento" e "nao
   * iniciou" nao existem nela: quem esta fazendo o curso agora esta dentro de
   * "nao concluiu", indistinguivel de quem nunca abriu. Inventar a terceira
   * fatia seria repartir um numero que ninguem mediu.
   */
  const fatiasSituacao = [
    { rotulo: 'Concluíram', valor: R.conclusao.concluintes, cor: 'var(--p-r5)' },
    {
      rotulo: 'Não concluíram',
      valor: Math.max(0, R.conclusao.base - R.conclusao.concluintes),
      cor: 'var(--p-trilhoForte)',
    },
  ]

  /* A funcao vive no cadastro, e nao na planilha: este bloco so enxerga quem
     teve o CPF encontrado. Sem ninguem encontrado, ele nao aparece -- uma rosca
     vazia com titulo faria parecer que a informacao nao existe, quando o que
     falta e o cruzamento. */
  const cob = R.porFuncao?.cobertura || { concluintes: 0, comCadastro: 0 }
  const temFuncao = (R.porFuncao?.itens?.length || 0) > 0 && cob.comCadastro > 0
  const fatiasFuncao = (R.porFuncao?.itens || []).slice(0, 6).map((f, i) => ({
    rotulo: f.chave,
    valor: f.total,
    cor: `var(--p-r${Math.min(5, i + 1)})`,
  }))

  /**
   * Os três rankings lado a lado: escola, município e componente.
   *
   * Cada um chega por um caminho diferente, e é isso que decide se ele aparece:
   *   - escola     vem da própria planilha, então existe sempre;
   *   - componente vem do cadastro, pelo CPF -- só existe para quem tem par;
   *   - município  vem da escola, pelo INEP -- só existe com o de-para carregado.
   *
   * Nenhum aparece zerado. Um ranking vazio com título faria parecer que
   * ninguém concluiu, quando o que falta é o cruzamento.
   */
  const temEscolas = (R.escolas?.maiores?.length || 0) > 0
  const temMunicipios = (R.porMunicipio?.itens?.length || 0) > 0
  const temComponente = (R.porComponente?.itens?.length || 0) > 0
  const rankings = [temEscolas, temMunicipios, temComponente].filter(Boolean).length
  const cobComp = R.porComponente?.cobertura || { concluintes: 0, comCadastro: 0 }

  const inscricoesNoPeriodo = serie.reduce((s, p) => s + p.inscricao, 0)
  // O funil vem sempre da base inteira, então o primeiro degrau dele é o
  // denominador honesto para "que fatia da rede este curso alcançou".
  const totalDaBase = funil[0].total

  const gresOrdenadas = useMemo(() => [...gres].sort((a, b) =>
    ordemGre === 'cursistas' ? b.cursistas - a.cursistas : b.adesao - a.adesao), [gres, ordemGre])

  /**
   * As barras da GRE nas três visões.
   *
   * Volume e adesão saem do cadastro; conclusão sai da planilha. São tabelas
   * diferentes com contagens diferentes -- por isso a lista é montada aqui, e
   * não no JSX, onde a diferença passaria despercebida.
   */
  /**
   * Trocar de curso pode tirar o chão da visão escolhida.
   *
   * "Conclusão" só aparece quando há planilha. Se ela estiver selecionada e o
   * filtro mudar para um curso sem planilha, o botão some e a visão fica ativa
   * sem existir na lista: o cartão desenharia vazio e não haveria como voltar.
   * Aqui ela cai para Volume, que sempre tem dado.
   */
  const visaoGre = (ordemGre === 'conclusao' && !temConclusao) ? 'cursistas' : ordemGre

  const barrasDaGre = useMemo(() => {
    if (visaoGre === 'conclusao') {
      return [...R.porGre]
        .sort((a, b) => b.taxa - a.taxa)
        .map((g) => ({
          rotulo: rotuloGre(g.gre),
          titulo: g.gre,
          valor: g.taxa,
          nota: `${br(g.concluidos)} de ${br(g.vinculos)}`,
        }))
    }
    return gresOrdenadas.map((g) => ({
      rotulo: rotuloGre(g.gre),
      titulo: g.gre,
      valor: visaoGre === 'cursistas' ? g.cursistas : g.adesao,
      nota: `${g.escolas} escolas`,
    }))
  }, [visaoGre, gresOrdenadas, R.porGre])

  const porTaxa = useMemo(() => [...R.porGre].sort((a, b) => a.taxa - b.taxa), [R.porGre])
  const piorGre = porTaxa[0] || null
  const melhorGre = porTaxa[porTaxa.length - 1] || null

  /**
   * A avaliação, comparável só dentro da mesma escala.
   *
   * O formulário mistura quatro vocabulários, e a proporção de quem escolheu o
   * TOPO não se compara entre eles: quanto mais opções a escala tem, mais
   * difícil é acertar o topo dela. Num mesmo formulário, "Sim" (de três opções)
   * dá 80,6%, "Muito relevante" (de quatro) dá 75,5% e a nota 5 (de cinco) dá
   * 77,3% -- e ler isso como um ranking único apontaria a relevância como o
   * ponto mais fraco do curso quando o número só reflete o tamanho da escala.
   *
   * Então o gráfico usa apenas o maior grupo de perguntas que compartilham uma
   * escala. As outras aparecem à parte, cada uma dizendo qual é a sua -- lado a
   * lado sem régua comum, e não empilhadas numa que não existe.
   */
  const { comparaveis, avulsas, escalaDoGrupo } = useMemo(() => {
    const porEscala = new Map()
    R.avaliacao.forEach((a) => {
      if (!porEscala.has(a.escala)) porEscala.set(a.escala, [])
      porEscala.get(a.escala).push(a)
    })
    let maior = []
    let chave = null
    for (const [k, lista] of porEscala) {
      if (lista.length > maior.length) { maior = lista; chave = k }
    }
    return {
      comparaveis: [...maior].sort((a, b) => b.pctTopo - a.pctTopo),
      avulsas: R.avaliacao.filter((a) => a.escala !== chave),
      escalaDoGrupo: chave,
    }
  }, [R.avaliacao])

  // A última linha do grupo comparável: com tudo entre 91% e 96%, a única que
  // destoa é a informação do gráfico inteiro. Marcada onde está, e não movida
  // para o topo -- inverter a direção só deste ranking faria o leitor comparar
  // posições em duas réguas opostas na mesma tela.
  const maisFraca = comparaveis.length ? comparaveis[comparaveis.length - 1] : null

  /**
   * Os indicadores do consolidado, um por pergunta.
   *
   * A régua é `pctPositivo` -- a fatia POSITIVA sobre quem respondeu, com o
   * neutro fora dos dois lados. Diferente da proporção no topo da escala, ela
   * compara perguntas de escalas diferentes sem penalizar a que tem mais opções:
   * "Relevante" conta como positivo mesmo não sendo o topo, e "Parcialmente" não
   * conta em escala nenhuma.
   *
   * A classificação sai da importação, não daqui: a banda de cada resposta é
   * gravada uma vez, e nenhum gráfico reinventa a sua.
   */
  const indicadoresDaAvaliacao = (R.avaliacao || []).map((a) => ({
    rotulo: rotuloDaPergunta(a.pergunta),
    titulo: `${a.pergunta} — ${pctBr(a.pctPositivo)}% positivas de ${br(a.respostas)} respostas`,
    valor: a.pctPositivo,
    texto: `${pctBr(a.pctPositivo)}%`,
    icone: iconeDaPergunta(a.pergunta),
  }))

  /* A distribuição da nota vai do 5 para o 1: é a ordem em que ela se lê, e a
     rampa acompanha, porque nota é ordinal -- cores sem relação entre si
     esconderiam que 4 fica ao lado de 5 e não ao lado de 1. */
  const fatiasNota = [...(R.nota?.distribuicao || [])].reverse().map((d) => ({
    rotulo: `Nota ${d.nota}`,
    valor: d.total,
    cor: `var(--p-r${Math.max(1, Math.min(5, d.nota))})`,
  }))

  /**
   * Os cartões de indicador deste painel.
   *
   * Cada um pertence a um grupo, e o grupo é que decide em qual painel ele
   * aparece. O mesmo cartão nunca é escrito duas vezes -- dois "Taxa de
   * conclusão" em arquivos diferentes seriam o começo de duas taxas de
   * conclusão diferentes.
   */
  const indicadores = [
    /* Os quatro contam a MESMA planilha, na ordem em que a pergunta se abre:
       quantos são, que fatia terminou, quantos são esses, e quantos faltam.
       Cada linha de apoio descreve o próprio número de cima -- e não o do
       vizinho, que era o erro do painel antigo. */
    mostra('kpiConclusao') && {
      chave: 'totalDocentes',
      icone: Users,
      rotulo: 'Total de docentes',
      /* A base do CONSOLIDADO, e não os 13.445 do cadastro: este painel fala da
         planilha, e misturar os dois universos faria a taxa não fechar com a
         divisão dos dois cartões ao lado. */
      valor: temConclusao ? R.conclusao.base : 0,
      gradiente: 'azul',
      comparativo: temConclusao
        ? `${br(R.conclusao.vinculos)} vínculos com escola · planilha de ${dataCurta(R.conclusao.referencia)}`
        : 'aguardando a planilha de consolidado',
    },
    mostra('kpiConclusao') && {
      chave: 'taxa',
      icone: CheckCircle2,
      rotulo: 'Taxa de conclusão',
      // Por PESSOA, e não pela linha da planilha: ela traz um vínculo por
      // escola, e quem leciona em duas apareceria duas vezes.
      valor: temConclusao ? R.conclusao.taxa : 0,
      sufixo: '%',
      decimais: 1,
      gradiente: 'ciano',
      comparativo: temConclusao
        ? `${br(R.conclusao.concluintes)} de ${br(R.conclusao.base)} docentes`
        : 'aguardando a planilha de consolidado',
    },
    mostra('kpiConclusao') && {
      chave: 'concluintes',
      icone: GraduationCap,
      rotulo: 'Concluíram',
      valor: temConclusao ? R.conclusao.concluintes : 0,
      gradiente: 'roxo',
      comparativo: temConclusao && R.escolas?.total
        ? `em ${br(R.escolas.total)} escolas de ${R.escolas.gres} GREs`
        : 'aguardando a planilha de consolidado',
    },
    mostra('kpiConclusao') && {
      chave: 'naoConcluintes',
      icone: AlertTriangle,
      rotulo: 'Não concluíram',
      valor: temConclusao ? R.conclusao.base - R.conclusao.concluintes : 0,
      gradiente: 'rosa',
      /* Não é o complemento da taxa por acaso: é a mesma conta vista do outro
         lado, e dizer isso evita que alguém procure o número em outra fonte. */
      comparativo: temConclusao
        ? `${pct(R.conclusao.base - R.conclusao.concluintes, R.conclusao.base)}% do total de docentes`
        : 'aguardando a planilha de consolidado',
    },
    mostra('kpiCurso') && {
      chave: 'inscricoes',
      icone: GraduationCap,
      rotulo: cursoAtivo ? 'Inscrições no curso' : 'Inscrições em cursos',
      valor: t.inscricoes,
      gradiente: 'roxo',
      serie: serie.map((x) => x.inscricao),
      variacao: variacaoDaSerie(serie, 'inscricao'),
      comparativo: `${br(inscricoesNoPeriodo)} nos últimos ${dias} dias`,
    },
    mostra('kpiCurso') && {
      chave: 'nota',
      icone: Star,
      rotulo: 'Avaliação do curso',
      // A nota vem com a proporção de 4 e 5 embaixo porque média esconde a
      // forma: 4,7 pode ser todo mundo dando 5 menos um punhado dando 1, e a
      // decisão de quem lê muda conforme o caso.
      valor: temAvaliacao ? R.nota.media : 0,
      sufixo: ' / 5',
      decimais: 2,
      gradiente: 'rosa',
      comparativo: temAvaliacao
        ? `${pct(R.nota.satisfeitos, R.nota.respostas)}% deram 4 ou 5 · ${br(R.nota.respostas)} respostas`
        : 'aguardando a planilha de avaliação',
    },
    mostra('kpiAvaliacao') && {
      chave: 'respostas',
      icone: Users,
      rotulo: 'Total de respostas',
      valor: temAvaliacao ? R.nota.respostas : 0,
      gradiente: 'azul',
      comparativo: temAvaliacao && R.evolucaoRespostas?.de
        ? `de ${dataCurta(R.evolucaoRespostas.de)} a ${dataCurta(R.evolucaoRespostas.ate)}`
        : 'aguardando a planilha de avaliação',
    },
    mostra('kpiAvaliacao') && {
      chave: 'notaMedia',
      icone: Star,
      rotulo: 'Nota geral média',
      valor: temAvaliacao ? R.nota.media : 0,
      sufixo: ' / 5',
      decimais: 2,
      gradiente: 'ciano',
      comparativo: temAvaliacao
        ? `${br(R.nota.respostas)} pessoas responderam esta pergunta`
        : 'aguardando a planilha de avaliação',
    },
    mostra('kpiAvaliacao') && {
      chave: 'positivas',
      icone: ThumbsUp,
      rotulo: 'Avaliações positivas',
      /* Nota 4 ou 5. O 3 fica de fora dos dois lados -- e a resposta de quem
         nao endossa nem recusa, e conta-lo como positivo inflaria o indicador
         com quem ficou em cima do muro. */
      valor: temAvaliacao && R.nota.respostas
        ? Math.round((R.nota.satisfeitos / R.nota.respostas) * 1000) / 10
        : 0,
      sufixo: '%',
      decimais: 1,
      gradiente: 'roxo',
      comparativo: temAvaliacao
        ? `${br(R.nota.satisfeitos)} deram nota 4 ou 5`
        : 'aguardando a planilha de avaliação',
    },
    mostra('kpiAvaliacao') && {
      chave: 'componentes',
      icone: BookOpen,
      rotulo: 'Componentes curriculares',
      valor: R.componentes?.length || 0,
      gradiente: 'rosa',
      comparativo: R.componentes?.length
        ? `${R.componentes[0].chave} lidera com ${br(R.componentes[0].total)}`
        : 'aguardando a planilha de avaliação',
    },
    mostra('kpiBase') && {
      chave: 'base',
      icone: Users,
      rotulo: cursoAtivo ? 'Inscritos neste curso' : 'Profissionais na base',
      valor: t.cursistas,
      gradiente: 'azul',
      comparativo: cursoAtivo
        ? `${pct(t.cursistas, totalDaBase)}% da base oficial`
        : `${br(t.confirmados)} confirmaram o cadastro · ${pct(t.confirmados, t.cursistas)}%`,
    },
    mostra('kpiBase') && {
      chave: 'acessos',
      icone: Eye,
      rotulo: `Acessaram em ${dias} dias`,
      valor: t.acessaramNaJanela,
      gradiente: 'ciano',
      serie: serie.map((x) => x.login + x.primeiroAcesso),
      /* O denominador é sempre o MESMO conjunto que o numerador. Já foi "quem
         tem senha", e o percentual passava de 100%: quem entra com o CPF no
         primeiro acesso e nunca define senha conta no acesso e não contava no
         denominador. */
      comparativo: `${pct(t.acessaramNaJanela, t.cursistas)}% ${cursoAtivo ? 'dos inscritos' : 'da base oficial'}`,
    },
  ].filter(Boolean)

  /**
   * Como as inscrições se dividem entre os cursos.
   *
   * Só os cinco maiores viram fatia; o resto soma em "Outros cursos". Uma rosca
   * com dez fatias finas não se lê -- os rótulos se atropelam e as fatias menores
   * viram riscos. O ranking completo, com nome inteiro, está no carrossel ao
   * lado, que é onde a pergunta "qual curso" se responde.
   *
   * A rampa segue a ordem de tamanho: aqui ela não inventa categoria nenhuma,
   * só reforça a mesma leitura que o ângulo da fatia já dá.
   */
  const fatiasCursos = useMemo(() => {
    const ordenados = [...cursos].sort((a, b) => b.inscritos - a.inscritos)
    const principais = ordenados.slice(0, 5)
    const resto = ordenados.slice(5).reduce((s, c) => s + c.inscritos, 0)

    const fatias = principais.map((c, i) => ({
      rotulo: c.curso.length > 21 ? `${c.curso.slice(0, 20)}…` : c.curso,
      titulo: c.curso,
      valor: c.inscritos,
      cor: `var(--p-r${5 - i})`,
    }))
    if (resto > 0) {
      fatias.push({
        rotulo: 'Outros cursos',
        titulo: `${ordenados.length - 5} cursos com menos inscrições`,
        valor: resto,
        cor: 'var(--p-trilhoForte)',
      })
    }
    return fatias
  }, [cursos])

  const totalInscricoes = fatiasCursos.reduce((s, f) => s + f.valor, 0)

  const totalGenero = perfil.genero.reduce((s, g) => s + g.total, 0)
  const feminino = perfil.genero.find((g) => /^f/i.test(g.chave))
  const coresGenero = ['var(--p-r4)', 'var(--p-r2)', 'var(--p-r5)']

  // O simbolo sai do proprio valor da coluna, e nao da posicao na lista: se um
  // dia a base tiver mais pessoas do sexo masculino, a ordem inverte e um
  // simbolo fixo por indice passaria a mentir.
  const simboloDe = (chave) => (/^f/i.test(chave) ? 'feminino'
    : /^m/i.test(chave) ? 'masculino' : null)

  const fatiasGenero = perfil.genero.map((g, i) => ({
    rotulo: g.chave,
    valor: g.total,
    cor: coresGenero[i % coresGenero.length],
    simbolo: simboloDe(g.chave),
  }))

  /**
   * Idade é ordinal: a rampa acompanha a ordem das faixas, do mais novo ao mais
   * velho. Cores sem relação entre si esconderiam que "30 a 39" fica ao lado de
   * "40 a 49" e não ao lado de "60 ou mais".
   *
   * A ordem vem do servidor (FIELD na consulta) e não é reordenada aqui -- num
   * gráfico de faixa etária, ordenar por tamanho destruiria a leitura.
   */
  const fatiasIdade = perfil.faixaEtaria.map((f, i) => ({
    rotulo: f.chave,
    valor: f.total,
    cor: `var(--p-r${Math.min(5, i + 1)})`,
  }))
  const totalIdade = fatiasIdade.reduce((s, f) => s + f.valor, 0)

  const listaPerfil = visaoPerfil === 'componentes' ? perfil.componentes : perfil.eixos
  const totalPerfil = listaPerfil.reduce((s, x) => s + x.total, 0)
  const lider = listaPerfil[0] || null
  const participacaoDoLider = lider && totalPerfil
    ? String(Math.round((lider.total / totalPerfil) * 1000) / 10).replace('.', ',')
    : '0'


  /* As grades ficam DEPOIS dos derivados de propósito: elas consultam
     `temFuncao`, e uma const usada antes da própria declaração não é erro
     de compilação -- é erro em tempo de execução, que só aparece quando
     alguém abre a tela. */
  const gradeMovimento = grade([['movimento', '1.45fr'], ['rosca', '1.2fr'], ['carrossel', '1fr']])

  /**
   * Em Concluintes a GRE sobe para a linha da situação.
   *
   * As duas respondem a mesma pergunta -- quantos concluíram, e onde --, e ler
   * uma logo abaixo da outra obrigava a rolar entre elas. Nos outros painéis a
   * GRE é um recorte da base, não da conclusão, e continua ao lado do
   * componente curricular.
   */
  const greComSituacao = secao === 'concluintes' && mostra('gre')

  /* `temFuncao` entra na conta da grade, e nao so no JSX: o cartao da funcao
     some quando ninguem cruzou com o cadastro, e uma coluna reservada para um
     cartao que nao aparece deixa um vao ao lado dos outros dois. */
  const gradeSituacao = grade([
    ['situacao', '1fr'],
    ...(greComSituacao ? [['gre', '1.35fr']] : []),
    ...(temFuncao ? [['funcao', '1fr']] : []),
  ])
  const gradeRegional = grade([
    ...(greComSituacao ? [] : [['gre', '1.3fr']]),
    ['perfil', '1fr'],
  ])

  /**
   * O cartão da GRE, montado fora do JSX das linhas.
   *
   * Ele aparece em dois lugares conforme o painel: em Concluintes divide a
   * linha com a rosca de situação, porque as duas respondem a mesma pergunta
   * -- quantos concluíram --; nos demais fica ao lado do componente
   * curricular. Escrito uma vez só: duas cópias do mesmo cartão seriam duas
   * versões dele no primeiro ajuste.
   */
  const cartaoGre = mostra('gre') ? (
      <Cartao className="flex flex-col">
        <TituloDeBloco
          acao={
            /* Reordenar responde a pergunta que sempre aparece: "a maior
               regional é também a que mais aderiu?" */
            <TrocaDeVisao
              opcoes={temConclusao
                ? [['cursistas', 'Volume'], ['adesao', 'Adesão'], ['conclusao', 'Conclusão']]
                : [['cursistas', 'Volume'], ['adesao', 'Adesão']]}
              valor={visaoGre}
              aoTrocar={setOrdemGre}
            />
          }
        >
          {visaoGre === 'conclusao' ? 'Conclusão por GRE' : 'Distribuição por GRE'}
        </TituloDeBloco>

        {/* A conclusão por GRE conta VÍNCULO, e não pessoa: a pergunta aqui é
            "como está a regional", e quem leciona em duas responde às duas.
            Somar as barras, por isso, não devolve o total do curso -- esse
            está no cartão de cima. */}
        <div style={{ height: 236 }}>
          <BarrasRotuladas
            dados={barrasDaGre.map((g) => ({
              rotulo: g.rotulo,
              titulo: g.titulo,
              valor: g.valor,
              nota: g.nota,
            }))}
            formatarValor={(v) => (visaoGre === 'cursistas' ? br(v) : `${pctBr(v)}%`)}
          />
        </div>

        {visaoGre === 'conclusao' && piorGre && melhorGre && (
          <p className="text-[12px] mt-3 leading-relaxed" style={{ color: 'var(--p-texto3)' }}>
            <b style={{ color: 'var(--p-r5)' }}>{piorGre.gre}</b> conclui{' '}
            <b style={{ color: 'var(--p-r5)' }}>{pctBr(piorGre.taxa)}%</b> e{' '}
            <b style={{ color: 'var(--p-r4)' }}>{melhorGre.gre}</b>,{' '}
            <b style={{ color: 'var(--p-r4)' }}>{pctBr(melhorGre.taxa)}%</b>
            {/* A razão entre as pontas só é dita quando existe: com a pior em
                zero a divisão daria infinito, e "Infinity× de diferença" é o
                tipo de coisa que vai para uma apresentação. */}
            {piorGre.taxa > 0 && (
              <> — {virgula(Math.round((melhorGre.taxa / piorGre.taxa) * 10) / 10)}× de diferença entre as pontas</>
            )}.
          </p>
        )}
      </Cartao>
  ) : null

  return (
    <section className="space-y-4">
      {/* Sem título de faixa: ele nomeava uma das duas faixas quando havia duas.
          Com o operacional fora da tela, "Institucional" ficou anunciando a
          única coisa que existe -- e repetindo o "Dashboard" logo acima. */}

      {/* ─── Indicadores ─── */}
      {/* Cada cartão descreve, na linha de baixo, o PRÓPRIO número de cima.
          Antes o primeiro mostrava a base cadastrada e embaixo a variação dos
          acessos -- duas grandezas diferentes no mesmo cartão, e a leitura
          natural era tomar a variação como sendo da base.

          A lista é montada antes de desenhar para a grade acompanhar quantos
          cartões o painel realmente tem: quatro colunas fixas com dois cartões
          dentro deixariam metade da linha vazia. */}
      {indicadores.length > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${
          indicadores.length >= 4 ? 'xl:grid-cols-4'
            : indicadores.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
          {indicadores.map((k) => <CartaoKpi key={k.chave} {...k} />)}
        </div>
      )}

      {/* ─── Situação e quem concluiu ─── */}
      {gradeSituacao && temConclusao && (
        <div className="grid grid-cols-1 gap-4 items-stretch xl:[grid-template-columns:var(--cols)]"
          style={gradeSituacao}>
          {mostra('situacao') && (
            <Cartao className="flex flex-col">
              <TituloDeBloco
                acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  planilha de {dataCurta(R.conclusao.referencia)}
                </span>}
              >
                Situação no curso
              </TituloDeBloco>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <RoscaRotulada
                  total={R.conclusao.base}
                  altura={310}
                  centroValor={br(R.conclusao.base)}
                  centroRotulo="docentes"
                  fatias={fatiasSituacao}
                />
              </div>
            </Cartao>
          )}

          {greComSituacao && cartaoGre}

          {mostra('funcao') && temFuncao && (
            <Cartao className="flex flex-col">
              <TituloDeBloco
                acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  {pct(cob.comCadastro, cob.concluintes)}% dos concluintes
                </span>}
              >
                Concluintes por função
              </TituloDeBloco>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <RoscaRotulada
                  total={fatiasFuncao.reduce((s, f) => s + f.valor, 0)}
                  altura={310}
                  centroValor={br(cob.comCadastro)}
                  centroRotulo="com cadastro"
                  fatias={fatiasFuncao}
                />
              </div>
              {/* O grafico descreve so quem foi encontrado no cadastro. Dizer o
                  tamanho desse recorte evita que ele seja lido como o retrato
                  dos oito mil. */}
              <p className="text-[12px] mt-1" style={{ color: 'var(--p-texto3)' }}>
                A função vem do cadastro dos cursistas.{' '}
                <b style={{ color: 'var(--p-texto2)' }}>{br(cob.concluintes - cob.comCadastro)}</b>{' '}
                concluintes da planilha ainda não têm par na base e ficam fora deste recorte.
              </p>
            </Cartao>
          )}
        </div>
      )}

      {/* ─── Movimento, jornada e procura ─── */}
      {/* A Jornada recebe mais largura que os vizinhos: os rótulos dos arcos
          ocupam as laterais, e num cartão estreito eles espremeriam o desenho
          justamente onde ele deveria crescer. */}
      {gradeMovimento && (
      <div className="grid grid-cols-1 gap-4 items-stretch xl:[grid-template-columns:var(--cols)]"
        style={gradeMovimento}>
        {mostra('movimento') && (
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>últimos {dias} dias</span>}
          >
            {cursoAtivo ? 'Inscrições por dia' : 'Movimento diário'}
          </TituloDeBloco>

          {/* Com curso filtrado a linha de acessos desaparece: um login não
              pertence a curso nenhum, e mantê-la aqui sugeriria que aqueles
              acessos são daquele curso. Sobram as inscrições, que a tabela de
              inscrições sabe recortar por curso. */}
          <BarrasComLinha
            dados={serie}
            chaveX="dia"
            formatarX={diaCurto}
            barra={cursoAtivo
              ? { chave: 'inscricao', rotulo: 'Inscrições no curso' }
              : { chave: 'login', rotulo: 'Acessos' }}
            linha={cursoAtivo ? null : { chave: 'inscricao', rotulo: 'Inscrições' }}
            altura={268}
          />

          {/* A legenda diz de qual lado cada série lê a escala: são dois eixos,
              e sem isso o cruzamento das duas viraria uma conclusão inventada
              pelo desenho, e não pelo dado. */}
          <div className="mt-3">
            <Legenda itens={cursoAtivo
              ? [{ rotulo: `Inscrições em ${cursoAtivo.curso}`, cor: 'var(--p-barra)' }]
              : [
                { rotulo: 'Acessos (escala à esquerda)', cor: 'var(--p-barra)' },
                { rotulo: 'Inscrições (escala à direita)', cor: 'var(--p-linha)' },
              ]} />
          </div>
        </Cartao>
        )}

        {mostra('rosca') && (
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              <TrocaDeVisao
                opcoes={[['cursos', 'Cursos'], ['composicao', 'Composição'], ['idade', 'Faixa etária']]}
                valor={visaoRosca}
                aoTrocar={setVisaoRosca}
              />
            }
          >
            {visaoRosca === 'cursos' ? 'Inscrições por curso'
              : visaoRosca === 'composicao' ? 'Composição'
                : 'Faixa etária'}
          </TituloDeBloco>

          <div className="flex-1 flex items-center justify-center min-h-0">
            {visaoRosca === 'cursos' && (
              <RoscaRotulada
                key="cursos"
                total={totalInscricoes}
                altura={330}
                centroValor={br(totalInscricoes)}
                centroRotulo="inscrições"
                fatias={fatiasCursos}
              />
            )}
            {visaoRosca === 'composicao' && (
              <RoscaRotulada
                key="composicao"
                total={totalGenero}
                altura={330}
                centroValor={feminino ? `${Math.round((feminino.total / totalGenero) * 100)}%` : '—'}
                centroRotulo="são mulheres"
                fatias={fatiasGenero}
              />
            )}
            {visaoRosca === 'idade' && (
              <RoscaRotulada
                key="idade"
                total={totalIdade}
                altura={330}
                centroValor={br(totalIdade)}
                centroRotulo="com idade informada"
                fatias={fatiasIdade}
              />
            )}
          </div>
        </Cartao>
        )}

        {mostra('carrossel') && (
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                {cursoAtivo ? 'clique para limpar' : 'clique para filtrar'}
              </span>
            }
          >
            Cursos mais procurados
          </TituloDeBloco>
          {/* A capa entra por URL, não embutida na resposta: são data URIs de
              alguns MB por curso, e o dashboard levaria os 9 KB para dezenas de
              megabytes. A rota /api/publico/cursos/:id/imagem serve a mesma
              imagem com cache de 24h -- é a que o site público já usa. */}
          <CarrosselDeCursos
            selecionado={cursoAtivo?.id}
            aoClicar={(item) => aoFiltrarCurso(item.id)}
            itens={cursos.slice(0, 6).map((c) => ({
              id: c.id,
              rotulo: c.curso,
              valor: c.inscritos,
              aberto: c.aberto,
              imagem: c.temImagem
                ? `/api/publico/cursos/${c.id}/imagem?v=${c.versaoImagem}`
                : null,
            }))}
          />
        </Cartao>
        )}
      </div>
      )}

      {/* ─── Território ─── */}
      {/* O pirulito precisa de largura: rótulo, haste e valor dividem a linha,
          e num cartão estreito a haste some entre os dois textos. A GRE cede
          espaço porque as barras dela encolhem sem perder a leitura. */}
      {gradeRegional && (
      <div className="grid grid-cols-1 gap-4 items-stretch xl:[grid-template-columns:var(--cols)]"
        style={gradeRegional}>
        {!greComSituacao && cartaoGre}

        {mostra('perfil') && (
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={
              <TrocaDeVisao
                opcoes={[['componentes', 'Componentes'], ['eixos', 'Eixos']]}
                valor={visaoPerfil}
                aoTrocar={setVisaoPerfil}
              />
            }
          >
            {visaoPerfil === 'componentes' ? 'Componente curricular' : 'Eixos tecnológicos'}
          </TituloDeBloco>

          {/* Os dois são a mesma pergunta em dois recortes -- o que a pessoa
              ensina e em que eixo o curso técnico dela entra --, então dividem
              o cartão em vez de ocupar dois.
              O total e a participação saem da lista COMPLETA, não das sete
              linhas desenhadas: dizer "28,9% do total" sobre um total que
              esconde metade dos itens seria um percentual falso. */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
              style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}
            >
              <Star size={13} style={{ color: 'var(--p-r3)' }} />
              Destaque: <b style={{ color: 'var(--p-r4)' }}>{lider?.chave}</b>
            </span>
            <ResumoDoRanking
              total={totalPerfil}
              maior={lider?.total || 0}
              participacao={participacaoDoLider}
            />
          </div>

          <RankingPirulito
            itens={listaPerfil.slice(0, 7).map((x) => ({ rotulo: x.chave, valor: x.total }))}
            rodape={lider && (
              <span>
                <b style={{ color: 'var(--p-texto)' }}>{lider.chave}</b> lidera com{' '}
                <b style={{ color: 'var(--p-r4)' }}>{br(lider.total)} ({participacaoDoLider}%)</b>{' '}
                do total de <b style={{ color: 'var(--p-r4)' }}>{br(totalPerfil)}</b>.
              </span>
            )}
          />
        </Cartao>
        )}
      </div>
      )}

      {/* ─── Como o curso foi avaliado ─── */}
      {temAvaliacao && mostra('avaliacao') && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4 items-stretch">
          <Cartao className="flex flex-col">
            <TituloDeBloco
              acao={
                <span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  {br(R.nota.respostas)} respostas
                </span>
              }
            >
              Como o curso foi avaliado
            </TituloDeBloco>

            {/* A régua é a proporção de quem escolheu o TOPO da escala. Ela só
                vale entre perguntas que compartilham a MESMA escala -- por isso
                aqui entra um grupo só, e as demais ficam embaixo, separadas. */}
            <p className="text-[12px] mb-3" style={{ color: 'var(--p-texto3)' }}>
              {comparaveis.length} perguntas de{' '}
              <b style={{ color: 'var(--p-texto2)' }}>{NOME_DA_ESCALA[escalaDoGrupo] || 'mesma escala'}</b>,
              pela proporção que respondeu no topo.
            </p>

            <RankingPirulito
              itens={comparaveis.map((a) => ({
                rotulo: rotuloDaPergunta(a.pergunta),
                titulo: a.pergunta,
                valor: a.pctTopo,
              }))}
              teto={100}
              destaque={maisFraca ? rotuloDaPergunta(maisFraca.pergunta) : null}
              formatarValor={(v) => `${pctBr(v)}%`}
              formatarEixo={(v) => `${v}%`}
              rodape={maisFraca && (
                <span>
                  <b style={{ color: 'var(--p-texto)' }}>{rotuloDaPergunta(maisFraca.pergunta)}</b> é
                  o único ponto abaixo dos demais:{' '}
                  <b style={{ color: 'var(--p-r5)' }}>{pctBr(maisFraca.pctTopo)}%</b> —{' '}
                  {br(maisFraca.respostas - maisFraca.topo)} pessoas responderam com ressalva.
                </span>
              )}
            />

            {/* Fora da régua acima porque têm outra escala. Cada uma diz a sua,
                e elas não são comparadas nem entre si: são duas leituras
                soltas, e apresentá-las como ranking seria inventar uma ordem. */}
            {avulsas.length > 0 && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                <p className="text-[12px] mb-3" style={{ color: 'var(--p-texto3)' }}>
                  Outras escalas — não comparáveis com o gráfico acima
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {avulsas.map((a) => (
                    <div key={a.pergunta} className="px-3.5 py-3 rounded-xl"
                      style={{ background: 'var(--p-trilho)' }}>
                      <p className="text-[12.5px] truncate" style={{ color: 'var(--p-texto)' }}
                        title={a.pergunta}>
                        {rotuloDaPergunta(a.pergunta)}
                      </p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-[19px] font-bold tabular-nums" style={{ color: 'var(--p-r4)' }}>
                          {pctBr(a.pctTopo)}%
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--p-texto3)' }}>
                          {NOME_DA_ESCALA[a.escala] || a.escala}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Cartao>

          <Cartao className="flex flex-col">
            <TituloDeBloco>Nota geral</TituloDeBloco>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[42px] font-bold leading-none tabular-nums"
                style={{ color: 'var(--p-texto)' }}>
                {R.nota.media.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[15px]" style={{ color: 'var(--p-texto3)' }}>de 5</span>
            </div>
            <p className="text-[12px] mb-5" style={{ color: 'var(--p-texto3)' }}>
              {pct(R.nota.satisfeitos, R.nota.respostas)}% deram 4 ou 5
            </p>

            {/* A distribuição vem junto da média porque média esconde a forma:
                4,73 pode ser quase todo mundo dando 5, ou uma maioria em 4 com
                uma ponta em 1. São dois cursos diferentes com o mesmo número. */}
            <div className="flex flex-col gap-2">
              {[...R.nota.distribuicao].reverse().map((d) => {
                const p = R.nota.respostas ? (d.total / R.nota.respostas) * 100 : 0
                return (
                  <div key={d.nota} className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1 w-7 shrink-0 text-[12px] tabular-nums"
                      style={{ color: 'var(--p-texto2)' }}>
                      {d.nota}
                      <Star size={10} style={{ color: 'var(--p-r3)' }} />
                    </span>
                    <span className="flex-1 h-2.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--p-trilho)' }}>
                      <span className="block h-full rounded-full origin-left animate-barra"
                        style={{ width: `${p}%`, background: `var(--p-r${Math.max(1, d.nota - 1)})` }} />
                    </span>
                    <span className="w-16 text-right text-[12px] tabular-nums shrink-0"
                      style={{ color: 'var(--p-texto3)' }}>
                      {br(d.total)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Um filtro que a tela parece aplicar mas que estes números ignoram
                seria pior do que filtro nenhum -- então ele é dito, e não
                escondido. */}
            {greAtiva && (
              <p className="flex items-start gap-2 text-[12px] mt-5 px-3 py-2.5 rounded-xl leading-relaxed"
                style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}>
                <Info size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--p-r3)' }} />
                <span>
                  A avaliação é <b>anônima</b> e não registra regional. Este bloco continua
                  sendo da rede inteira, mesmo com <b>{greAtiva}</b> selecionada.
                </span>
              </p>
            )}
          </Cartao>
        </div>
      )}

      {/* ─── Evolução, nota e itens mais positivos ─── */}
      {mostra('evolucao') && temAvaliacao && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr_1fr] gap-4 items-stretch">
          <Cartao className="flex flex-col">
            <TituloDeBloco
              acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                {br(R.evolucaoRespostas.total)} respostas
              </span>}
            >
              Evolução das respostas
            </TituloDeBloco>
            {/* Os dias sem resposta vêm preenchidos com zero, do servidor. Um
                gráfico que pula o dia vazio encurta o eixo e faz o período
                parecer mais intenso do que foi. */}
            <div style={{ height: 260 }}>
              <BarrasComLinha
                dados={R.evolucaoRespostas.pontos}
                chaveX="dia"
                barra={{ chave: 'total', rotulo: 'Respostas', cor: 'var(--p-r3)' }}
                altura={260}
                formatarX={(d) => diaCurto(d)}
              />
            </div>
          </Cartao>

          {mostra('notaRosca') && (
            <Cartao className="flex flex-col">
              <TituloDeBloco>Distribuição da nota geral</TituloDeBloco>
              <div className="flex-1 flex flex-col items-center justify-center gap-4 min-h-0">
                <Rosca
                  fatias={fatiasNota}
                  total={R.nota.respostas}
                  centroValor={br(R.nota.respostas)}
                  centroRotulo="respostas"
                  tamanho={168}
                />
                <div className="w-full">
                  <LegendaDeRosca fatias={fatiasNota} total={R.nota.respostas} />
                </div>
              </div>
            </Cartao>
          )}

          {mostra('positivas') && (
            <Cartao className="flex flex-col">
              <TituloDeBloco>Itens mais bem avaliados</TituloDeBloco>
              <p className="text-[12px] -mt-2 mb-4" style={{ color: 'var(--p-texto3)' }}>
                % de respostas positivas em cada item
              </p>
              <ListaRanqueada
                mostrarPosicao={false}
                sufixo="%"
                itens={[...indicadoresDaAvaliacao]
                  .sort((a, b) => b.valor - a.valor)
                  .slice(0, 6)
                  .map((i) => ({ rotulo: i.rotulo, valor: i.valor }))}
              />
            </Cartao>
          )}
        </div>
      )}

      {/* ─── Todos os indicadores ─── */}
      {mostra('indicadores') && temAvaliacao && (
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={maisFraca && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]"
                style={{ background: 'var(--p-trilho)', color: 'var(--p-texto2)' }}>
                <Info size={13} style={{ color: 'var(--p-r4)' }} />
                Menor: <b style={{ color: 'var(--p-r5)' }}>{rotuloDaPergunta(maisFraca.pergunta)}</b>
              </span>
            )}
          >
            Indicadores da avaliação do curso
          </TituloDeBloco>
          <p className="text-[12.5px] -mt-2 mb-4" style={{ color: 'var(--p-texto3)' }}>
            Percentual de respostas positivas em cada item, sobre quem respondeu aquela
            pergunta. O “Parcialmente” fica de fora dos dois lados.
          </p>
          <MosaicoDeIndicadores itens={indicadoresDaAvaliacao} colunas={6} />
        </Cartao>
      )}

      {/* ─── Detalhamento ─── */}
      {mostra('detalhe') && temAvaliacao && (
        <DetalheDaAvaliacao
          cursoId={dados.cursoId}
          componente={dados.componente}
          perguntas={R.avaliacao}
        />
      )}

      {/* ─── Onde e quem concluiu ─── */}
      {mostra('escolas') && temConclusao && rankings > 0 && (
        <div className={`grid grid-cols-1 gap-4 items-stretch ${
          rankings === 3 ? 'xl:grid-cols-3' : rankings === 2 ? 'xl:grid-cols-2' : ''}`}>

          {temEscolas && (
            <Cartao className="flex flex-col">
              <TituloDeBloco
                acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  {br(R.escolas.total)} escolas
                </span>}
              >
                Escolas com mais concluintes
              </TituloDeBloco>

              {/* A barra mede a CONTAGEM, e a taxa vem em texto embaixo. Se a
                  régua fosse o percentual, a escola de 4 em 4 empataria no topo
                  com a de 51 em 61 -- as duas com 100%, e é a segunda que
                  importa. Vale para os três rankings desta linha. */}
              <ListaRanqueada
                itens={R.escolas.maiores.map((e) => ({
                  rotulo: e.escola,
                  valor: e.concluidos,
                  nota: `${e.gre} · ${pctBr(e.taxa)}% de ${br(e.vinculos)} vínculos`,
                }))}
              />
            </Cartao>
          )}

          {temMunicipios && (
            <Cartao className="flex flex-col">
              <TituloDeBloco
                acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  {br(R.porMunicipio.total)} municípios
                </span>}
              >
                Municípios com mais concluintes
              </TituloDeBloco>

              <ListaRanqueada
                itens={R.porMunicipio.itens.map((m) => ({
                  rotulo: m.chave,
                  valor: m.total,
                  nota: `${m.escolas} escolas · ${pctBr(m.taxa)}% de ${br(m.vinculos)} vínculos`,
                }))}
              />

              {/* Aqui a contagem é de VÍNCULO, e não de pessoa: quem leciona em
                  duas escolas de municípios diferentes concluiu nos dois
                  lugares. Somar as barras, por isso, não devolve o total de
                  concluintes que está lá em cima.
                  A escola sem município é dita, e não escondida: ela some do
                  ranking, e sem esse aviso o buraco viraria um número estranho
                  que ninguém explica. */}
              <p className="text-[12px] mt-3" style={{ color: 'var(--p-texto3)' }}>
                O município vem da escola, pelo código INEP. Um docente com escolas em
                dois municípios conta nos dois — a soma das barras não fecha com o total.
                {R.porMunicipio.cobertura.escolas > R.porMunicipio.cobertura.comMunicipio && (
                  <>
                    {' '}
                    <b style={{ color: 'var(--p-texto2)' }}>
                      {br(R.porMunicipio.cobertura.escolas - R.porMunicipio.cobertura.comMunicipio)}
                    </b>{' '}
                    de {br(R.porMunicipio.cobertura.escolas)} escolas ainda não têm município
                    no cadastro do INEP e ficam fora deste ranking.
                  </>
                )}
              </p>
            </Cartao>
          )}

          {temComponente && (
            <Cartao className="flex flex-col">
              <TituloDeBloco
                acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>
                  {pct(cobComp.comCadastro, cobComp.concluintes)}% dos concluintes
                </span>}
              >
                Componentes com mais concluintes
              </TituloDeBloco>

              <ListaRanqueada
                itens={R.porComponente.itens.map((c) => ({
                  rotulo: c.chave,
                  valor: c.total,
                }))}
              />

              <p className="text-[12px] mt-3" style={{ color: 'var(--p-texto3)' }}>
                O componente vem do cadastro do cursista, alcançado pelo CPF.{' '}
                <b style={{ color: 'var(--p-texto2)' }}>
                  {br(cobComp.concluintes - cobComp.comCadastro)}
                </b>{' '}
                concluintes ainda não têm par na base e ficam fora deste ranking.
              </p>
            </Cartao>
          )}
        </div>
      )}

      {/* ─── Lista ─── */}
      {mostra('lista') && temConclusao && (
        <ListaDeConcluintes cursoId={dados.cursoId} gre={dados.gre} />
      )}

    </section>
  )
}

/* ══════════════════ Operacional ══════════════════ */

export function BlocoOperacional({ dados, rotuloMes }) {
  const equipe = dados.operacional.equipe
  const prod = dados.operacional.producao
  const f = dados.operacional.frequencia

  const totalEquipe = equipe.reduce((s, e) => s + e.total, 0)
  const totalModulos = prod.modulosPorEstagio.reduce((s, e) => s + e.total, 0)
  const publicados = prod.modulosPorEstagio.find((e) => e.estagio === 'publicado')?.total || 0

  const ordemEstagio = ['producao', 'supervisao', 'coordenacao', 'publicado']
  // Etapa é caminho: rampa do escuro (começo) ao claro (publicado).
  const coresEstagio = ['var(--p-r5)', 'var(--p-r4)', 'var(--p-r3)', 'var(--p-r2)']
  const fatiasEstagio = ordemEstagio.map((chave, i) => ({
    rotulo: ROTULOS_ESTAGIO[chave],
    valor: prod.modulosPorEstagio.find((x) => x.estagio === chave)?.total || 0,
    cor: coresEstagio[i],
  })).filter((x) => x.valor > 0)

  /* Cumprida é o fim do caminho e fica no roxo mais forte; não cumprida sai da
     rampa e usa o vermelho de alerta, porque ali a cor precisa dizer "isto é
     diferente das outras", e não "isto é mais um degrau". */
  const fatiasFrequencia = [
    { rotulo: 'Cumpridas', valor: f.cumpridas, cor: 'var(--p-r5)' },
    { rotulo: 'Aguardando avaliação', valor: f.aguardando, cor: 'var(--p-r3)' },
    { rotulo: 'Ainda a fazer', valor: f.aFazer, cor: 'var(--p-r2)' },
    { rotulo: 'Não cumpridas', valor: f.naoCumpridas, cor: 'var(--p-negativo)' },
  ].filter((x) => x.valor > 0)

  return (
    <section className="space-y-4 pt-2">
      <TituloDaFaixa descricao={`Equipe, produção e frequência · ${rotuloMes}`}>Operacional</TituloDaFaixa>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CartaoKpi icone={Users} rotulo="Pessoas na equipe" valor={totalEquipe} gradiente="azul"
          comparativo={`${equipe.length} perfis diferentes`} />
        <CartaoKpi icone={Layers} rotulo="Módulos de curso" valor={totalModulos} gradiente="roxo"
          comparativo={`${publicados} já publicados`} />
        <CartaoKpi icone={FileText} rotulo="Materiais no ar" valor={prod.materiais.publicados} gradiente="ciano"
          comparativo={`de ${br(prod.materiais.total)} produzidos`} />
        <CartaoKpi
          icone={prod.modulosAtrasados > 0 ? AlertTriangle : CheckCircle2}
          rotulo={prod.modulosAtrasados > 0 ? 'Módulos fora do prazo' : 'Módulos no prazo'}
          valor={prod.modulosAtrasados}
          gradiente="rosa"
          comparativo={prod.modulosAtrasados > 0 ? 'passaram do prazo sem publicar' : 'nenhum atraso hoje'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{totalEquipe} pessoas</span>}
          >
            Composição da equipe
          </TituloDeBloco>
          <ListaRanqueada
            mostrarPosicao={false}
            itens={equipe.map((e) => ({
              rotulo: ROTULOS_PERFIL[e.role] || e.role,
              valor: e.total,
              nota: e.ativos < e.total ? `${e.total - e.ativos} inativo(s)` : null,
            }))}
          />
        </Cartao>

        <Cartao className="flex flex-col items-center justify-center gap-4">
          <TituloDeBloco>Onde estão os módulos</TituloDeBloco>
          <Rosca
            tamanho={168} espessura={22} total={totalModulos}
            centroValor={br(totalModulos)} centroRotulo="módulos"
            fatias={fatiasEstagio}
          />
          <div className="w-full">
            <LegendaDeRosca fatias={fatiasEstagio} total={totalModulos} />
          </div>
        </Cartao>

        <Cartao className="flex flex-col">
          <TituloDeBloco
            acao={<span className="text-[12px]" style={{ color: 'var(--p-texto3)' }}>{rotuloMes}</span>}
          >
            Frequência da equipe
          </TituloDeBloco>

          {f.total === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
              <p className="text-sm font-semibold" style={{ color: 'var(--p-texto2)' }}>
                Nada atribuído em {rotuloMes}
              </p>
              <p className="text-[13px]" style={{ color: 'var(--p-texto3)' }}>
                O cumprimento aparece assim que a coordenação atribuir as atividades.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <Rosca
                  tamanho={132} espessura={18} total={f.total}
                  centroValor={`${f.frequencia}%`} centroRotulo="cumprido"
                  fatias={fatiasFrequencia}
                />
                <div className="flex-1 min-w-0">
                  <LegendaDeRosca fatias={fatiasFrequencia} total={f.total} />
                </div>
              </div>

              <div className="grid gap-2.5 mt-4 pt-4 border-t" style={{ borderColor: 'var(--p-cartaoBorda)' }}>
                {f.porPerfil.slice(0, 4).map((p, i) => (
                  <div key={p.role}>
                    <div className="flex items-baseline justify-between text-[12px] mb-1">
                      <span style={{ color: 'var(--p-texto2)' }}>{ROTULOS_PERFIL[p.role] || p.role}</span>
                      <span className="tabular-nums" style={{ color: 'var(--p-texto3)' }}>
                        {p.cumpridas}/{p.total} · <b style={{ color: 'var(--p-texto)' }}>{p.frequencia}%</b>
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--p-trilho)' }}>
                      <div
                        className="h-full rounded-full animate-barra origin-left"
                        style={{
                          width: `${p.frequencia}%`,
                          background: p.frequencia >= 75
                            ? 'linear-gradient(90deg, var(--p-r3), var(--p-r5))'
                            : p.frequencia >= 50
                              ? 'linear-gradient(90deg, var(--p-r2), var(--p-r4))'
                              : 'linear-gradient(90deg, var(--p-r1), var(--p-negativo))',
                          animationDelay: `${i * 60}ms`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Cartao>
      </div>
    </section>
  )
}
