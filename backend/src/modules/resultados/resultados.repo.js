'use strict'

const { getPool, requireMysql } = require('../../shared/db')

/**
 * Leituras dos resultados que chegam por planilha.
 *
 * Tudo aqui e agregado: nenhuma funcao devolve linha de pessoa. O consolidado
 * tem CPF e nome, e o painel nunca precisa deles -- so das contagens.
 */

const numero = (valor) => Number(valor || 0)

/**
 * DATE do MySQL lido como data local.
 *
 * O driver devolve um objeto Date, e String(date) daria "Mon Sep 07 2026...".
 * Passar por toISOString tambem nao serve: a data nasce a meia-noite local e o
 * UTC a joga para o dia anterior em qualquer fuso a oeste de Greenwich -- o que
 * inclui a Paraiba.
 */
function dia(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Filtro de curso e de GRE para o consolidado.
 *
 * A GRE so existe no consolidado. A avaliacao e anonima e nao carrega regional
 * nenhuma, entao nenhuma consulta de avaliacao aceita este filtro -- ela nao o
 * ignoraria em silencio, ela simplesmente nao o oferece.
 */
function filtros({ cursoId = null, gre = null } = {}) {
  const sql = []
  const params = []
  if (cursoId) { sql.push(' AND course_id = ?'); params.push(cursoId) }
  if (gre) { sql.push(' AND gre = ?'); params.push(gre) }
  return { sql: sql.join(''), params }
}

/**
 * Quantos concluiram.
 *
 * A base de comparacao e o par (curso, pessoa), nao a linha da planilha. A
 * planilha traz um vinculo por escola: 12.786 linhas para 11.871 pessoas, porque
 * 841 professores lecionam em duas. Contar linha inflaria tanto o numerador
 * quanto o denominador e, pior, a inflacao nao e igual nos dois -- so coincide
 * enquanto ninguem tiver status diferente entre suas escolas.
 *
 * Com um curso selecionado, o par (curso, pessoa) e a propria pessoa. Sem
 * filtro, quem fez dois cursos conta duas vezes -- que e o certo: sao duas
 * conclusoes a acompanhar.
 */
async function conclusao({ cursoId = null, gre = null } = {}) {
  requireMysql()
  const f = filtros({ cursoId, gre })

  const [[r]] = await getPool().query(
    `SELECT COUNT(DISTINCT course_id, cpf) AS base,
            COUNT(DISTINCT CASE WHEN status = 'concluido' THEN CONCAT(course_id, ':', cpf) END) AS concluintes,
            COUNT(*) AS vinculos,
            SUM(status = 'concluido') AS vinculosConcluidos,
            COUNT(DISTINCT CASE WHEN cursista_id IS NULL THEN cpf END) AS semCadastro
       FROM consolidado_vinculos
      WHERE 1 = 1${f.sql}`, f.params
  )

  const [[quando]] = await getPool().query(
    `SELECT MAX(referencia) AS referencia
       FROM resultado_importacoes
      WHERE tipo = 'consolidado'${cursoId ? ' AND course_id = ?' : ''}`,
    cursoId ? [cursoId] : []
  )

  const base = numero(r.base)
  return {
    base,
    concluintes: numero(r.concluintes),
    taxa: base ? Math.round((numero(r.concluintes) / base) * 1000) / 10 : 0,
    vinculos: numero(r.vinculos),
    vinculosConcluidos: numero(r.vinculosConcluidos),
    // Quantos vieram na planilha sem casar com o cadastro. Vira numero na tela
    // em vez de sumir: linha que nao encontra par e informacao, nao defeito.
    semCadastro: numero(r.semCadastro),
    referencia: dia(quando.referencia),
  }
}

/**
 * Conclusao por regional.
 *
 * Aqui a conta e por VINCULO, e nao por pessoa: a pergunta e "como esta a
 * regional", e quem leciona em duas regionais responde as duas. Somar a coluna
 * entre GREs, por isso, nao devolve o total do curso -- o total sai de
 * conclusao().
 */
async function conclusaoPorGre({ cursoId = null } = {}) {
  requireMysql()
  const f = filtros({ cursoId })

  const [linhas] = await getPool().query(
    `SELECT COALESCE(gre, 'Sem GRE') AS gre,
            COUNT(*) AS vinculos,
            SUM(status = 'concluido') AS concluidos
       FROM consolidado_vinculos
      WHERE 1 = 1${f.sql}
      GROUP BY COALESCE(gre, 'Sem GRE')
      ORDER BY gre`, f.params
  )

  return linhas.map((l) => ({
    gre: l.gre,
    vinculos: numero(l.vinculos),
    concluidos: numero(l.concluidos),
    taxa: numero(l.vinculos) ? Math.round((numero(l.concluidos) / numero(l.vinculos)) * 1000) / 10 : 0,
  }))
}

/**
 * A avaliacao, pergunta a pergunta.
 *
 * O agrupamento e pelo TEXTO da pergunta, nao pela posicao dela no formulario:
 * sem curso selecionado, a mesma posicao pode ser uma pergunta em um curso e
 * outra em outro, e somar por posicao juntaria coisas diferentes num numero so.
 *
 * `pctTopo` e a proporcao de quem escolheu o topo da escala. Ela e comparavel
 * DENTRO de uma escala, e nao entre escalas: quanto mais opcoes a escala tem,
 * mais dificil e acertar o topo dela. Neste mesmo formulario, 'Sim' (de tres
 * opcoes) da 80,6%, 'Muito relevante' (de quatro) da 75,5% e a nota 5 (de cinco)
 * da 77,3% -- lidos como um ranking unico, apontariam a relevancia como o ponto
 * mais fraco do curso quando o numero so reflete o tamanho da escala.
 *
 * Por isso `escala` viaja junto de cada linha: quem desenha o grafico precisa
 * dela para agrupar antes de ordenar. Uma media unica seria pior ainda -- somar
 * tres pontos com quatro e com cinco produz um numero sem unidade, que mudaria
 * de valor se a proxima edicao trocasse uma pergunta de vocabulario.
 */
async function avaliacaoPorPergunta({ cursoId = null, componente = null } = {}) {
  requireMysql()

  const onde = []
  const params = []
  if (cursoId) { onde.push(' AND course_id = ?'); params.push(cursoId) }
  if (componente) { onde.push(' AND componente = ?'); params.push(componente) }

  const [linhas] = await getPool().query(
    `SELECT pergunta, escala,
            MIN(ordem) AS ordem,
            SUM(total) AS respostas,
            SUM(topo * total) AS topo
       FROM avaliacao_respostas
      WHERE 1 = 1${onde.join('')}
      GROUP BY pergunta, escala
      ORDER BY ordem`, params
  )

  return linhas.map((l) => ({
    ordem: numero(l.ordem),
    pergunta: l.pergunta,
    escala: l.escala,
    respostas: numero(l.respostas),
    topo: numero(l.topo),
    pctTopo: numero(l.respostas)
      ? Math.round((numero(l.topo) / numero(l.respostas)) * 1000) / 10
      : 0,
  }))
}

/** A nota geral de 1 a 5: media e distribuicao. */
async function avaliacaoNota({ cursoId = null, componente = null } = {}) {
  requireMysql()

  const onde = []
  const params = []
  if (cursoId) { onde.push(' AND course_id = ?'); params.push(cursoId) }
  if (componente) { onde.push(' AND componente = ?'); params.push(componente) }

  const [linhas] = await getPool().query(
    `SELECT resposta AS nota, SUM(total) AS total
       FROM avaliacao_respostas
      WHERE escala = 'nota5'${onde.join('')}
      GROUP BY resposta
      ORDER BY resposta`, params
  )

  const distribuicao = linhas.map((l) => ({ nota: Number(l.nota), total: numero(l.total) }))
  const respostas = distribuicao.reduce((s, d) => s + d.total, 0)
  const soma = distribuicao.reduce((s, d) => s + d.nota * d.total, 0)

  return {
    media: respostas ? Math.round((soma / respostas) * 100) / 100 : 0,
    respostas,
    distribuicao,
    // Quem deu 4 ou 5. Acompanha a media porque media sozinha esconde a forma:
    // 4,7 pode ser todo mundo dando 5 menos um punhado dando 1.
    satisfeitos: distribuicao.filter((d) => d.nota >= 4).reduce((s, d) => s + d.total, 0),
  }
}

/** Os componentes curriculares que responderam, para o filtro da avaliacao. */
async function componentesAvaliadores({ cursoId = null } = {}) {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT componente, SUM(total) AS respostas
       FROM avaliacao_respostas
      WHERE componente IS NOT NULL AND ordem = 1${cursoId ? ' AND course_id = ?' : ''}
      GROUP BY componente
      ORDER BY respostas DESC`, cursoId ? [cursoId] : []
  )
  return linhas.map((l) => ({ chave: l.componente, total: numero(l.respostas) }))
}

/**
 * O que existe para filtrar.
 *
 * Devolve so os cursos que tem resultado importado e so as GREs que aparecem no
 * consolidado. Oferecer na tela um filtro que nao tem dado por tras produz o
 * pior resultado possivel: a pessoa seleciona, tudo zera, e ela conclui que o
 * curso fracassou em vez de que a planilha ainda nao chegou.
 */
async function opcoesDeFiltro() {
  requireMysql()
  const pool = getPool()

  const [cursos] = await pool.query(
    `SELECT c.id, c.name AS nome,
            MAX(i.tipo = 'consolidado') AS temConsolidado,
            MAX(i.tipo = 'avaliacao') AS temAvaliacao,
            MAX(i.referencia) AS atualizadoEm
       FROM resultado_importacoes i
       JOIN courses c ON c.id = i.course_id
      GROUP BY c.id, c.name
      ORDER BY c.name`
  )

  const [gres] = await pool.query(
    `SELECT COALESCE(gre, 'Sem GRE') AS gre, COUNT(*) AS vinculos
       FROM consolidado_vinculos
      GROUP BY COALESCE(gre, 'Sem GRE')
      ORDER BY gre`
  )

  return {
    cursos: cursos.map((c) => ({
      id: c.id,
      nome: c.nome,
      temConsolidado: !!Number(c.temConsolidado),
      temAvaliacao: !!Number(c.temAvaliacao),
      atualizadoEm: dia(c.atualizadoEm),
    })),
    gres: gres.map((g) => ({ chave: g.gre, total: numero(g.vinculos) })),
  }
}

/**
 * Evolucao da conclusao ao longo das entregas semanais.
 *
 * Com uma unica importacao isto devolve um ponto so. A tela precisa conferir o
 * tamanho antes de desenhar: uma linha de um ponto nao e uma linha, e um grafico
 * de tendencia com um ponto sugere uma tendencia que ninguem mediu.
 */
async function evolucaoDaConclusao({ cursoId = null } = {}) {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT referencia,
            SUM(vinculos) AS vinculos,
            SUM(concluidos) AS concluidos
       FROM consolidado_historico
      WHERE 1 = 1${cursoId ? ' AND course_id = ?' : ''}
      GROUP BY referencia
      ORDER BY referencia`, cursoId ? [cursoId] : []
  )
  return linhas.map((l) => ({
    referencia: dia(l.referencia),
    vinculos: numero(l.vinculos),
    concluidos: numero(l.concluidos),
    taxa: numero(l.vinculos) ? Math.round((numero(l.concluidos) / numero(l.vinculos)) * 1000) / 10 : 0,
  }))
}

module.exports = {
  conclusao,
  conclusaoPorGre,
  avaliacaoPorPergunta,
  avaliacaoNota,
  componentesAvaliadores,
  opcoesDeFiltro,
  evolucaoDaConclusao,
}
