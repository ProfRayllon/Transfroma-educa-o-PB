const app = require('./src/app')
const { initStore } = require('./src/data/store')
const { garantirEsquema: garantirEsquemaCursistas } = require('./src/modules/cursistas/cursistas.schema')

const PORT = process.env.PORT || 3001

async function start() {
  await initStore()
  // Depois do initStore: e ele quem cria a pool que o modulo usa.
  await garantirEsquemaCursistas()

  app.listen(PORT, () => {
    console.log(`\nTransforma API rodando em http://localhost:${PORT}`)
    console.log(`Health check: http://localhost:${PORT}/api/health\n`)
  })
}

start().catch((error) => {
  console.error('Falha ao inicializar a API:', error)
  process.exit(1)
})
