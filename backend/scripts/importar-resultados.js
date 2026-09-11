'use strict'

/**
 * Importador das planilhas de resultado, pela linha de comando.
 *
 *   node scripts/importar-resultados.js --tipo consolidado --curso 3 \
 *        --arquivo ../../base-cursistas/2-processado/docentes_concluintes_google.xlsx
 *
 *   --tipo        consolidado | avaliacao | municipios
 *   --curso       id do curso no sistema (nao usado em municipios)
 *   --referencia  AAAA-MM-DD, a data da fotografia (padrao: hoje)
 *   --simular     confere sem gravar
 *
 * Aceita .xlsx e .csv. As regras moram em src/modules/resultados/resultados.import.js,
 * as mesmas que a tela de envio do dashboard usa -- este arquivo so le os
 * argumentos e imprime o resultado.
 *
 * O curso e informado a mao, de proposito. A planilha do Google traz
 * "Google for Educacion" na coluna de curso -- com erro de grafia -- e nenhum
 * casamento por nome sobreviveria a isso.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { executar } = require('../src/modules/resultados/resultados.import')

function lerArgumentos(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) throw new Error(`Argumento inesperado: ${argv[i]}`)
    const chave = argv[i].slice(2)
    // --simular nao tem valor; os demais tem.
    if (chave === 'simular') { args.simular = true; continue }
    args[chave] = argv[i + 1]
    i += 1
  }
  return args
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function principal() {
  const args = lerArgumentos(process.argv)
  if (!args.arquivo || !fs.existsSync(args.arquivo)) throw new Error(`Arquivo nao encontrado: ${args.arquivo}`)

  const conexao = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  })

  try {
    const r = await executar({
      conexao,
      tipo: args.tipo,
      cursoId: Number(args.curso) || null,
      referencia: args.referencia || hoje(),
      buffer: fs.readFileSync(args.arquivo),
      arquivo: path.basename(args.arquivo),
      por: 'linha de comando',
      simular: Boolean(args.simular),
    })

    console.log(`\nArquivo:    ${r.arquivo}  (aba "${r.aba}", ${r.linhasLidas} linhas)`)
    if (r.curso) console.log(`Curso:      ${r.curso.id} - ${r.curso.nome}`)
    if (r.referencia) console.log(`Referencia: ${r.referencia}`)
    console.log(`\n${r.gravado ? 'Gravado' : 'SIMULADO -- nada foi gravado'}:`)
    r.resumo.forEach((x) => console.log(`  ${x.rotulo.padEnd(40)} ${x.valor}`))
    if (r.avisos.length) {
      console.log('\nAvisos:')
      r.avisos.forEach((a) => console.log(`  - ${a}`))
    }
    console.log('')
  } finally {
    await conexao.end()
  }
}

principal().catch((erro) => {
  console.error(`\nFALHOU: ${erro.message}\n`)
  process.exit(1)
})
