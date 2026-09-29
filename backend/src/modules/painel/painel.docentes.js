'use strict'

const { getPool, requireMysql } = require('../../shared/db')

/**
 * A lista de docentes dos cursos, uma linha por PESSOA.
 *
 * ─── Por que somar linhas nao respondia a pergunta ───
 *
 * A tabela `consolidado_vinculos` guarda um vinculo por curso e por escola, que
 * e a forma certa de guardar. Mas a lista da tela mostrava exatamente isso, e o
 * total virava a soma de curso x escola: quem faz dois cursos em duas escolas
 * aparecia quatro vezes, e o rodape somava dezoito mil para uma rede de doze
 * mil docentes. O numero estava certo e a pergunta estava errada.
 *
 * Aqui a linha e o docente. O que ele fez em cada curso vira uma COLUNA, com o
 * nome do curso no cabecalho e a situacao na celula. Quem esta em quatro cursos
 * continua sendo uma linha, com quatro colunas preenchidas, e o total do rodape
 * volta a ser gente.
 *
 * ─── Os filtros escolhem PESSOAS, nao linhas ───
 *
 * Todo filtro entra por EXISTS sobre o mesmo CPF. Filtrar no proprio vinculo
 * pareceria funcionar e mentiria no detalhe: procurar a 1ª GRE e comparar
 * `v.gre = '1ª GRE'` no WHERE apagaria a segunda escola de quem leciona em
 * duas, e a coluna "Escola" mostraria uma so -- dando a entender que a pessoa
 * tem um vinculo quando tem dois.
 */

const numero = (valor) => Number(valor || 0)

/** CPF na tela: os seis do meio escondidos, como nas demais listas do sistema. */
const mascarar = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : d
}

/** No arquivo o CPF sai com pontuacao, para o Excel nao comer o zero a esquerda. */
const cpfComPontos = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d
}

const ROTULOS = {
  concluido: 'Concluído',
  em_andamento: 'Em andamento',
  nao_concluido: 'Não concluiu',
}

/**
 * A situacao de um curso, escolhida entre os vinculos da pessoa.
 *
 * Quem leciona em duas escolas tem duas linhas do MESMO curso, e elas podem
 * discordar. Vale a melhor: concluir numa escola e concluir o curso -- a
 * matricula e da pessoa, nao do predio. Por isso a ordem vira numero no SQL, em
 * vez de um MAX() sobre o texto, que devolveria "nao_concluido" por ser o maior
 * em ordem alfabetica e transformaria um concluinte em desistente.
 */
const ORDEM_SQL = "CASE v.status WHEN 'concluido' THEN 3 WHEN 'em_andamento' THEN 2 ELSE 1 END"
const DO_NUMERO = { 3: 'concluido', 2: 'em_andamento', 1: 'nao_concluido' }

/**
 * As colunas fixas. Whitelist, e nao texto vindo da tela: o que nao esta aqui
 * nao existe, e nome de coluna livre no SELECT seria deixar o cliente escrever
 * SQL.
 *
 * `sensivel` marca o que so sai completo no arquivo baixado.
 */
const FIXAS = {
  nome: { titulo: 'Docente', sql: 'MAX(v.docente)' },
  /* Fora do padrao de proposito: o CPF e o dado mais sensivel da tela e quase
     nunca e o que se esta procurando. Quem precisa dele marca a coluna, e isso
     ja e uma decisao consciente. */
  cpf: { titulo: 'CPF', sql: 'v.cpf', sensivel: true },
  gre: {
    titulo: 'GRE',
    sql: `GROUP_CONCAT(DISTINCT NULLIF(v.gre, '') ORDER BY NULLIF(v.gre, '') SEPARATOR ' | ')`,
  },
  inep: {
    titulo: 'INEP',
    sql: `GROUP_CONCAT(DISTINCT NULLIF(v.inep, '') ORDER BY NULLIF(v.inep, '') SEPARATOR ' | ')`,
  },
  escola: {
    titulo: 'Escola',
    sql: `GROUP_CONCAT(DISTINCT NULLIF(v.escola, '') ORDER BY NULLIF(v.escola, '') SEPARATOR ' | ')`,
  },
  /* O ORDER BY nao e enfeite: sem ele a ordem dentro da celula e a que o
     agrupamento devolver, e duas execucoes da mesma consulta podem escrever os
     mesmos municipios em ordens diferentes -- o que faz duas exportacoes do
     mesmo recorte parecerem discordar. */
  municipio: {
    titulo: 'Município',
    sql: `GROUP_CONCAT(DISTINCT (SELECT em.municipio FROM escola_municipio em WHERE em.inep = v.inep)
                       ORDER BY (SELECT em.municipio FROM escola_municipio em WHERE em.inep = v.inep)
                       SEPARATOR ' | ')`,
  },
  /* Funcao e componente vivem no CADASTRO, e chegam pelo CPF. Quem nao casou com
     a base volta vazio aqui -- e a coluna "No cadastro" e o que explica por que. */
  funcao: { titulo: 'Função', sql: 'MAX(cur.funcao)' },
  componente: { titulo: 'Componente curricular', sql: 'MAX(cur.componente_curricular)' },
  naBase: { titulo: 'No cadastro', sql: "IF(MAX(v.cursista_id) IS NOT NULL, 'Sim', 'Não')" },
  cursos: { titulo: 'Cursos', sql: 'COUNT(DISTINCT v.course_id)', inteiro: true },
  concluidos: {
    titulo: 'Concluiu',
    sql: "COUNT(DISTINCT CASE WHEN v.status = 'concluido' THEN v.course_id END)",
    inteiro: true,
  },
}

/** O que a tela mostra quando ninguem escolheu nada -- mais todos os cursos. */
const PADRAO_FIXAS = ['nome', 'gre', 'escola', 'inep']

/** A chave da coluna de um curso. O id vem do banco e passa por Number(). */
const chaveDoCurso = (id) => `curso_${Number(id)}`

/** Os cursos que ja tem planilha de consolidado importada. */
async function cursosDoConsolidado() {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT c.id, c.name AS nome
       FROM courses c
      WHERE EXISTS (SELECT 1 FROM consolidado_vinculos v WHERE v.course_id = c.id)
      ORDER BY c.name`
  )
  return linhas.map((l) => ({ id: Number(l.id), nome: l.nome }))
}

/** O catalogo completo de colunas: as fixas mais uma por curso. */
function catalogo(cursos) {
  const lista = Object.entries(FIXAS).map(([chave, c]) => ({
    chave, titulo: c.titulo, padrao: PADRAO_FIXAS.includes(chave), curso: null,
  }))
  cursos.forEach((c) => {
    lista.push({ chave: chaveDoCurso(c.id), titulo: c.nome, padrao: true, curso: c.id })
  })
  return lista
}

/** So o que existe no catalogo, na ordem pedida, com o nome sempre presente. */
function normalizarColunas(pedidas, cursos) {
  const validas = new Set([...Object.keys(FIXAS), ...cursos.map((c) => chaveDoCurso(c.id))])
  const padrao = [...PADRAO_FIXAS, ...cursos.map((c) => chaveDoCurso(c.id))]
  const lista = (Array.isArray(pedidas) ? pedidas : String(pedidas || '').split(','))
    .map((c) => String(c).trim())
    .filter((c) => validas.has(c))
  const unicas = [...new Set(lista.length ? lista : padrao)]
  // Sem o nome, a linha vira um punhado de atributos sem dono.
  return unicas.includes('nome') ? unicas : ['nome', ...unicas]
}

/**
 * O WHERE, sempre por EXISTS sobre o CPF -- ver o cabecalho do arquivo.
 *
 * `situacao` muda de sentido conforme haja curso escolhido, e e proposital:
 * com um curso, pergunta pela situacao NAQUELE curso; sem curso, pergunta se a
 * pessoa tem essa situacao em ALGUM. Sao as duas perguntas que se faz, e
 * oferecer so a segunda deixaria "quem nao concluiu Legislacao" sem resposta.
 */
function montarFiltro({ gre, inep, busca, cursoId, situacao }) {
  const onde = []
  const params = []
  const existe = (condicao, valores) => {
    onde.push(` AND EXISTS (SELECT 1 FROM consolidado_vinculos x WHERE x.cpf = v.cpf${condicao})`)
    params.push(...valores)
  }

  if (gre) existe(' AND x.gre = ?', [gre])
  if (inep) existe(' AND x.inep = ?', [String(inep).replace(/\D/g, '')])
  if (cursoId) existe(' AND x.course_id = ?', [cursoId])

  /* A situacao filtra pela MESMA situacao que a celula mostra.
     Comparar `x.status = ?` linha a linha parecia equivalente e nao era: quem
     concluiu numa escola e nao na outra tem as duas linhas, entao aparecia ao
     mesmo tempo em "concluiu" e em "nao concluiu" -- e em "nao concluiu" com a
     celula escrita "Concluído" ao lado, que e a tela se contradizendo. O
     GROUP BY resolve a situacao do curso antes de comparar, pela mesma regra
     da coluna. */
  if (situacao) {
    const nivel = Object.keys(DO_NUMERO).find((n) => DO_NUMERO[n] === situacao)
    existe(
      `${cursoId ? ' AND x.course_id = ?' : ''}
         GROUP BY x.course_id
         HAVING MAX(CASE x.status WHEN 'concluido' THEN 3 WHEN 'em_andamento' THEN 2 ELSE 1 END) = ?`,
      cursoId ? [cursoId, Number(nivel)] : [Number(nivel)]
    )
  }

  /* O nome procura em qualquer posicao; o CPF, so no comeco. Curinga dos dois
     lados no CPF descartaria o indice para varrer a tabela inteira a cada tecla
     digitada, e ninguem procura pelo meio de um CPF. */
  const termo = String(busca || '').trim()
  if (termo.length >= 3) {
    const digitos = termo.replace(/\D/g, '')
    if (digitos.length >= 3) {
      onde.push(' AND (v.docente LIKE ? OR v.cpf LIKE ?)')
      params.push(`%${termo}%`, `${digitos}%`)
    } else {
      onde.push(' AND v.docente LIKE ?')
      params.push(`%${termo}%`)
    }
  }

  return { sql: onde.join(''), params }
}

/* O LEFT JOIN com o cadastro e por cursista_id, que a importacao ja resolveu em
   SQL: refazer a ligacao pelo CPF aqui repetiria trabalho a cada pagina virada. */
const DE = `FROM consolidado_vinculos v
            LEFT JOIN cursistas cur ON cur.id = v.cursista_id`

/** Monta o SELECT das colunas escolhidas, fixas e de curso. */
function selecionar(colunas) {
  return colunas.map((c) => {
    if (FIXAS[c]) return `${FIXAS[c].sql} AS \`${c}\``
    const id = Number(c.slice('curso_'.length))
    return `MAX(CASE WHEN v.course_id = ${id} THEN ${ORDEM_SQL} END) AS \`${c}\``
  }).join(', ')
}

/** Um valor de celula, pronto para a tela ou para o arquivo. */
function formatar(chave, bruto, { completo = false } = {}) {
  if (chave === 'cpf') return completo ? cpfComPontos(bruto) : mascarar(bruto)
  if (!FIXAS[chave]) {
    // Curso: vazio quer dizer que a pessoa nao esta nele, e nao que reprovou.
    return bruto === null || bruto === undefined ? '' : (ROTULOS[DO_NUMERO[Number(bruto)]] || '')
  }
  if (FIXAS[chave].inteiro) return numero(bruto)
  return bruto === null || bruto === undefined ? '' : String(bruto)
}

/** A lista na tela: uma pagina de docentes mais o total do recorte. */
async function consultar({
  gre = null, inep = null, busca = '', cursoId = null, situacao = null,
  colunas = null, pagina = 1, porPagina = 25,
} = {}) {
  requireMysql()
  const cursos = await cursosDoConsolidado()
  const escolhidas = normalizarColunas(colunas, cursos)
  const f = montarFiltro({ gre, inep, busca, cursoId, situacao })
  const limite = Math.min(200, Math.max(5, Number(porPagina) || 25))
  const salto = Math.max(0, ((Number(pagina) || 1) - 1) * limite)

  const [[cont]] = await getPool().query(
    `SELECT COUNT(DISTINCT v.cpf) AS total, COUNT(*) AS vinculos
       ${DE} WHERE 1 = 1${f.sql}`, f.params
  )

  const [linhas] = await getPool().query(
    `SELECT v.cpf AS _cpf, ${selecionar(escolhidas)}
       ${DE}
      WHERE 1 = 1${f.sql}
      GROUP BY v.cpf
      ORDER BY MAX(v.docente), v.cpf
      LIMIT ${limite} OFFSET ${salto}`, f.params
  )

  return {
    total: numero(cont.total),
    // O numero antigo continua disponivel, e agora rotulado: quem quiser
    // conferir com a planilha original tem com o que comparar.
    vinculos: numero(cont.vinculos),
    pagina: Number(pagina) || 1,
    porPagina: limite,
    colunas: escolhidas.map((c) => ({
      chave: c,
      titulo: FIXAS[c] ? FIXAS[c].titulo : (cursos.find((x) => chaveDoCurso(x.id) === c)?.nome || c),
      curso: !FIXAS[c],
    })),
    itens: linhas.map((l) => {
      const linha = {}
      escolhidas.forEach((c) => { linha[c] = formatar(c, l[c]) })
      return linha
    }),
  }
}

/**
 * O mesmo recorte inteiro, para o arquivo.
 *
 * O CPF sai completo: a planilha existe para cruzar com outros sistemas, e CPF
 * pela metade nao cruza com nada. Baixar e uma acao deliberada de quem ja passou
 * pelo login e pelo perfil.
 *
 * O teto de 50 mil linhas e protecao de memoria numa VPS de 957 MB -- aqui a
 * linha e o docente, entao ele cobre uma rede quatro vezes maior que a atual.
 */
async function paraExportar({
  gre = null, inep = null, busca = '', cursoId = null, situacao = null, colunas = null,
} = {}) {
  requireMysql()
  const cursos = await cursosDoConsolidado()
  const escolhidas = normalizarColunas(colunas, cursos)
  const f = montarFiltro({ gre, inep, busca, cursoId, situacao })

  const [linhas] = await getPool().query(
    `SELECT ${selecionar(escolhidas)}
       ${DE}
      WHERE 1 = 1${f.sql}
      GROUP BY v.cpf
      ORDER BY MAX(v.docente), v.cpf
      LIMIT 50000`, f.params
  )

  return {
    colunas: escolhidas.map((c) => ({
      chave: c,
      titulo: FIXAS[c] ? FIXAS[c].titulo : (cursos.find((x) => chaveDoCurso(x.id) === c)?.nome || c),
      valor: (l) => formatar(c, l[c], { completo: true }),
    })),
    linhas,
  }
}

/** O catalogo de colunas e de situacoes, para a tela montar os controles. */
async function opcoes() {
  const cursos = await cursosDoConsolidado()
  return {
    colunas: catalogo(cursos),
    cursos,
    situacoes: [
      { chave: 'concluido', rotulo: 'Concluiu' },
      { chave: 'nao_concluido', rotulo: 'Não concluiu' },
      { chave: 'em_andamento', rotulo: 'Em andamento' },
    ],
  }
}

module.exports = { consultar, paraExportar, opcoes, cursosDoConsolidado }
