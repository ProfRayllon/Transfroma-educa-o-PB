'use strict'

const store = require('../data/store')

/**
 * Acesso ao banco para os modulos novos.
 *
 * O pool e criado e mantido pelo store legado (src/data/store.js), que roda no
 * boot da API. Aqui apenas o reaproveitamos, para nao existir uma segunda pool de
 * conexoes concorrendo com a primeira pelo limite do MySQL.
 */
function getPool() {
  const pool = store.getPool()
  if (!pool) {
    throw new Error('Conexao com o banco nao inicializada.')
  }
  return pool
}

function isMysqlMode() {
  return store.DATA_MODE === 'mysql'
}

/**
 * Modulos novos exigem banco de verdade.
 *
 * Eles trabalham com importacao em massa, exportacao, trilha de auditoria e
 * transacao -- coisas que nao fazem sentido no modo mock e que, reimplementadas
 * em memoria, so criariam divergencia com o comportamento real.
 */
function requireMysql() {
  if (!isMysqlMode()) {
    const error = new Error('Este modulo exige DATA_MODE=mysql. O sistema esta rodando com dados em memoria.')
    error.statusCode = 503
    throw error
  }
}

module.exports = { getPool, isMysqlMode, requireMysql }
