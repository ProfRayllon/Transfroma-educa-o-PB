const cluster = require('node:cluster')
const os = require('node:os')

const PORT = process.env.PORT || 3001

/**
 * Quantos processos atendem requisicao.
 *
 * O gargalo do sistema e CPU, nao banco: bcrypt custa 147ms para gravar uma
 * senha e 123ms para conferir uma, medidos na propria VPS. JavaScript roda em
 * uma thread so, entao UM processo atende no maximo ~8 logins por segundo, por
 * mais folgado que o banco esteja (ele tem 14 MB e cabe inteiro no cache do
 * MySQL). A maquina tem 2 nucleos e um deles ficava parado.
 *
 * O teto e o numero de nucleos -- alem disso os processos disputam CPU entre si
 * e so acrescentam consumo de memoria, ~69 MB cada.
 */
const PROCESSOS = Math.max(
  1,
  Math.min(Number(process.env.WEB_CONCURRENCY) || os.cpus().length, os.cpus().length)
)

async function iniciarTrabalhador() {
  const app = require('./src/app')
  const { initStore } = require('./src/data/store')
  const { garantirEsquema: garantirEsquemaCursistas } = require('./src/modules/cursistas/cursistas.schema')

  await initStore()
  // Depois do initStore: e ele quem cria a pool que o modulo usa.
  await garantirEsquemaCursistas()

  app.listen(PORT, () => {
    const quem = cluster.isPrimary ? 'processo unico' : `processo ${process.pid}`
    console.log(`\nTransforma API rodando em http://localhost:${PORT} (${quem})`)
  })

  // Avisa o primario que o esquema ja foi conferido e a porta esta aberta.
  if (process.send) process.send('pronto')
}

/**
 * Sobe os trabalhadores UM DE CADA VEZ, esperando o primeiro anunciar que subiu.
 *
 * Nao e zelo: o boot roda ajustes de esquema (`ALTER TABLE users MODIFY role
 * ENUM(...)` e a coluna `origem` dos cursistas). Dois processos fazendo isso ao
 * mesmo tempo disputam a mesma tabela -- os dois leem "coluna ausente", os dois
 * tentam criar, e o segundo morre com "Duplicate column name". Como o Docker
 * reinicia o container, isso viraria um laco de reinicializacao.
 *
 * Em fila, o primeiro aplica o que faltava e o segundo encontra tudo pronto.
 */
function iniciarPrimario() {
  console.log(`Transforma API: ${PROCESSOS} processo(s) em ${os.cpus().length} nucleo(s)`)

  let subindo = null

  const proximo = () => {
    if (cluster.workers && Object.keys(cluster.workers).length >= PROCESSOS) return
    subindo = cluster.fork()
    subindo.once('message', (msg) => {
      if (msg !== 'pronto') return
      subindo = null
      proximo()
    })
    // Se o primeiro nao anunciar em 60s, segue mesmo assim: melhor um processo
    // atendendo com o outro atrasado do que a API inteira parada esperando.
    setTimeout(() => { if (subindo) { subindo = null; proximo() } }, 60_000).unref()
  }

  proximo()

  // Trabalhador que morre e reposto, senao uma falha isolada reduziria a
  // capacidade pela metade ate alguem perceber.
  cluster.on('exit', (worker, code, signal) => {
    console.error(`[cluster] processo ${worker.process.pid} saiu (code=${code} signal=${signal}); repondo`)
    setTimeout(proximo, 1000).unref()
  })
}

if (PROCESSOS > 1 && cluster.isPrimary) {
  iniciarPrimario()
} else {
  iniciarTrabalhador().catch((error) => {
    console.error('Falha ao inicializar a API:', error)
    process.exit(1)
  })
}
