'use strict'

const { getPool } = require('../../shared/db')

/**
 * O arquivo original de cada planilha em uso, para quem quiser baixa-lo.
 *
 * A importacao le a planilha e guarda os dados, nao o arquivo -- e sem ele nao
 * ha como conferir de onde veio um numero, nem mostrar a quem vai montar a
 * proxima planilha o formato que o sistema aceita.
 *
 * Guarda SO o mais recente de cada planilha (curso + tipo, ou a de municipios):
 * e o que "esta sendo utilizada". Guardar todas as semanas encheria a VPS de
 * arquivos de 5 MB com CPF dentro, para um uso que ninguem pediu.
 */

/** A chave da planilha: "consolidado:12", "avaliacao:12" ou "municipios". */
function chaveDe(tipo, cursoId) {
  return tipo === 'municipios' ? 'municipios' : `${tipo}:${Number(cursoId)}`
}

async function garantirTabela(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resultado_arquivos (
      chave VARCHAR(40) PRIMARY KEY,
      referencia DATE DEFAULT NULL,
      nome VARCHAR(255) NOT NULL,
      tamanho INT NOT NULL,
      conteudo LONGBLOB NOT NULL,
      enviado_por VARCHAR(150) DEFAULT NULL,
      enviado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `)
}

/**
 * Guarda o arquivo, a menos que ja exista um de data de referencia mais nova:
 * reenviar uma semana antiga para corrigi-la nao faz dela a planilha em uso.
 */
async function guardar({ tipo, cursoId, referencia, nome, buffer, por }) {
  const chave = chaveDe(tipo, cursoId)
  const ref = tipo === 'municipios' ? null : referencia
  await getPool().query(
    `INSERT INTO resultado_arquivos (chave, referencia, nome, tamanho, conteudo, enviado_por)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nome        = IF(VALUES(referencia) IS NULL OR referencia IS NULL OR VALUES(referencia) >= referencia, VALUES(nome), nome),
       tamanho     = IF(VALUES(referencia) IS NULL OR referencia IS NULL OR VALUES(referencia) >= referencia, VALUES(tamanho), tamanho),
       conteudo    = IF(VALUES(referencia) IS NULL OR referencia IS NULL OR VALUES(referencia) >= referencia, VALUES(conteudo), conteudo),
       enviado_por = IF(VALUES(referencia) IS NULL OR referencia IS NULL OR VALUES(referencia) >= referencia, VALUES(enviado_por), enviado_por),
       referencia  = IF(VALUES(referencia) IS NULL OR referencia IS NULL OR VALUES(referencia) >= referencia, VALUES(referencia), referencia)`,
    [chave, ref, String(nome || 'planilha').slice(0, 255), buffer.length, buffer, String(por || '').slice(0, 150) || null]
  )
}

/** As chaves que tem arquivo guardado, sem carregar o conteudo. */
async function chavesGuardadas() {
  const [linhas] = await getPool().query('SELECT chave FROM resultado_arquivos')
  return new Set(linhas.map((l) => l.chave))
}

async function buscar(tipo, cursoId) {
  const [[linha]] = await getPool().query(
    'SELECT nome, conteudo FROM resultado_arquivos WHERE chave = ?',
    [chaveDe(tipo, cursoId)]
  )
  return linha || null
}

module.exports = { chaveDe, garantirTabela, guardar, chavesGuardadas, buscar }
