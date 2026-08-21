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

  // Sao DOIS freios empilhados, e cada um cobre um ataque diferente.
  //
  // Por IP + CPF: forca bruta de senha contra uma conta especifica.
  const limiteLoginPorConta = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de acesso. Tente novamente em alguns minutos.' },
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${normalizeCpf(req.body?.cpf)}`,
  })

  // Por IP apenas: varredura da base de CPFs. O freio acima sozinho NAO cobre este
  // caso -- como o CPF entra na chave, cada CPF novo ganharia um orcamento novo e o
  // limite nunca dispararia numa varredura. Como a senha inicial e o proprio CPF,
  // cada acerto e uma tomada de conta, entao este e o freio que realmente segura.
  const limiteLoginPorOrigem = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: false,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de acesso. Tente novamente em alguns minutos.' },
    keyGenerator: (req) => ipKeyGenerator(req.ip),
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
      req.contaCursista = conta
      next()
    } catch (error) {
      next(error)
    }
  }

  /**
   * Segundo portao: a base chega inteira com o cadastro pendente de confirmacao
   * e o cursista so passa das telas de cadastro depois de completar os dados.
   *
   * Aplicado apenas nas rotas de curso e inscricao -- ler e gravar o proprio
   * cadastro precisa continuar liberado, senao nao haveria como completa-lo.
   */
  function exigirCadastroConfirmado(req, res, next) {
    if (!req.contaCursista?.cadastro_confirmado) {
      return res.status(428).json({
        message: 'Complete e confirme o seu cadastro para acessar os cursos.',
        precisaConfirmarCadastro: true,
      })
    }
    next()
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
  // Area publica (sem sessao)
  // ---------------------------------------------------------------------------

  /**
   * Contadores da pagina inicial.
   *
   * Unica rota do modulo sem autenticacao. Devolve so numeros agregados: quantas
   * inscricoes, quantos cursistas distintos, quantos cursos abertos. Nao ha como
   * identificar ninguem a partir disso, e o servico ja aplica cache de 1 minuto
   * para a home nao virar carga no banco.
   */
  router.get('/publico/contadores', tratar(async (req, res) => {
    res.json(await service.contadoresPublicos())
  }))

  // ---------------------------------------------------------------------------
  // Area do cursista
  // ---------------------------------------------------------------------------

  router.post('/auth/login', limiteLoginPorOrigem, limiteLoginPorConta, tratar(async (req, res) => {
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

  // Sem `exigirCadastroConfirmado`: e esta a rota que conclui o cadastro.
  router.put('/me', autenticarCursista, exigirSenhaDefinida, tratar(async (req, res) => {
    const atualizado = await service.atualizarMeuCadastro({
      cursistaId: req.cursista.id,
      dados: req.body,
      req,
    })
    res.json(atualizado)
  }))

  const areaLogada = [autenticarCursista, exigirSenhaDefinida, exigirCadastroConfirmado]

  router.get('/cursos-abertos', ...areaLogada, tratar(async (req, res) => {
    res.json(await service.listarCursosAbertos(req.cursista.id))
  }))

  router.get('/minhas-inscricoes', ...areaLogada, tratar(async (req, res) => {
    res.json(await service.listarMinhasInscricoes(req.cursista.id))
  }))

  router.post('/inscricoes', ...areaLogada, tratar(async (req, res) => {
    const resultado = await service.inscrever({
      cursistaId: req.cursista.id,
      courseId: Number(req.body?.courseId),
      req,
    })
    res.status(201).json(resultado)
  }))

  router.delete('/inscricoes/:courseId', ...areaLogada, tratar(async (req, res) => {
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

  /**
   * Busca de cursistas por POST, e nao GET com query string.
   *
   * O termo pode ser um CPF, e o nginx grava a URL completa no access.log
   * (formato combined, retido por 14 dias). Um CPF pesquisado ficaria em texto
   * puro no disco do servidor, acessivel a quem le log -- alem do historico do
   * navegador e de qualquer proxy no caminho. No corpo do POST isso nao acontece.
   */
  router.post('/admin/cursistas/buscar', ...soAdmin, tratar(async (req, res) => {
    res.json(await repo.list({
      search: req.body?.search || '',
      status: req.body?.status || '',
      situacao: req.body?.situacao || '',
      page: req.body?.page,
      perPage: req.body?.perPage,
    }))
  }))

  // Recebe o .xlsx como bytes, nao como texto ou base64: a base dos 13 mil pesa
  // alguns MB e base64 inflaria em 33% sem nenhum ganho.
  const receberPlanilha = express.raw({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    limit: '25mb',
  })

  router.post('/admin/cursistas/importar', ...soAdmin, limiteImportacao, receberPlanilha, tratar(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: 'Envie o arquivo .xlsx da base no corpo da requisicao.' })
    }
    const actor = await getUsuarioInterno(req.user.id)
    res.json(await importar({ arquivo: req.body, actor, req }))
  }))

  /**
   * Panorama de acesso, so com numeros agregados.
   *
   * Acompanhar a adesao dos 13 mil nao exige abrir o cadastro de ninguem, e a
   * LGPD pede que o tratamento se limite ao necessario para a finalidade -- por
   * isso nada aqui identifica pessoas.
   */
  router.get('/admin/estatisticas', ...soAdmin, tratar(async (req, res) => {
    res.json(await repo.estatisticas())
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
