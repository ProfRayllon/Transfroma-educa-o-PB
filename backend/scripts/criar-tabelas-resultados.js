'use strict'

/**
 * Cria as tabelas de resultado sem subir a API.
 *
 * Serve para a maquina de desenvolvimento e para a primeira vez em producao. Em
 * operacao normal quem faz isso e o boot (server.js), com o mesmo DDL: este
 * script so empresta uma conexao ao mesmo modulo.
 */

require('dotenv').config()
const mysql = require('mysql2/promise')
const { aplicar } = require('../src/modules/resultados/resultados.schema')

;(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })
  await aplicar(conn)
  const [t] = await conn.query(
    `SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('resultado_importacoes','consolidado_vinculos',
                           'consolidado_historico','avaliacao_respostas','escola_municipio')
      ORDER BY TABLE_NAME`
  )
  t.forEach((x) => console.log(`  ${x.TABLE_NAME.padEnd(24)} ok`))
  await conn.end()
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1) })
