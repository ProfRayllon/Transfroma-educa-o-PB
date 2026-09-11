'use strict'

/**
 * Cache curto em memoria do dashboard, por combinacao de filtros.
 *
 * O dashboard fica aberto e se atualiza; sem isso, cada atualizacao bateria as
 * consultas de novo para devolver numeros que mudam em escala de horas.
 *
 * O limite existe porque a chave inclui curso, regional e componente: sem ele,
 * uma sessao clicando em filtro por filtro faria o cache crescer sem fim dentro
 * do processo.
 *
 * Mora em arquivo proprio para que o envio de planilhas possa limpa-lo. Sem
 * isso, quem acabou de enviar o consolidado abriria o painel e veria os numeros
 * de antes por ate um minuto -- e concluiria que o envio nao funcionou.
 *
 * Limitacao conhecida: o cache e de cada processo. Com mais de um processo
 * rodando, limpar aqui so limpa o processo que atendeu o envio; os outros
 * expiram sozinhos em ate CACHE_MS.
 */

const CACHE_MS = 60 * 1000
const CACHE_MAX = 24
const cache = new Map()

function doCache(chave) {
  const item = cache.get(chave)
  if (!item) return null
  if (Date.now() - item.em > CACHE_MS) { cache.delete(chave); return null }
  return item.dados
}

function guardar(chave, dados) {
  // Map preserva a ordem de insercao: a primeira chave e a mais antiga.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(chave, { em: Date.now(), dados })
}

function limparCache() {
  cache.clear()
}

module.exports = { doCache, guardar, limparCache, CACHE_MS }
