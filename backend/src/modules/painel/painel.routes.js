'use strict'

const express = require('express')
const repo = require('./painel.repo')
const resultados = require('../resultados/resultados.repo')

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

/**
 * A GRE aceita so o formato que existe no banco.
 *
 * Nao e defesa contra injecao -- o valor vai como parametro ligado de qualquer
 * jeito. E para o texto virar chave de cache: sem o recorte, uma consulta com
 * "1a GRE  " e outra com "1ª GRE" ocupariam duas entradas para o mesmo
 * resultado, e vinte variacoes esvaziariam o cache inteiro.
 */
function normalizarGre(valor) {
  const texto = String(valor || '').trim()
  return /^\d{1,2}ª GRE$/.test(texto) ? texto : null
}

module.exports = function criarRotasPainel({ authInterna, requireRole }) {
  const router = express.Router()
  router.use(authInterna)

  router.get('/', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const mes = normalizarMes(req.query.mes)
      const dias = normalizarDias(req.query.dias)
      const cursoId = normalizarCurso(req.query.curso)
      const gre = normalizarGre(req.query.gre)
      const chave = `${mes}|${dias}|${cursoId || 0}|${gre || '-'}`

      const guardado = doCache(chave)
      if (guardado) return res.json({ ...guardado, doCache: true })

      /* Tres listas sairam daqui e continuam no repo, testadas: `acessosPorHora`,
         `escolasComMaisCursistas` e o bloco operacional (`equipe`, `producao`,
         `frequenciaDaEquipe`). A coordenacao pediu foco no painel institucional,
         e agregar 40 mil linhas de auditoria por hora para ninguem ler e
         trabalho jogado fora. Devolver qualquer uma e uma linha nesta lista mais
         uma no payload. */
      const [
        totais, porGre, funil, perfil, inscricoes, serie,
        conclusao, conclusaoPorGre, avaliacao, nota, evolucao, opcoes,
      ] = await Promise.all([
        repo.totais({ cursoId, dias, gre }),
        repo.porGre({ cursoId }),
        repo.funil(),
        repo.perfilDaRede({ cursoId, gre }),
        repo.inscricoesPorCurso({ gre }),
        repo.serie({ cursoId, dias, gre }),

        /* A avaliacao nao recebe `gre`: ela e anonima e nao carrega regional.
           Nao e esquecimento -- e o motivo de a tela precisar dizer, quando ha
           filtro de regional ativo, que este bloco continua sendo da rede
           inteira. Filtro que a metade dos numeros ignora em silencio e pior
           que filtro nenhum. */
        resultados.conclusao({ cursoId, gre }),
        resultados.conclusaoPorGre({ cursoId }),
        resultados.avaliacaoPorPergunta({ cursoId }),
        resultados.avaliacaoNota({ cursoId }),
        resultados.evolucaoDaConclusao({ cursoId }),
        resultados.opcoesDeFiltro(),
      ])

      const dados = {
        geradoEm: new Date().toISOString(),
        mes,
        dias,
        // Devolvido de volta para a tela nao precisar confiar no proprio estado:
        // se o servidor recusou o filtro, o rotulo mostra o que ele realmente usou.
        cursoId,
        gre,
        // O que existe para filtrar sai do banco, e nao de uma lista fixa na
        // tela: oferecer um curso sem planilha importada faria a pessoa
        // selecionar, ver tudo zerar, e concluir que o curso fracassou em vez de
        // que a planilha ainda nao chegou.
        opcoes,
        institucional: {
          totais, porGre, funil, perfil, inscricoes, serie,
          resultados: { conclusao, porGre: conclusaoPorGre, avaliacao, nota, evolucao },
        },
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
