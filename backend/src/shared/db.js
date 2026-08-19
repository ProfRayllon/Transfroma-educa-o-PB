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
 * O modulo de cursistas trabalha com importacao em massa, exportacao e trilha de
 * auditoria -- coisas que nao fazem sentido no modo mock e que, duplicadas em
 * memoria, so criariam divergencia com o comportamento real.
 */
function requireMysql() {
  if (!isMysqlMode()) {
    const error = new Error('O modulo de cursistas exige DATA_MODE=mysql.')
    error.statusCode = 503
    throw error
  }
}

module.exports = { getPool, isMysqlMode, requireMysql }
