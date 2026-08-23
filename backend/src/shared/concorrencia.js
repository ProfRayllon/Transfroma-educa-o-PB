'use strict'

const os = require('node:os')

/**
 * Quantos processos da API atendem requisicao, e o que isso faz com os limites.
 *
 * A API roda em cluster porque o gargalo e CPU: bcrypt custa ~147ms para gravar
 * uma senha, medido na VPS, e JavaScript roda numa thread so. Com um processo, o
 * teto e ~8 logins por segundo, por mais folgado que o banco esteja.
 *
 * O efeito colateral e nos limitadores de tentativa. `express-rate-limit` guarda
 * a contagem na memoria do processo, entao cada um conta os seus: um cliente que
 * alterna entre processos consegue N vezes o limite. Sem tratar isso, o freio
 * contra varredura da base de CPFs perderia forca proporcional ao numero de
 * processos, silenciosamente.
 *
 * Por isso as rotas declaram o total PRETENDIDO e chamam `porProcesso`. O numero
 * no codigo continua sendo o que se quer de verdade, e mudar WEB_CONCURRENCY
 * nao desregula nada.
 *
 * Vale lembrar o que NAO depende disto: o bloqueio por conta vive em
 * `locked_until` e `failed_attempts` no banco. Sendo estado compartilhado, ele
 * nao se multiplica com o numero de processos.
 */
const PROCESSOS_WEB = Math.max(
  1,
  Math.min(Number(process.env.WEB_CONCURRENCY) || os.cpus().length, os.cpus().length)
)

/** Limite de cada processo para um total pretendido no conjunto. */
const porProcesso = (total) => Math.max(1, Math.floor(total / PROCESSOS_WEB))

module.exports = { PROCESSOS_WEB, porProcesso }
