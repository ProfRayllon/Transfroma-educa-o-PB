'use strict'

const express = require('express')
const repo = require('./painel.repo')

/**
 * O painel institucional, numa chamada so.
 *
 * Sao onze consultas agregadas. Vem todas juntas porque o painel e um deck que
 * troca de cena a cada poucos segundos: buscar cena a cena faria cada virada
 * esperar a rede, e no modo automatico a tela piscaria a cada rotacao. Buscar
 * tudo de uma vez tambem garante que os numeros das cenas sejam do MESMO
 * instante -- um total de cursistas na cena 1 que nao fecha com a soma das GREs
 * na cena 2 destroi a confianca de quem esta assistindo.
 *
 * As consultas rodam em paralelo: sao independentes entre si e o pool aguenta.
 */

const PERFIS_COM_ACESSO = ['administrador', 'gerencia']

// Cache curto em memoria, por combinacao de filtros. O dashboard fica aberto e
// se atualiza; sem isso, cada atualizacao bateria as onze consultas de novo para
// devolver numeros que mudam em escala de horas.
//
// O limite existe porque a chave inclui o curso: sem ele, uma sessao clicando em
// curso por curso faria o cache crescer sem fim dentro do processo.
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

const DIAS_ACEITOS = [7, 15, 30]

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function normalizarMes(valor) {
  return /^\d{4}-\d{2}$/.test(String(valor || '')) ? valor : mesAtual()
}

function normalizarDias(valor) {
  const n = Number(valor)
  return DIAS_ACEITOS.includes(n) ? n : 30
}

// Curso invalido vira "sem filtro", e nao erro: o dashboard e uma tela de
// leitura, e derrubar o painel inteiro porque um id veio torto seria pior do
// que mostrar o retrato geral.
function normalizarCurso(valor) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

module.exports = function criarRotasPainel({ authInterna, requireRole }) {
  const router = express.Router()
  router.use(authInterna)

  router.get('/', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const mes = normalizarMes(req.query.mes)
      const dias = normalizarDias(req.query.dias)
      const cursoId = normalizarCurso(req.query.curso)
      const chave = `${mes}|${dias}|${cursoId || 0}`

      const guardado = doCache(chave)
      if (guardado) return res.json({ ...guardado, doCache: true })

      const [
        totais, porGre, escolas, funil, perfil,
        inscricoes, serie, porHora, equipe, producao, frequencia,
      ] = await Promise.all([
        repo.totais({ cursoId, dias }),
        repo.porGre({ cursoId }),
        repo.escolasComMaisCursistas({ cursoId }),
        repo.funil(),
        repo.perfilDaRede({ cursoId }),
        repo.inscricoesPorCurso(),
        repo.serie({ cursoId, dias }),
        repo.acessosPorHora({ dias }),
        repo.equipe(),
        repo.producao(),
        repo.frequenciaDaEquipe(mes),
      ])

      const dados = {
        geradoEm: new Date().toISOString(),
        mes,
        dias,
        // Devolvido de volta para a tela nao precisar confiar no proprio estado:
        // se o servidor recusou o filtro, o rotulo mostra o que ele realmente usou.
        cursoId,
        institucional: {
          totais, porGre, escolas, funil, perfil, inscricoes, serie, porHora,
        },
        operacional: { equipe, producao, frequencia },
      }

      guardar(chave, dados)
      res.json(dados)
    } catch (erro) {
      // A mensagem do 503 e informativa (falta MySQL) e passa; qualquer outra
      // vira texto generico, para detalhe de banco nao vazar para a tela.
      const status = erro.status || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel montar o dashboard.',
      })
    }
  })

  return router
}
