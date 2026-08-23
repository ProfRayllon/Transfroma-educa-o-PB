'use strict'

const express = require('express')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')

const auth = require('./cursistas.auth')
const repo = require('./cursistas.repo')
const service = require('./cursistas.service')
const admin = require('./cursistas.admin')
const { importar } = require('./cursistas.import')
const { exportarInscritos, marcarComoExportadas } = require('./cursistas.export')
const { normalizeCpf } = require('../../shared/cpf')
// Limites declarados como TOTAL pretendido; `porProcesso` divide pelo numero de
// processos do cluster, senao cada um contaria os seus e o freio valeria o dobro.
const { porProcesso } = require('../../shared/concorrencia')
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
    limit: porProcesso(10),
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
    limit: porProcesso(40),
    standardHeaders: false,
    legacyHeaders: false,
    message: { message: 'Muitas tentativas de acesso. Tente novamente em alguns minutos.' },
    keyGenerator: (req) => ipKeyGenerator(req.ip),
  })

  /**
   * Freio da importacao.
   *
   * Cinco por hora era apertado demais na pratica: montar a base e um vaivem de
   * corrigir a planilha e subir de novo -- acento errado, coluna faltando, lote
   * parcial -- e o limite estourava no meio do trabalho, transformando um erro
   * de digitacao numa espera de uma hora.
   *
   * Quinze continua cumprindo o proposito, que e impedir que um clique repetido
   * ou um script vire carga continua no banco, sem atrapalhar quem esta
   * legitimamente ajustando a base.
   */
  const limiteImportacao = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: porProcesso(15),
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
          // Dados que a tela precisa para tratar a recusa -- hoje, o que seria
          // apagado junto com um cursista. So em erro de cliente: em 500 nada
          // sai daqui, para detalhe interno nao virar resposta.
          ...(status < 500 && error.payload ? error.payload : {}),
        })
      }
    }
  }

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
      origem: req.body?.origem || '',
      page: req.body?.page,
      perPage: req.body?.perPage,
    }))
  }))

  // ---------------------------------------------------------------------------
  // Manutencao do cadastro
  //
  // Criar, editar e excluir um cursista de cada vez. A importacao continua sendo
  // o caminho da carga em massa; estas rotas cobrem a correcao pontual, que pela
  // planilha exigiria reimportar tudo -- e que no caso da exclusao a importacao
  // nem faz, porque ela nunca remove ninguem.
  //
  // Restritas a 'administrador', como o resto deste bloco: aqui se troca o CPF
  // (que e o login) e se apaga cadastro com inscricao, as duas operacoes de
  // maior alcance do modulo.
  // ---------------------------------------------------------------------------

  /**
   * `:id` vem da URL e nao e confiavel. Sem esta conferencia, "abc" viraria NaN
   * e chegaria ao driver do MySQL como parametro invalido -- erro 500 no lugar
   * do 404 que o caso merece.
   */
  function idDaRota(req) {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      throw Object.assign(new Error('Cursista nao encontrado.'), { statusCode: 404 })
    }
    return id
  }

  router.post('/admin/cursistas', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    res.status(201).json(await admin.criar({ corpo: req.body, actor, req }))
  }))

  router.get('/admin/cursistas/:id', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    res.json(await admin.detalhar({ id: idDaRota(req), actor, req }))
  }))

  router.put('/admin/cursistas/:id', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    res.json(await admin.atualizar({ id: idDaRota(req), corpo: req.body, actor, req }))
  }))

  /**
   * A confirmacao das inscricoes vem na query, e nao no corpo: DELETE com corpo
   * e aceito pelo Express mas ignorado por parte dos proxies, e uma confirmacao
   * que se perde no caminho vira exclusao recusada sem explicacao.
   */
  router.delete('/admin/cursistas/:id', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    const resultado = await admin.excluir({
      id: idDaRota(req),
      confirmarInscricoes: String(req.query.confirmarInscricoes) === 'true',
      actor,
      req,
    })
    res.json(resultado)
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

    // A conta volta ao estado de primeiro acesso: a senha padrao autentica de
    // novo e a troca e exigida na entrada seguinte.
    res.json({ message: 'Senha resetada. O cursista entra com a senha padrao e define uma nova.' })
  }))

  /**
   * Quantos inscritos por curso, para a tela administrativa oferecer o download
   * de cada um. So contagens -- nenhum dado de cursista sai daqui.
   */
  router.get('/admin/inscricoes/resumo', ...soAdmin, tratar(async (req, res) => {
    res.json(await service.resumoInscricoesPorCurso(req.query.edition))
  }))

  router.get('/admin/inscricoes/exportar', ...soAdmin, tratar(async (req, res) => {
    const actor = await getUsuarioInterno(req.user.id)
    const { csv, total } = await exportarInscritos({
      courseId: req.query.courseId ? Number(req.query.courseId) : null,
      edition: req.query.edition || service.EDICAO_ATUAL,
      // 'completo' e o padrao: e o relatorio que a coordenacao usa no dia a dia.
      // 'ava' fica para a carga no ambiente, quando o modelo oficial chegar.
      formato: req.query.formato === 'ava' ? 'ava' : 'completo',
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
