'use strict'

const express = require('express')
const rateLimit = require('express-rate-limit')
const { getPool, requireMysql } = require('../../shared/db')
const repo = require('./resultados.repo')
const { executar, TIPOS } = require('./resultados.import')
const { limparCache } = require('../painel/painel.cache')

/**
 * O envio das planilhas dos paineis, pela tela do dashboard.
 *
 * Duas etapas, como a importacao da base de cursistas: CONFERIR le o arquivo e
 * roda a importacao inteira dentro de uma transacao desfeita no fim, e ENVIAR
 * grava. Quem esta enviando ve os numeros, a aba usada e os avisos antes de
 * trocar o que o painel mostra -- e o que pega a planilha do curso errado.
 *
 * Mesma planilha, mesmo curso, mesma data de referencia: atualiza por cima.
 */

const PERFIS_COM_ACESSO = ['administrador', 'gerencia']

/**
 * O arquivo chega como bytes crus, e nao em base64 nem em formulario: a base
 * enriquecida pesa 5 MB, e base64 inflaria 33% sem ganho nenhum.
 *
 * O tipo aceito e largo de proposito. No Windows o navegador rotula .csv como
 * "application/vnd.ms-excel", e um filtro estreito recusaria o arquivo certo
 * com um 400 sem explicacao. Quem decide se e .xlsx ou .csv sao os bytes, la
 * dentro do importador.
 */
const receberArquivo = express.raw({
  type: [
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
  limit: '25mb',
})

/**
 * Freio no envio. Cada envio percorre a planilha inteira dentro de uma
 * transacao -- dez mil linhas --, e uma tela com o botao preso num laco
 * derrubaria o banco de uma VPS pequena. Conferir conta junto: custa o mesmo.
 */
const limiteDeEnvio = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.' },
})

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

module.exports = function criarRotasResultados({ authInterna, requireRole, getUsuarioInterno }) {
  const router = express.Router()
  router.use(authInterna)
  const soQuemPode = requireRole(...PERFIS_COM_ACESSO)

  router.get('/envios', soQuemPode, async (req, res) => {
    try {
      res.json(await repo.enviosPorCurso())
    } catch (erro) {
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Não foi possível carregar os envios.',
      })
    }
  })

  const processar = (simular) => async (req, res) => {
    let conexao = null
    try {
      requireMysql()
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ message: 'Escolha o arquivo da planilha antes de enviar.' })
      }

      const tipo = String(req.query.tipo || '')
      if (!TIPOS.includes(tipo)) return res.status(400).json({ message: 'Tipo de planilha inválido.' })

      const quem = await getUsuarioInterno(req.user.id).catch(() => null)
      conexao = await getPool().getConnection()

      const resultado = await executar({
        conexao,
        tipo,
        cursoId: Number(req.query.curso) || null,
        referencia: String(req.query.referencia || hoje()).slice(0, 10),
        buffer: req.body,
        // O nome vem do navegador; so serve para a lista de envios. Recortado
        // no tamanho da coluna.
        arquivo: String(req.query.arquivo || 'planilha').slice(0, 255),
        por: quem?.name || req.user.email,
        simular,
      })

      // Depois de gravar, o painel precisa mostrar o que acabou de entrar. Sem
      // isso quem enviou veria os numeros velhos por ate um minuto e acharia
      // que o envio falhou.
      if (!simular) limparCache()

      res.json(resultado)
    } catch (erro) {
      // Erro de conteudo da planilha (coluna faltando, situacao desconhecida,
      // data mais antiga que a ultima) volta com a mensagem, que foi escrita
      // para quem esta enviando. O resto vira texto generico, para detalhe de
      // banco nao vazar para a tela.
      const status = erro.statusCode || 500
      if (status === 500) console.error('[resultados/envio]', erro)
      res.status(status).json({
        message: status < 500 || status === 503
          ? erro.message
          : 'Não foi possível processar a planilha. Confira se o arquivo abre no Excel e tente de novo.',
      })
    } finally {
      if (conexao) conexao.release()
    }
  }

  router.post('/conferir', soQuemPode, limiteDeEnvio, receberArquivo, processar(true))
  router.post('/enviar', soQuemPode, limiteDeEnvio, receberArquivo, processar(false))

  return router
}
