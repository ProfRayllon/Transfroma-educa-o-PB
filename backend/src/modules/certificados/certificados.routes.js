'use strict'

const express = require('express')
const service = require('./certificados.service')
const authCursista = require('../cursistas/cursistas.auth')
const repoCursistas = require('../cursistas/cursistas.repo')

/**
 * Rotas dos certificados, em tres portas:
 *  - /admin/*   a configuracao, a base e a lista, so para o administrador;
 *  - /meus*     o cursista logado baixa os proprios;
 *  - /publico/* a validacao pelo codigo, sem login.
 */

const PERFIS_ADMIN = ['administrador']

// Arte e planilha chegam como bytes crus, como nas outras importacoes.
const receberImagem = express.raw({ type: ['image/jpeg', 'image/png', 'application/octet-stream'], limit: '7mb' })
const receberPlanilha = express.raw({
  type: [
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
  limit: '25mb',
})

function tratar(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      const status = error.statusCode || 500
      if (status >= 500) console.error('[certificados]', error)
      res.status(status).json({ message: status >= 500 ? 'Erro interno do servidor.' : error.message })
    }
  }
}

function enviarPdf(res, { pdf, nomeArquivo }, baixar = true) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${baixar ? 'attachment' : 'inline'}; filename="${nomeArquivo}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(pdf)
}

const idDaRota = (valor) => {
  const id = Number(valor)
  if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('Identificador invalido.'), { statusCode: 400 })
  return id
}

module.exports = function criarRotasCertificados({ authInterna, requireRole, getUsuarioInterno }) {
  const router = express.Router()
  const soAdmin = [authInterna, requireRole(...PERFIS_ADMIN)]
  const quem = (req) => getUsuarioInterno(req.user.id).catch(() => null)

  // -------------------------------------------------------------- publico
  router.get('/publico/validar/:codigo', tratar(async (req, res) => {
    res.json(await service.validar(req.params.codigo))
  }))

  // -------------------------------------------------------------- cursista
  /** O mesmo token da area do cursista; o CPF sai do cadastro, nunca da requisicao. */
  async function cursistaLogado(req, res, next) {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ message: 'Token nao fornecido.' })
    try {
      const { id } = authCursista.verificarToken(header.slice(7))
      const conta = await repoCursistas.findByIdForAuth(id)
      if (!conta || conta.status !== 'ativo' || !conta.password_hash) {
        return res.status(401).json({ message: 'Entre novamente na area do cursista.' })
      }
      req.cpfDoCursista = conta.cpf
      next()
    } catch {
      res.status(401).json({ message: 'Sessao expirada. Entre novamente.' })
    }
  }

  router.get('/meus', cursistaLogado, tratar(async (req, res) => {
    res.json(await service.meusCertificados(req.cpfDoCursista))
  }))

  router.get('/meus/:id/pdf', cursistaLogado, tratar(async (req, res) => {
    enviarPdf(res, await service.pdfDoCursista({ id: idDaRota(req.params.id), cpf: req.cpfDoCursista }))
  }))

  // -------------------------------------------------------------- admin
  router.get('/admin/cursos', ...soAdmin, tratar(async (_req, res) => {
    res.json(await service.listarCursos())
  }))

  router.get('/admin/cursos/:courseId', ...soAdmin, tratar(async (req, res) => {
    res.json(await service.obterConfig(idDaRota(req.params.courseId)))
  }))

  router.put('/admin/cursos/:courseId', ...soAdmin, tratar(async (req, res) => {
    res.json(await service.salvarConfig({ courseId: idDaRota(req.params.courseId), corpo: req.body, actor: await quem(req), req }))
  }))

  router.put('/admin/cursos/:courseId/arte', ...soAdmin, receberImagem, tratar(async (req, res) => {
    res.json(await service.salvarArte({
      courseId: idDaRota(req.params.courseId),
      arquivo: req.body,
      nome: req.query.nome,
      actor: await quem(req),
      req,
    }))
  }))

  router.get('/admin/cursos/:courseId/arte', ...soAdmin, tratar(async (req, res) => {
    const arte = await service.arteDoCurso(idDaRota(req.params.courseId))
    if (!arte) return res.status(404).json({ message: 'Sem arte.' })
    res.setHeader('Content-Type', arte.tipo)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(arte.bytes)
  }))

  router.post('/admin/cursos/:courseId/previa', ...soAdmin, tratar(async (req, res) => {
    const pdf = await service.previa({ courseId: idDaRota(req.params.courseId), corpo: req.body })
    enviarPdf(res, { pdf, nomeArquivo: 'previa-certificado.pdf' }, false)
  }))

  const importar = (gravar) => tratar(async (req, res) => {
    res.json(await service.importarBase({
      courseId: idDaRota(req.params.courseId),
      arquivo: req.body,
      completa: req.query.completa === '1',
      gravar,
      actor: gravar ? await quem(req) : null,
      req,
    }))
  })
  router.post('/admin/cursos/:courseId/base/conferir', ...soAdmin, receberPlanilha, importar(false))
  router.post('/admin/cursos/:courseId/base/enviar', ...soAdmin, receberPlanilha, importar(true))

  router.get('/admin/cursos/:courseId/emitidos', ...soAdmin, tratar(async (req, res) => {
    res.json(await service.listarEmitidos({
      courseId: idDaRota(req.params.courseId),
      busca: req.query.busca,
      status: req.query.status,
      pagina: req.query.pagina,
    }))
  }))

  router.get('/admin/emitidos/:id/pdf', ...soAdmin, tratar(async (req, res) => {
    enviarPdf(res, await service.pdfParaAdmin(idDaRota(req.params.id)))
  }))

  router.patch('/admin/emitidos/:id', ...soAdmin, tratar(async (req, res) => {
    res.json(await service.alterarStatus({ id: idDaRota(req.params.id), status: req.body?.status, actor: await quem(req), req }))
  }))

  return router
}
