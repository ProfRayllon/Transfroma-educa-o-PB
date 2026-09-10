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
function filtros({ cursoId = null, gre = null, alias = '' } = {}) {
  // O alias e prefixado aqui, e nao remendado no SQL depois: consulta com JOIN
  // precisa de `v.course_id`, e trocar isso por substituicao de texto no SQL
  // pronto quebra em silencio no dia em que outra coluna tiver o mesmo nome.
  const q = alias ? `${alias}.` : ''
  const sql = []
  const params = []
  if (cursoId) { sql.push(` AND ${q}course_id = ?`); params.push(cursoId) }
  if (gre) { sql.push(` AND ${q}gre = ?`); params.push(gre) }
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


/**
 * Escolas alcancadas pelo consolidado, e as que mais concluiram.
 *
 * A escola sai da propria planilha (INEP + nome), e nao do cadastro: a planilha
 * e a fonte de quem concluiu, e amarrar a contagem ao cadastro perderia toda
 * escola de gente que a base ainda nao tem.
 *
 * A taxa da escola usa VINCULO, e nao pessoa: a pergunta e "como esta esta
 * escola", e quem leciona em duas responde as duas.
 */
async function escolasDoConsolidado({ cursoId = null, gre = null, limite = 8 } = {}) {
  requireMysql()
  const f = filtros({ cursoId, gre })

  const [[resumo]] = await getPool().query(
    `SELECT COUNT(DISTINCT inep) AS escolas, COUNT(DISTINCT gre) AS gres
       FROM consolidado_vinculos
      WHERE 1 = 1${f.sql}`, f.params
  )

  const [linhas] = await getPool().query(
    `SELECT inep, MIN(escola) AS escola, MIN(gre) AS gre,
            COUNT(*) AS vinculos,
            SUM(status = 'concluido') AS concluidos
       FROM consolidado_vinculos
      WHERE 1 = 1${f.sql}
      GROUP BY inep
      ORDER BY concluidos DESC, vinculos DESC
      LIMIT ${Number(limite)}`, f.params
  )

  return {
    total: numero(resumo.escolas),
    gres: numero(resumo.gres),
    maiores: linhas.map((l) => ({
      inep: l.inep,
      escola: l.escola,
      gre: l.gre,
      vinculos: numero(l.vinculos),
      concluidos: numero(l.concluidos),
      taxa: numero(l.vinculos)
        ? Math.round((numero(l.concluidos) / numero(l.vinculos)) * 1000) / 10
        : 0,
    })),
  }
}

/**
 * Quem concluiu, por funcao no magisterio.
 *
 * A funcao vive no CADASTRO, e nao na planilha -- entao este recorte so enxerga
 * quem teve o CPF encontrado na base. `cobertura` viaja junto para a tela poder
 * dizer sobre quantas pessoas ela esta falando: um grafico de oito mil
 * concluintes que na verdade descreve tres mil e um grafico que mente com
 * numeros certos.
 */
async function concluintesPorFuncao({ cursoId = null, gre = null } = {}) {
  requireMysql()
  const f = filtros({ cursoId, gre, alias: 'v' })

  const [linhas] = await getPool().query(
    `SELECT cur.funcao AS chave, COUNT(DISTINCT v.cpf) AS total
       FROM consolidado_vinculos v
       JOIN cursistas cur ON cur.id = v.cursista_id
      WHERE v.status = 'concluido'
        AND cur.funcao IS NOT NULL AND cur.funcao <> ''${f.sql}
      GROUP BY cur.funcao
      ORDER BY total DESC`, f.params
  )

  const s = filtros({ cursoId, gre })
  const [[cob]] = await getPool().query(
    `SELECT COUNT(DISTINCT cpf) AS concluintes,
            COUNT(DISTINCT CASE WHEN cursista_id IS NOT NULL THEN cpf END) AS comCadastro
       FROM consolidado_vinculos
      WHERE status = 'concluido'${s.sql}`, s.params
  )

  return {
    itens: linhas.map((l) => ({ chave: l.chave, total: numero(l.total) })),
    cobertura: { concluintes: numero(cob.concluintes), comCadastro: numero(cob.comCadastro) },
  }
}

/**
 * O CPF que sai para a tela vai mascarado.
 *
 * Sao oito mil nomes, e a tela nao precisa do numero inteiro para alguem
 * conferir uma linha. O CPF completo existe na exportacao, que e um ato
 * deliberado. Mascarar no SERVIDOR e o que faz diferenca: mascara aplicada no
 * navegador ainda entrega o dado inteiro pela rede, e qualquer um o le no
 * inspetor do proprio browser.
 */
const mascarar = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.***.**${d.slice(9)}` : '—'
}

/**
 * A lista de docentes do consolidado, paginada.
 *
 * Fica fora do payload do dashboard de proposito: aquele e um punhado de
 * agregados de 10 KB com cache de um minuto em memoria, e enfiar oito mil linhas
 * de gente dentro dele encheria o cache de dado pessoal e faria toda abertura do
 * painel carregar uma tabela que quase ninguem rola.
 */
async function listaDeConcluintes({
  cursoId = null, gre = null, status = null, busca = '', pagina = 1, porPagina = 25,
} = {}) {
  requireMysql()

  const f = filtros({ cursoId, gre, alias: 'v' })
  const onde = [f.sql]
  const params = [...f.params]
  if (status) { onde.push(' AND v.status = ?'); params.push(status) }

  /**
   * A busca aceita o CPF com ou sem pontuacao, entao compara so os digitos. O
   * nome usa curinga apenas no fim: curinga nos dois lados descarta o indice e
   * varre doze mil linhas a cada tecla digitada.
   */
  const termo = String(busca || '').trim()
  if (termo) {
    const digitos = termo.replace(/\D/g, '')
    if (digitos.length >= 3) {
      onde.push(' AND (v.docente LIKE ? OR v.cpf LIKE ?)')
      params.push(`%${termo}%`, `${digitos}%`)
    } else {
      onde.push(' AND v.docente LIKE ?')
      params.push(`%${termo}%`)
    }
  }

  const filtro = onde.join('')
  const limite = Math.min(100, Math.max(5, Number(porPagina) || 25))
  const salto = Math.max(0, ((Number(pagina) || 1) - 1) * limite)

  const [[cont]] = await getPool().query(
    `SELECT COUNT(*) AS total FROM consolidado_vinculos v WHERE 1 = 1${filtro}`, params
  )

  const [linhas] = await getPool().query(
    `SELECT v.cpf, v.docente, v.gre, v.escola, v.status,
            c.name AS curso,
            v.cursista_id IS NOT NULL AS naBase
       FROM consolidado_vinculos v
       JOIN courses c ON c.id = v.course_id
      WHERE 1 = 1${filtro}
      ORDER BY v.docente, v.escola
      LIMIT ${limite} OFFSET ${salto}`, params
  )

  return {
    total: numero(cont.total),
    pagina: Number(pagina) || 1,
    porPagina: limite,
    // Uma linha por VINCULO: quem leciona em duas escolas aparece duas vezes,
    // com a escola de cada uma. E o que a planilha diz, e esconder a segunda
    // faria a soma da tela nao fechar com o total mostrado em cima.
    itens: linhas.map((l) => ({
      cpf: mascarar(l.cpf),
      docente: l.docente,
      gre: l.gre,
      escola: l.escola,
      curso: l.curso,
      status: l.status,
      naBase: !!Number(l.naBase),
    })),
  }
}

/** A mesma lista, inteira e com o CPF completo, para a exportacao. */
async function listaParaExportar({ cursoId = null, gre = null, status = null } = {}) {
  requireMysql()
  const f = filtros({ cursoId, gre, alias: 'v' })
  const params = [...f.params]
  let extra = ''
  if (status) { extra = ' AND v.status = ?'; params.push(status) }

  const [linhas] = await getPool().query(
    `SELECT v.cpf, v.docente, v.gre, v.inep, v.escola, v.status, c.name AS curso
       FROM consolidado_vinculos v
       JOIN courses c ON c.id = v.course_id
      WHERE 1 = 1${f.sql}${extra}
      ORDER BY v.gre, v.escola, v.docente`, params
  )
  return linhas
}

module.exports = {
  conclusao,
  conclusaoPorGre,
  avaliacaoPorPergunta,
  avaliacaoNota,
  componentesAvaliadores,
  opcoesDeFiltro,
  evolucaoDaConclusao,
  escolasDoConsolidado,
  concluintesPorFuncao,
  listaDeConcluintes,
  listaParaExportar,
}
