'use strict'

const express = require('express')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')

const auth = require('./cursistas.auth')
const repo = require('./cursistas.repo')
const service = require('./cursistas.service')
const { importar } = require('./cursistas.import')
const { exportarInscritos, marcarComoExportadas } = require('./cursistas.export')
const { normalizeCpf } = require('../../shared/cpf')
const { registrar, ACOES } = require('../../shared/audit')

/**
 * Rotas do modulo de cursistas.
 *
 * Recebe do app principal os middlewares da area interna (`authInterna` e
 * `requireRole`) para as rotas administrativas, mantendo um unico lugar
 * definindo o que e acesso de equipe.
 */
module.exports = function criarRotasCursistas({ authInterna, requireRole, getUsuarioInterno }) {
  const router = express.Router()

  // ---------------------------------------------------------------------------
  // Limites de tentativa
  // ---------------------------------------------------------------------------

  // Freio por IP + CPF. Combinado com o bloqueio por conta (no banco), fecha tanto
  // a tentativa de forca bruta numa conta quanto a varredura da base de CPFs.
  const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de acesso. Tente novamente em alguns minutos.' },
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizeCpf(req.body?.cpf)}`,
  })

  // A importacao carrega ~13 mil registros; poucas execucoes por hora bastam e
  // evitam que um erro de operacao vire carga repetida no banco.
  const limiteImportacao = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Limite de importacoes por hora atingido.' },
  })

  // ---------------------------------------------------------------------------
  // Middlewares
  // ---------------------------------------------------------------------------

  function autenticarCursista(req, res, next) {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token nao fornecido.' })
    }
    try {
      const payload = auth.verificarToken(header.slice(7))
      req.cursista = { id: payload.id }
      next()
    } catch {
      res.status(401).json({ message: 'Sessao expirada. Entre novamente.' })
    }
  }

  /**
   * Enquanto a senha nao for definida, o token so serve para a rota de definir
   * senha. Sem isso, o cursista que entrou com o CPF navegaria pelo sistema sem
   * nunca trocar a senha -- e a troca obrigatoria e justamente o que fecha a
   * janela de exposicao da senha inicial.
   */
  async function exigirSenhaDefinida(req, res, next) {
    try {
      const conta = await repo.findByIdForAuth(req.cursista.id)
      if (!conta) return res.status(401).json({ message: 'Cadastro nao encontrado.' })
      if (!conta.password_hash) {
        return res.status(428).json({
          message: 'Defina uma nova senha para continuar.',
          precisaDefinirSenha: true,
        })
      }
      if (conta.status !== 'ativo') {
        return res.status(403).json({ message: 'Cadastro inativo.' })
      }
      next()
    } catch (error) {
      next(error)
    }
  }

  function tratar(handler) {
    return async (req, res) => {
      try {
        await handler(req, res)
      } catch (error) {
        const status = error.statusCode || 500
        if (status >= 500) console.error('[cursistas]', error)
        res.status(status).json({
          message: status >= 500 ? 'Erro interno do servidor.' : error.message,
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Area do cursista
  // ---------------------------------------------------------------------------

  router.post('/auth/login', limiteLogin, tratar(async (req, res) => {
    const resultado = await auth.login({ cpf: req.body?.cpf, senha: req.body?.senha, req })
    res.json(resultado)
  }))

  // Sem `exigirSenhaDefinida`: e exatamente esta a rota que o primeiro acesso usa.
  router.post('/auth/senha', autenticarCursista, tratar(async (req, res) => {
    const resultado = await auth.definirSenha({
      cursistaId: req.cursista.id,
      senhaAtual: req.body?.senhaAtual,
      novaSenha: req.body?.novaSenha,
      req,
    })
    res.json(resultado)
  }))

  router.get('/me', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    res.json(await repo.findById(req.cursista.id, { fullCpf: true }))
  }))

  router.put('/me', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    const atualizado = await service.atualizarMeusDados({
      cursistaId: req.cursista.id,
      email: req.body?.email,
      phone: req.body?.phone,
      req,
    })
    res.json(atualizado)
  }))

  router.get('/cursos-abertos', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    res.json(await service.listarCursosAbertos(req.cursista.id))
  }))

  router.get('/minhas-inscricoes', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    res.json(await service.listarMinhasInscricoes(req.cursista.id))
  }))

  router.post('/inscricoes', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    const resultado = await service.inscrever({
      cursistaId: req.cursista.id,
      courseId: Number(req.body?.courseId),
      req,
    })
    res.status(201).json(resultado)
  }))

  router.delete('/inscricoes/:courseId', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    await service.cancelarInscricao({
      cursistaId: req.cursista.id,
      courseId: Number(req.params.courseId),
      req,
    })
    res.status(204).end()
  }))

  // ---------------------------------------------------------------------------
  // Area administrativa
  // ---------------------------------------------------------------------------

  const soAdmin = [authInterna, requireRole('administrador')]

  router.get('/admin/cursistas', ...soAdmin, tratar(async (req, res) => {
    res.json(await repo.list({
      search: req.query.search || '',
      status: req.query.status || '',
      page: req.query.page,
      perPage: req.query.perPage,
    }))
  }))

  router.post('/admin/cursistas/importar', ...soAdmin, limiteImportacao, tratar(async (req, res) => {
    const conteudo = req.body?.conteudo
    if (!conteudo || typeof conteudo !== 'string') {
      return res.status(400).json({ message: 'Envie o conteudo do arquivo CSV.' })
    }
    const actor = await getUsuarioInterno(req.user.id)
    res.json(await importar({ conteudo, actor, req }))
  }))

  router.post('/admin/cursistas/:id/resetar-senha', ...soAdmin, tratar(async (req, res) => {
    const cursista = await repo.findById(req.params.id)
    if (!cursista) return res.status(404).json({ message: 'Cursista nao encontrado.' })

    await repo.resetPassword(req.params.id)
    const actor = await getUsuarioInterno(req.user.id)
    await registrar({
      actorType: 'admin',
      actorId: actor?.id || null,
      actorLabel: actor?.name || null,
      action: ACOES.SENHA_RESETADA_ADMIN,
      cursistaId: Number(req.params.id),
      req,
    })

    // A conta volta ao estado de primeiro acesso: o CPF autentica de novo e a
    // troca de senha e exigida na entrada seguinte.
    res.json({ message: 'Senha resetada. O cursista entra com o CPF e define uma nova senha.' })
  }))

  router.get('/admin/inscricoes/exportar', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    const { csv, total } = await exportarInscritos({
      courseId: req.query.courseId ? Number(req.query.courseId) : null,
      edition: req.query.edition || service.EDICAO_ATUAL,
      actor,
      req,
    })

    if (String(req.query.marcarEnviadas) === 'true') {
      await marcarComoExportadas({
        courseId: req.query.courseId ? Number(req.query.courseId) : null,
        edition: req.query.edition || service.EDICAO_ATUAL,
      })
    }

    const nome = `inscritos-${req.query.edition || service.EDICAO_ATUAL}-${Date.now()}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`)
    res.setHeader('X-Total-Registros', String(total))
    res.send(csv)
  }))

  return router
}
