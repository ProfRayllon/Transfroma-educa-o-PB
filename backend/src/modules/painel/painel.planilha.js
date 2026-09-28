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
 * ─── Uma linha por VINCULO ───
 *
 * Quem leciona em duas escolas aparece duas vezes, uma por escola, porque GRE,
 * INEP e escola sao da escola e nao da pessoa. Esconder a segunda linha faria a
 * contagem por regional nao fechar. A tela diz isso no rodape.
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
  gre: { titulo: 'GRE', sql: 'v.gre', ordenavel: true },
  escola: { titulo: 'Escola', sql: 'v.escola', ordenavel: true },
  inep: { titulo: 'INEP', sql: 'v.inep' },
  municipio: { titulo: 'Município', sql: 'em.municipio' },
  situacao: {
    titulo: 'Situação do cadastro',
    sql: `CASE WHEN c.status = 'inativo' THEN 'Inativo'
               WHEN c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1 THEN 'Confirmado'
               WHEN c.password_hash IS NOT NULL THEN 'Senha criada'
               ELSE 'Nunca acessou' END`,
  },
  ultimoAcesso: { titulo: 'Último acesso', sql: 'c.last_access_at', data: true },
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
const PADRAO = ['nome', 'cpf', 'gre', 'escola', 'inep', 'situacao']

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
function montarFiltro({ gre, inep, nome, situacao }) {
  const onde = []
  const params = []

  if (gre) { onde.push(' AND v.gre = ?'); params.push(gre) }
  if (inep) { onde.push(' AND v.inep = ?'); params.push(String(inep).replace(/\D/g, '')) }

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

  return { sql: onde.join(''), params }
}

const DE = `FROM cursistas c
            LEFT JOIN cursista_vinculos v ON v.cursista_id = c.id
            LEFT JOIN escola_municipio em ON em.inep = v.inep`

/** A planilha na tela: uma pagina de linhas mais o total do recorte. */
async function consultar({
  gre = null, inep = null, nome = '', situacao = null,
  colunas = null, pagina = 1, porPagina = 25,
} = {}) {
  requireMysql()
  const escolhidas = normalizarColunas(colunas)
  const f = montarFiltro({ gre, inep, nome, situacao })
  const limite = Math.min(200, Math.max(5, Number(porPagina) || 25))
  const salto = Math.max(0, ((Number(pagina) || 1) - 1) * limite)

  const [[cont]] = await getPool().query(
    `SELECT COUNT(*) AS total ${DE} WHERE 1 = 1${f.sql}`, f.params
  )

  const selecao = escolhidas.map((c) => `${COLUNAS[c].sql} AS \`${c}\``).join(', ')
  const [linhas] = await getPool().query(
    `SELECT ${selecao} ${DE}
      WHERE 1 = 1${f.sql}
      ORDER BY c.name, v.ordem
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
async function paraExportar({ gre = null, inep = null, nome = '', situacao = null, colunas = null } = {}) {
  requireMysql()
  const escolhidas = normalizarColunas(colunas)
  const f = montarFiltro({ gre, inep, nome, situacao })

  const selecao = escolhidas.map((c) => `${COLUNAS[c].sql} AS \`${c}\``).join(', ')
  const [linhas] = await getPool().query(
    `SELECT ${selecao} ${DE}
      WHERE 1 = 1${f.sql}
      ORDER BY c.name, v.ordem
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
  }
}

module.exports = { consultar, paraExportar, opcoes, COLUNAS, PADRAO }
