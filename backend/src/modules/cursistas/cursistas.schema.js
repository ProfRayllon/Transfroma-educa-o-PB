'use strict'

const { getPool, isMysqlMode } = require('../../shared/db')

/**
 * Ajustes de esquema do modulo, aplicados no boot.
 *
 * As tabelas nascem da migracao 2026_08_19_add_cursistas.sql, rodada a mao uma
 * vez. Coluna nova depois disso segue o mesmo padrao do resto do sistema
 * (ver ensureMysqlSchema em data/store.js): confere o INFORMATION_SCHEMA e
 * adiciona se faltar. Assim o deploy nao depende de alguem lembrar de rodar SQL
 * no servidor -- esquecer seria a API subir e quebrar na primeira consulta.
 */
async function garantirEsquema() {
  if (!isMysqlMode()) return

  const pool = getPool()

  // Instalacao onde a migracao ainda nao rodou: nao ha o que ajustar, e tentar
  // o ALTER daria erro no boot.
  const [[tabela]] = await pool.query(
    `SELECT COUNT(*) AS existe
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cursistas'`
  )
  if (!Number(tabela.existe)) return

  const [colunas] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'cursistas'
        AND COLUMN_NAME IN ('origem')`
  )
  const existentes = new Set(colunas.map((coluna) => coluna.COLUMN_NAME))

  /**
   * Como o cadastro entrou no sistema.
   *
   * O padrao e 'importado' porque toda linha que existe hoje veio da planilha
   * oficial. Serve para a coordenacao separar o que ela mesma criou a mao do
   * que veio da base -- sem isso, achar e desfazer um cadastro de teste no meio
   * de treze mil e procurar agulha no palheiro.
   *
   * A importacao nao altera este valor em quem ja existe: ele registra como o
   * registro NASCEU, e nao a ultima vez que foi tocado.
   */
  if (!existentes.has('origem')) {
    await pool.execute(
      "ALTER TABLE cursistas ADD COLUMN origem ENUM('importado','manual') NOT NULL DEFAULT 'importado' AFTER status"
    )
  }
}

module.exports = { garantirEsquema }
