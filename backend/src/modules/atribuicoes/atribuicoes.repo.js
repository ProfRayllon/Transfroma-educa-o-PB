'use strict'

const { getPool, requireMysql } = require('../../shared/db')

/**
 * A situacao mostrada na tela e DERIVADA, nunca gravada.
 *
 * Guardar um status junto dos dois eixos permitiria que ele divergisse deles --
 * uma linha marcada "concluido" com o check-in vazio, por exemplo. Como sai
 * daqui, os tres lugares que exibem uma atribuicao (a lista da pessoa, a fila do
 * avaliador e o acompanhamento) leem sempre a mesma regra.
 */
function situacaoDe(row) {
  if (row.avaliacao) return row.avaliacao
  if (row.checkin_em) return 'aguardando_avaliacao'
  return 'a_fazer'
}

const dataHora = (valor) => (valor ? new Date(valor).toISOString() : null)

/**
 * DATE do MySQL para "AAAA-MM-DD", lendo o calendario local.
 *
 * O driver entrega um DATE como meia-noite no fuso do processo. Converter isso
 * para ISO (UTC) devolveria o dia anterior sempre que o processo rodar em um
 * fuso a leste de Greenwich -- o prazo "31/08" viraria "30/08" e a atividade
 * apareceria fora do mes em que foi atribuida. Montar a partir dos componentes
 * locais e o que faz a data significar o mesmo dia que esta gravado no banco,
 * independente de onde a API roda.
 */
function data(valor) {
  if (!valor) return null
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mapAtribuicao(row) {
  if (!row) return null

  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao || null,
    mesReferencia: row.mes_referencia,
    prazo: data(row.prazo),

    responsavel: {
      id: row.responsavel_id,
      name: row.responsavel_nome,
      email: row.responsavel_email,
      role: row.responsavel_role,
    },
    avaliador: {
      id: row.avaliador_id,
      name: row.avaliador_nome,
      role: row.avaliador_role,
    },
    // O cargo vem junto do nome em toda pessoa que a tela mostra: "por Carla
    // Mendes" nao diz se quem atribuiu foi a coordenacao ou a supervisao, e e
    // isso que decide a quem recorrer quando a atividade nao esta clara.
    criadoPor: row.criado_por
      ? { id: row.criado_por, name: row.criador_nome, role: row.criador_role }
      : null,
    // Primeira etapa da linha do tempo da tela: quando a atividade nasceu.
    criadoEm: dataHora(row.created_at),

    checkinEm: dataHora(row.checkin_em),
    checkinObs: row.checkin_obs || null,
    avaliacao: row.avaliacao || null,
    avaliacaoObs: row.avaliacao_obs || null,
    avaliadoEm: dataHora(row.avaliado_em),

    situacao: situacaoDe(row),
  }
}

/**
 * Os nomes de responsavel, avaliador e criador vem por JOIN em toda leitura --
 * nenhuma tela mostra uma atribuicao sem dizer de quem ela e e quem julga.
 *
 * `avatar` fica de fora de proposito: a coluna e MEDIUMTEXT com a imagem inteira
 * em base64, e trazer isso em uma lista de dezenas de linhas pesaria mais que
 * todo o resto da resposta somado. As telas usam as iniciais do nome.
 */
const SELECT_BASE = `
  SELECT a.*,
         r.name AS responsavel_nome, r.email AS responsavel_email, r.role AS responsavel_role,
         v.name AS avaliador_nome, v.role AS avaliador_role,
         c.name AS criador_nome, c.role AS criador_role
    FROM atribuicoes a
    JOIN users r ON r.id = a.responsavel_id
    JOIN users v ON v.id = a.avaliador_id
    LEFT JOIN users c ON c.id = a.criado_por
`

/**
 * Uma consulta so para as tres telas: o que muda entre elas e o filtro.
 *
 * A ordenacao coloca o que ainda nao foi avaliado em cima -- na fila do
 * avaliador isso e o trabalho pendente, e na lista da pessoa e o que ela ainda
 * precisa fazer. Dentro disso, prazo mais proximo primeiro; sem prazo por
 * ultimo, porque "ate o fim do mes" e sempre menos urgente que uma data.
 */
async function listar({ mes, responsavelId, avaliadorId, roles } = {}) {
  requireMysql()

  const filtros = []
  const params = []

  if (mes) { filtros.push('a.mes_referencia = ?'); params.push(mes) }
  if (responsavelId) { filtros.push('a.responsavel_id = ?'); params.push(responsavelId) }
  if (avaliadorId) { filtros.push('a.avaliador_id = ?'); params.push(avaliadorId) }
  if (roles?.length) {
    filtros.push(`r.role IN (${roles.map(() => '?').join(', ')})`)
    params.push(...roles)
  }

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''
  const [rows] = await getPool().execute(
    `${SELECT_BASE} ${where}
     ORDER BY (a.avaliacao IS NOT NULL), (a.prazo IS NULL), a.prazo, r.name, a.id`,
    params
  )
  return rows.map(mapAtribuicao)
}

async function porId(id) {
  requireMysql()
  const [rows] = await getPool().execute(`${SELECT_BASE} WHERE a.id = ? LIMIT 1`, [id])
  return rows[0] ? mapAtribuicao(rows[0]) : null
}

/**
 * Grava uma linha por responsavel, em uma transacao.
 *
 * Ou a atribuicao vale para todos os escolhidos ou para nenhum: um erro no meio
 * do laco deixaria metade da equipe com a atividade e metade sem, e a diferenca
 * so apareceria no relatorio do fim do mes.
 */
async function criarParaVarios({ titulo, descricao, responsavelIds, avaliadorId, criadoPor, mesReferencia, prazo }) {
  requireMysql()

  const conexao = await getPool().getConnection()
  try {
    await conexao.beginTransaction()
    const ids = []
    for (const responsavelId of responsavelIds) {
      const [resultado] = await conexao.execute(
        `INSERT INTO atribuicoes (titulo, descricao, responsavel_id, avaliador_id, criado_por, mes_referencia, prazo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [titulo, descricao, responsavelId, avaliadorId, criadoPor, mesReferencia, prazo]
      )
      ids.push(resultado.insertId)
    }
    await conexao.commit()
    return ids
  } catch (error) {
    await conexao.rollback()
    throw error
  } finally {
    conexao.release()
  }
}

/**
 * Check-in do responsavel. `feito = false` desfaz.
 *
 * Desfazer tambem limpa a avaliacao: se a pessoa recolhe o "fiz", o veredito que
 * o avaliador deu sobre aquele fato deixa de valer, e manter os dois seria
 * exibir "cumprido" em algo que ninguem afirma ter feito.
 */
async function marcarCheckin(id, { feito, observacao }) {
  requireMysql()

  if (feito) {
    await getPool().execute(
      'UPDATE atribuicoes SET checkin_em = NOW(), checkin_obs = ? WHERE id = ?',
      [observacao || null, id]
    )
  } else {
    await getPool().execute(
      `UPDATE atribuicoes
          SET checkin_em = NULL, checkin_obs = NULL,
              avaliacao = NULL, avaliacao_obs = NULL, avaliado_em = NULL
        WHERE id = ?`,
      [id]
    )
  }
  return porId(id)
}

/** Veredito do avaliador. `avaliacao = null` devolve o item para a fila. */
async function avaliar(id, { avaliacao, observacao }) {
  requireMysql()

  await getPool().execute(
    `UPDATE atribuicoes
        SET avaliacao = ?, avaliacao_obs = ?, avaliado_em = ${avaliacao ? 'NOW()' : 'NULL'}
      WHERE id = ?`,
    [avaliacao, observacao || null, id]
  )
  return porId(id)
}

async function atualizar(id, campos) {
  requireMysql()

  const colunas = {
    titulo: 'titulo',
    descricao: 'descricao',
    prazo: 'prazo',
    avaliadorId: 'avaliador_id',
  }

  const sets = []
  const params = []
  for (const [campo, coluna] of Object.entries(colunas)) {
    if (campos[campo] === undefined) continue
    sets.push(`${coluna} = ?`)
    params.push(campos[campo])
  }
  if (sets.length === 0) return porId(id)

  params.push(id)
  await getPool().execute(`UPDATE atribuicoes SET ${sets.join(', ')} WHERE id = ?`, params)
  return porId(id)
}

async function excluir(id) {
  requireMysql()
  await getPool().execute('DELETE FROM atribuicoes WHERE id = ?', [id])
}

/**
 * Quantas atribuicoes esperam o veredito deste avaliador -- alimenta o contador
 * do menu. Sem recorte de mes de proposito: uma pendencia do mes passado nao
 * deixa de ser pendencia porque a pagina virou.
 */
async function contarPendentesDoAvaliador(avaliadorId) {
  requireMysql()
  const [[linha]] = await getPool().execute(
    'SELECT COUNT(*) AS total FROM atribuicoes WHERE avaliador_id = ? AND checkin_em IS NOT NULL AND avaliacao IS NULL',
    [avaliadorId]
  )
  return Number(linha.total)
}

/**
 * Se a pessoa avalia alguma coisa, em qualquer mes.
 *
 * E o que decide se a aba "Para avaliar" existe para ela. Usar o contador de
 * pendencias no lugar disto faria a aba sumir assim que o ultimo item fosse
 * avaliado -- e com ela o historico do que a pessoa acabou de julgar.
 */
async function ehAvaliadorDeAlgo(avaliadorId) {
  requireMysql()
  const [[linha]] = await getPool().execute(
    'SELECT EXISTS(SELECT 1 FROM atribuicoes WHERE avaliador_id = ?) AS tem',
    [avaliadorId]
  )
  return Boolean(Number(linha.tem))
}

module.exports = {
  listar,
  porId,
  criarParaVarios,
  marcarCheckin,
  avaliar,
  atualizar,
  excluir,
  contarPendentesDoAvaliador,
  ehAvaliadorDeAlgo,
}
