'use strict'

const { getPool, requireMysql } = require('../../shared/db')

/**
 * A planilha da base, montada na tela.
 *
 * Quem usa o painel pede recortes que nenhum grafico responde: "me da os
 * docentes da 5a GRE sem cadastro confirmado, com nome, escola e ultimo
 * acesso". Ate aqui isso virava pedido para alguem consultar o banco. Esta
 * consulta deixa a propria pessoa escolher as colunas e os filtros, ver o
 * resultado na tela e baixar exatamente o que esta vendo.
 *
 * ─── Uma linha por CADASTRO ───
 *
 * O total desta tabela e o mesmo numero de cadastros que o cartao do topo
 * mostra. Na primeira versao era uma linha por vinculo, e os 15.155 cadastros
 * viravam 16.072 linhas -- os 917 docentes que lecionam em duas escolas
 * apareciam duas vezes. Como planilha da BASE, o numero que tem de fechar e o
 * de gente cadastrada, e nao o de vinculos.
 *
 * GRE, escola, INEP e municipio sao da escola, e quem tem duas leva as duas na
 * mesma celula, separadas por " | ". O filtro de GRE e o de INEP procuram em
 * QUALQUER um dos vinculos da pessoa: quem leciona na 1ª e na 3ª aparece na
 * busca das duas, uma vez em cada.
 */

/**
 * As colunas que a planilha oferece.
 *
 * Whitelist, e nao texto vindo da tela: a coluna escolhida entra no SELECT, e
 * aceitar nome livre ali seria deixar o cliente escrever SQL. O que nao estiver
 * nesta lista simplesmente nao existe.
 *
 * `sensivel` marca o que so sai completo no arquivo baixado -- na tela o CPF vai
 * mascarado, como no resto do sistema.
 */
const COLUNAS = {
  nome: { titulo: 'Nome', sql: 'c.name', ordenavel: true },
  cpf: { titulo: 'CPF', sql: 'c.cpf', sensivel: true },
  email: { titulo: 'E-mail', sql: 'COALESCE(NULLIF(c.email_institucional, ""), c.email_pessoal)' },
  telefone: { titulo: 'Telefone', sql: 'c.phone' },
  funcao: { titulo: 'Função', sql: 'c.funcao' },
  componente: { titulo: 'Componente curricular', sql: 'c.componente_curricular' },
  /* Os quatro campos da escola vem agregados, um por vinculo. DISTINCT na GRE e
     no municipio porque duas escolas da mesma regional repetiriam o rotulo; na
     escola e no INEP nao, porque ali a repeticao seria erro de cadastro e deve
     aparecer. */
  gre: {
    titulo: 'GRE',
    sql: `(SELECT GROUP_CONCAT(DISTINCT v.gre ORDER BY v.gre SEPARATOR ' | ')
             FROM cursista_vinculos v WHERE v.cursista_id = c.id AND v.gre IS NOT NULL AND v.gre <> '')`,
  },
  escola: {
    titulo: 'Escola',
    sql: `(SELECT GROUP_CONCAT(v.escola ORDER BY v.ordem SEPARATOR ' | ')
             FROM cursista_vinculos v WHERE v.cursista_id = c.id AND v.escola IS NOT NULL AND v.escola <> '')`,
  },
  inep: {
    titulo: 'INEP',
    sql: `(SELECT GROUP_CONCAT(v.inep ORDER BY v.ordem SEPARATOR ' | ')
             FROM cursista_vinculos v WHERE v.cursista_id = c.id AND v.inep IS NOT NULL AND v.inep <> '')`,
  },
  municipio: {
    titulo: 'Município',
    sql: `(SELECT GROUP_CONCAT(DISTINCT em.municipio ORDER BY em.municipio SEPARATOR ' | ')
             FROM cursista_vinculos v
             JOIN escola_municipio em ON em.inep = v.inep
            WHERE v.cursista_id = c.id)`,
  },
  vinculos: {
    titulo: 'Vínculos',
    sql: '(SELECT COUNT(*) FROM cursista_vinculos v WHERE v.cursista_id = c.id)',
  },
  situacao: {
    titulo: 'Situação do cadastro',
    sql: `CASE WHEN c.status = 'inativo' THEN 'Inativo'
               WHEN c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1 THEN 'Confirmado'
               WHEN c.password_hash IS NOT NULL THEN 'Senha criada'
               ELSE 'Nunca acessou' END`,
  },
  ultimoAcesso: { titulo: 'Último acesso', sql: 'c.last_access_at', data: true },
  /**
   * Inscrito e outra coisa que cadastro confirmado.
   *
   * Confirmar o cadastro e dizer "sou eu, criei minha senha"; inscrever-se e
   * entrar num curso. Da para ter um sem o outro nos dois sentidos, e as duas
   * perguntas que a coordenacao faz -- "quem ainda nao confirmou?" e "quem
   * confirmou mas nao se inscreveu em nada?" -- precisam das duas colunas
   * separadas para serem respondidas.
   *
   * Inscricao cancelada nao conta como inscrito: quem desistiu esta na mesma
   * situacao de quem nunca entrou, do ponto de vista de quem vai atras.
   */
  inscrito: {
    titulo: 'Inscrito em curso',
    sql: `IF(EXISTS (SELECT 1 FROM inscricoes i
                      WHERE i.cursista_id = c.id AND i.status = 'inscrito'), 'Sim', 'Não')`,
  },
  inscricoes: {
    titulo: 'Cursos inscritos',
    sql: '(SELECT COUNT(*) FROM inscricoes i WHERE i.cursista_id = c.id AND i.status = "inscrito")',
  },
  cursos: {
    titulo: 'Quais cursos',
    // Uma linha por cursista pode ter varios cursos; vem em uma celula so,
    // separados por virgula, porque a planilha e para leitura humana.
    sql: `(SELECT GROUP_CONCAT(cu.name ORDER BY cu.name SEPARATOR ', ')
             FROM inscricoes i JOIN courses cu ON cu.id = i.course_id
            WHERE i.cursista_id = c.id AND i.status = 'inscrito')`,
  },
  cadastradoEm: { titulo: 'Cadastrado em', sql: 'c.created_at', data: true },
}

/** As colunas que a tela mostra quando ninguem escolheu nada. */
const PADRAO = ['nome', 'cpf', 'gre', 'escola', 'inep', 'situacao', 'inscrito']

/** O recorte por inscricao, que convive com o da situacao do cadastro. */
const INSCRICAO = {
  inscrito: " AND EXISTS (SELECT 1 FROM inscricoes i WHERE i.cursista_id = c.id AND i.status = 'inscrito')",
  nao_inscrito: " AND NOT EXISTS (SELECT 1 FROM inscricoes i WHERE i.cursista_id = c.id AND i.status = 'inscrito')",
}

const SITUACOES = {
  confirmado: " AND c.status = 'ativo' AND c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1",
  senha_criada: " AND c.status = 'ativo' AND c.password_hash IS NOT NULL AND c.cadastro_confirmado = 0",
  nunca_acessou: " AND c.status = 'ativo' AND c.password_hash IS NULL",
  inativo: " AND c.status = 'inativo'",
}

const numero = (valor) => Number(valor || 0)

/** CPF na tela: os seis do meio escondidos, como nas demais listas do sistema. */
const mascarar = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : d
}

const cpfComPontos = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d
}

/** DATETIME como texto local; toISOString jogaria a noite para o dia seguinte. */
function momento(valor) {
  if (!valor) return ''
  const d = new Date(valor)
  const dois = (n) => String(n).padStart(2, '0')
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`
}

/** Só o que existe na whitelist, na ordem em que a tela pediu, nome sempre. */
function normalizarColunas(pedidas) {
  const lista = (Array.isArray(pedidas) ? pedidas : String(pedidas || '').split(','))
    .map((c) => String(c).trim())
    .filter((c) => Object.prototype.hasOwnProperty.call(COLUNAS, c))
  const unicas = [...new Set(lista.length ? lista : PADRAO)]
  // Sem o nome, a linha vira um punhado de atributos sem dono -- e nao da para
  // conferir nada no arquivo baixado.
  return unicas.includes('nome') ? unicas : ['nome', ...unicas]
}

/**
 * Monta o WHERE a partir dos filtros da tela.
 *
 * O nome usa curinga dos dois lados de proposito: quem digita "SILVA" quer
 * qualquer Silva, e nao so quem se chama Silva de primeiro nome. Custa um
 * varredura na tabela, e por isso a busca so entra com tres caracteres -- uma
 * letra so varreria a base inteira a cada tecla.
 */
function montarFiltro({ gre, inep, nome, situacao, inscricao, curso }) {
  const onde = []
  const params = []

  /* EXISTS, e nao JOIN: com JOIN, quem tem duas escolas na regional procurada
     voltaria duas vezes, e o total da tela deixaria de ser o de cadastros --
     que e justamente o que esta tabela precisa fechar. */
  if (gre) {
    onde.push(' AND EXISTS (SELECT 1 FROM cursista_vinculos v WHERE v.cursista_id = c.id AND v.gre = ?)')
    params.push(gre)
  }
  if (inep) {
    onde.push(' AND EXISTS (SELECT 1 FROM cursista_vinculos v WHERE v.cursista_id = c.id AND v.inep = ?)')
    params.push(String(inep).replace(/\D/g, ''))
  }

  const termo = String(nome || '').trim()
  if (termo.length >= 3) {
    const digitos = termo.replace(/\D/g, '')
    if (digitos.length >= 3) {
      onde.push(' AND (c.name LIKE ? OR c.cpf LIKE ?)')
      params.push(`%${termo}%`, `${digitos}%`)
    } else {
      onde.push(' AND c.name LIKE ?')
      params.push(`%${termo}%`)
    }
  }

  if (SITUACOES[situacao]) onde.push(SITUACOES[situacao])
  if (INSCRICAO[inscricao]) onde.push(INSCRICAO[inscricao])

  /* O curso escolhido la em cima, no filtro do painel.
     Sem isto a tabela continuava mostrando a base inteira enquanto o resto da
     tela ja estava recortado -- e quem lia as duas coisas juntas concluia que
     os cartoes estavam errados. Mesmo EXISTS das demais consultas: quem tem
     dois vinculos de escola nao vira duas linhas. */
  if (curso) {
    onde.push(` AND EXISTS (SELECT 1 FROM inscricoes i
                             WHERE i.cursista_id = c.id AND i.course_id = ?
                               AND i.status = 'inscrito')`)
    params.push(curso)
  }

  return { sql: onde.join(''), params }
}

/* Sem JOIN com os vinculos: eles entram por subconsulta, coluna a coluna. O
   JOIN multiplicava a linha da pessoa pelo numero de escolas dela. */
const DE = 'FROM cursistas c'

/** A planilha na tela: uma pagina de linhas mais o total do recorte. */
async function consultar({
  gre = null, inep = null, nome = '', situacao = null, inscricao = null, curso = null,
  colunas = null, pagina = 1, porPagina = 25,
} = {}) {
  requireMysql()
  const escolhidas = normalizarColunas(colunas)
  const f = montarFiltro({ gre, inep, nome, situacao, inscricao, curso })
  const limite = Math.min(200, Math.max(5, Number(porPagina) || 25))
  const salto = Math.max(0, ((Number(pagina) || 1) - 1) * limite)

  const [[cont]] = await getPool().query(
    `SELECT COUNT(*) AS total ${DE} WHERE 1 = 1${f.sql}`, f.params
  )

  const selecao = escolhidas.map((c) => `${COLUNAS[c].sql} AS \`${c}\``).join(', ')
  const [linhas] = await getPool().query(
    `SELECT ${selecao} ${DE}
      WHERE 1 = 1${f.sql}
      ORDER BY c.name, c.id
      LIMIT ${limite} OFFSET ${salto}`, f.params
  )

  return {
    total: numero(cont.total),
    pagina: Number(pagina) || 1,
    porPagina: limite,
    colunas: escolhidas.map((c) => ({ chave: c, titulo: COLUNAS[c].titulo })),
    itens: linhas.map((l) => {
      const linha = {}
      escolhidas.forEach((c) => {
        const bruto = l[c]
        if (c === 'cpf') linha[c] = mascarar(bruto)
        else if (COLUNAS[c].data) linha[c] = momento(bruto)
        else linha[c] = bruto === null || bruto === undefined ? '' : String(bruto)
      })
      return linha
    }),
  }
}

/**
 * O mesmo recorte inteiro, para o arquivo.
 *
 * Aqui o CPF sai completo: a planilha existe para cruzar com outros sistemas, e
 * CPF pela metade nao cruza com nada. Baixar e uma acao deliberada de quem ja
 * passou pelo login e pelo perfil, e ela fica registrada na auditoria.
 *
 * O teto de 50 mil linhas e protecao de memoria: a base tem treze mil pessoas
 * hoje, e o limite existe para o dia em que alguem pedir a base inteira de um
 * sistema tres vezes maior numa VPS de 957 MB.
 */
async function paraExportar({
  gre = null, inep = null, nome = '', situacao = null, inscricao = null, curso = null,
  colunas = null,
} = {}) {
  requireMysql()
  const escolhidas = normalizarColunas(colunas)
  const f = montarFiltro({ gre, inep, nome, situacao, inscricao, curso })

  const selecao = escolhidas.map((c) => `${COLUNAS[c].sql} AS \`${c}\``).join(', ')
  const [linhas] = await getPool().query(
    `SELECT ${selecao} ${DE}
      WHERE 1 = 1${f.sql}
      ORDER BY c.name, c.id
      LIMIT 50000`, f.params
  )

  return {
    colunas: escolhidas.map((c) => ({
      chave: c,
      titulo: COLUNAS[c].titulo,
      valor: (l) => {
        const bruto = l[c]
        if (c === 'cpf') return cpfComPontos(bruto)
        if (COLUNAS[c].data) return momento(bruto)
        return bruto === null || bruto === undefined ? '' : String(bruto)
      },
    })),
    linhas,
  }
}

/** O catalogo de colunas e de situacoes, para a tela montar os controles. */
function opcoes() {
  return {
    colunas: Object.entries(COLUNAS).map(([chave, c]) => ({
      chave, titulo: c.titulo, padrao: PADRAO.includes(chave),
    })),
    situacoes: [
      { chave: 'confirmado', rotulo: 'Cadastro confirmado' },
      { chave: 'senha_criada', rotulo: 'Criou senha, não confirmou' },
      { chave: 'nunca_acessou', rotulo: 'Nunca acessou' },
      { chave: 'inativo', rotulo: 'Inativo' },
    ],
    inscricoes: [
      { chave: 'inscrito', rotulo: 'Inscrito em algum curso' },
      { chave: 'nao_inscrito', rotulo: 'Sem inscrição' },
    ],
  }
}

module.exports = { consultar, paraExportar, opcoes, COLUNAS, PADRAO }
