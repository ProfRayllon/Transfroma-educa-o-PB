const app = require('./src/app')

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`\nTransforma API rodando em http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health\n`)
})
