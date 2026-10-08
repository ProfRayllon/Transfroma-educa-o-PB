'use strict'

const express = require('express')

const { requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf } = require('../../shared/cpf')
const { configurado: emailConfigurado } = require('../../shared/email')
const repo = require('./suporte.repo')
const emails = require('./suporte.emails')
const service = require('./suporte.service')

const { erro } = service

/**
 * Rotas do Suporte.
 *
 * Duas metades no mesmo prefixo, separadas pela ordem de declaracao:
 *
 *   /publico/*   qualquer visitante -- abrir chamado e consultar protocolo
 *   o resto      equipe autenticada -- a fila de atendimento
 *
 * O `router.use(authInterna)` fica ENTRE as duas: tudo declarado depois dele
 * exige sessao, e as duas rotas publicas vem antes de proposito.
 */

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function texto(valor, max) {
  return String(valor ?? '').trim().slice(0, max)
}

function clientIp(req) {
  return String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 45) || null
}

/**
 * Dispara o e-mail sem segurar a resposta, e anota no historico se ele saiu.
 *
 * SMTP pode levar segundos; quem abriu o chamado nao precisa esperar por isso
 * para ver o protocolo na tela -- o protocolo tambem aparece la.
 */
function enviarEAnotar(chamadoId, descricao, envio) {
  Promise.resolve()
    .then(envio)
    .then((saiu) => repo.registrarHistorico({
      chamadoId,
      tipo: 'email',
      mensagem: saiu ? `E-mail enviado: ${descricao}.` : `E-mail NÃO enviado: ${descricao}.`,
    }))
    .catch((error) => console.error('[suporte] falha ao anotar envio de e-mail', error.message))
}

module.exports = function criarRotasSuporte({ authInterna, getUsuarioInterno, listarUsuariosPorPerfis }) {
  const router = express.Router()

  function tratar(handler) {
    return async (req, res) => {
      try {
        requireMysql()
        await handler(req, res)
      } catch (error) {
        const status = error.statusCode || 500
        if (status >= 500) console.error('[suporte]', error)
        res.status(status).json({
          message: status >= 500 && status !== 503 ? 'Erro interno do servidor.' : error.message,
        })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Publico
  // ---------------------------------------------------------------------------

  // Sem limite de tentativas por enquanto. O primeiro freio (5 chamados por
  // hora por IP) bloqueava gente que nao tinha aberto nenhum. Causa provavel:
  // atras dos dois proxies da VPS o IP que chega aqui nao e o do visitante, e
  // todo mundo dividia o mesmo limite. Antes de religar, conferir o IP real.

  /**
   * As listas que o formulario precisa, e se o e-mail esta ligado.
   *
   * `emailAtivo` deixa a tela honesta: sem SMTP configurado nenhum e-mail sai,
   * e a pessoa precisa ser avisada para anotar o protocolo em vez de esperar
   * uma mensagem que nao vai chegar. Configurado o SMTP, o aviso some sozinho.
   */
  router.get('/publico/opcoes', (req, res) => {
    res.json({ categorias: service.CATEGORIAS, status: service.STATUS, emailAtivo: emailConfigurado() })
  })

  router.post('/publico/chamados', tratar(async (req, res) => {
    // Campo invisivel na tela: so robo preenche. Responde como sucesso para o
    // robo nao aprender a contornar, mas nao grava nada.
    if (texto(req.body?.site, 200)) return res.status(201).json({ protocolo: null })

    const nome = texto(req.body?.nome, 150)
    const cpf = normalizeCpf(req.body?.cpf)
    const email = texto(req.body?.email, 190).toLowerCase()
    const categoria = texto(req.body?.categoria, 30)
    const descricao = texto(req.body?.descricao, 4000)

    if (nome.length < 3) throw erro(400, 'Informe seu nome completo.')
    if (!isValidCpf(cpf)) throw erro(400, 'CPF inválido.')
    if (!EMAIL_VALIDO.test(email)) throw erro(400, 'E-mail inválido.')
    if (!service.CATEGORIAS[categoria]) throw erro(400, 'Escolha do que se trata o chamado.')
    if (descricao.length < 10) throw erro(400, 'Descreva o problema com um pouco mais de detalhe.')

    // Um chamado em aberto por e-mail: o proximo so depois de o anterior ser
    // concluido. Evita a mesma pessoa abrir varios para o mesmo problema e
    // sobrecarregar a fila. O protocolo volta na resposta porque, com o e-mail
    // fora do ar, quem perdeu o numero nao teria outro jeito de recupera-lo --
    // e ele sozinho nao abre nada: a consulta exige tambem o CPF.
    const emAberto = await repo.buscarEmAbertoPorEmail(email)
    if (emAberto) {
      return res.status(409).json({
        message: `Você ainda tem um chamado em aberto (protocolo ${emAberto.protocolo}). Ao finalizar esse chamado, você poderá solicitar outro.`,
        protocoloEmAberto: emAberto.protocolo,
      })
    }

    const chamado = await repo.criar({ nome, cpf, email, categoria, descricao, ip: clientIp(req) })

    enviarEAnotar(chamado.id, 'protocolo ao solicitante', () => emails.avisarAbertura(chamado))
    enviarEAnotar(chamado.id, 'aviso à equipe de suporte', () => emails.avisarEquipe(chamado))

    res.status(201).json({ protocolo: chamado.protocolo, email: chamado.email, emailAtivo: emailConfigurado() })
  }))

  /**
   * Consulta do proprio solicitante. Protocolo E CPF: o protocolo e sequencial
   * e adivinhavel, e sozinho mostraria o chamado de outra pessoa.
   */
  router.get('/publico/consulta', tratar(async (req, res) => {
    const protocolo = texto(req.query.protocolo, 20).replace(/\D/g, '')
    const cpf = normalizeCpf(req.query.cpf)
    if (!protocolo || !isValidCpf(cpf)) throw erro(400, 'Informe o protocolo e o CPF.')

    const chamado = await repo.buscarPorProtocoloECpf(protocolo, cpf)
    if (!chamado) throw erro(404, 'Nenhum chamado encontrado com este protocolo e CPF.')

    const historico = await repo.historico(chamado.id, { somentePublico: true })
    res.json({
      protocolo: chamado.protocolo,
      categoria: chamado.categoria,
      status: chamado.status,
      descricao: chamado.descricao,
      resolucao: chamado.resolucao,
      criadoEm: chamado.criadoEm,
      atualizadoEm: chamado.atualizadoEm,
      historico: historico.map(({ tipo, mensagem, criadoEm }) => ({ tipo, mensagem, criadoEm })),
    })
  }))

  // ---------------------------------------------------------------------------
  // Equipe
  // ---------------------------------------------------------------------------

  /** O perfil vem do banco, e nao do token -- troca de perfil vale na hora. */
  async function carregarAtor(req, res, next) {
    try {
      const ator = await getUsuarioInterno(req.user.id)
      if (!ator) return res.status(401).json({ message: 'Usuario nao encontrado.' })
      if (ator.status !== 'ativo') return res.status(403).json({ message: 'Usuario inativo.' })
      req.ator = ator
      next()
    } catch (error) {
      next(error)
    }
  }

  router.use(authInterna, carregarAtor)

  function escopoDe(ator) {
    return service.gereSuporte(ator)
      ? { todos: true }
      : { usuarioId: ator.id, perfil: ator.role }
  }

  async function carregarChamado(req) {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) throw erro(400, 'Chamado inválido.')
    const chamado = await repo.buscar(id)
    // 404 tambem para quem nao pode ver: nao confirma que o chamado existe.
    if (!chamado || !service.podeVer(req.ator, chamado)) throw erro(404, 'Chamado não encontrado.')
    return chamado
  }

  /**
   * O que a lateral precisa: se mostra o item e quantos esperam. Responde para
   * qualquer pessoa da equipe -- quem nao gere so aparece no menu se tiver
   * chamado encaminhado.
   */
  router.get('/resumo', tratar(async (req, res) => {
    const gere = service.gereSuporte(req.ator)
    const pendentes = await repo.contarPendentes(escopoDe(req.ator))
    res.json({ gere, pendentes, mostrar: gere || pendentes > 0 })
  }))

  router.get('/chamados', tratar(async (req, res) => {
    const { status, categoria, busca, perfil } = req.query
    if (status && status !== 'pendentes' && !service.STATUS[status]) throw erro(400, 'Status inválido.')
    if (categoria && !service.CATEGORIAS[categoria]) throw erro(400, 'Categoria inválida.')
    const resultado = await repo.listar(escopoDe(req.ator), {
      status: status || undefined,
      categoria: categoria || undefined,
      busca: texto(busca, 100) || undefined,
      perfil: texto(perfil, 30) || undefined,
    })
    res.json({ ...resultado, gere: service.gereSuporte(req.ator), podeExcluir: service.podeExcluir(req.ator) })
  }))

  router.get('/chamados/:id', tratar(async (req, res) => {
    const base = await carregarChamado(req)
    // CPF completo so no detalhe: e o que o atendente usa para achar a pessoa
    // na base de cursistas ou no AVA.
    const chamado = await repo.buscar(base.id, { cpfCompleto: true })
    const historico = await repo.historico(chamado.id)
    res.json({
      chamado,
      historico,
      permissoes: {
        encaminhar: service.gereSuporte(req.ator),
        excluir: service.podeExcluir(req.ator),
        status: Object.keys(service.STATUS).filter((s) => service.podeMudarPara(req.ator, chamado, s)),
      },
    })
  }))

  /** Quem pode receber um encaminhamento, agrupado por perfil. */
  router.get('/pessoas', tratar(async (req, res) => {
    if (!service.gereSuporte(req.ator)) throw erro(403, 'Apenas o suporte encaminha chamados.')
    const pessoas = await listarUsuariosPorPerfis(service.PERFIS_DESTINO)
    res.json({
      perfis: service.PERFIS_DESTINO,
      pessoas: pessoas.map((p) => ({ id: p.id, nome: p.name, perfil: p.role })),
    })
  }))

  router.patch('/chamados/:id/encaminhar', tratar(async (req, res) => {
    if (!service.gereSuporte(req.ator)) throw erro(403, 'Apenas o suporte encaminha chamados.')
    const chamado = await carregarChamado(req)

    let perfil = texto(req.body?.perfil, 30) || null
    const responsavelId = req.body?.responsavelId ? Number(req.body.responsavelId) : null
    const observacao = texto(req.body?.observacao, 2000)
    let responsavel = null

    if (responsavelId) {
      responsavel = await getUsuarioInterno(responsavelId)
      if (!responsavel || responsavel.status !== 'ativo') throw erro(400, 'Responsável inválido.')
      // Pessoa escolhida sem perfil: o perfil dela. Com perfil diferente, vale
      // a pessoa -- o perfil fica so como a "fila" em que o chamado aparece.
      perfil = perfil || responsavel.role
    }
    if (perfil && !service.PERFIS_DESTINO.includes(perfil)) throw erro(400, 'Perfil inválido.')

    await repo.atualizar(chamado.id, {
      encaminhadoPerfil: perfil,
      responsavelId: responsavel ? responsavel.id : null,
      // Encaminhar e comecar a tratar: o chamado sai de "aberto".
      ...(chamado.status === 'aberto' && perfil ? { status: 'em_andamento' } : {}),
    })

    const destino = responsavel ? `${responsavel.name} (${perfil})` : perfil ? `perfil ${perfil}` : 'ninguém (encaminhamento removido)'
    await repo.registrarHistorico({
      chamadoId: chamado.id,
      autor: req.ator,
      tipo: 'encaminhamento',
      mensagem: `Encaminhado para ${destino}.${observacao ? `\n${observacao}` : ''}`,
    })

    const atualizado = await repo.buscar(chamado.id)
    if (responsavel?.email && Number(responsavel.id) !== Number(req.ator.id)) {
      enviarEAnotar(chamado.id, `encaminhamento a ${responsavel.name}`,
        () => emails.avisarResponsavel(atualizado, { email: responsavel.email, nome: responsavel.name }, observacao))
    }
    res.json(atualizado)
  }))

  router.patch('/chamados/:id/status', tratar(async (req, res) => {
    const chamado = await carregarChamado(req)
    const status = texto(req.body?.status, 30)
    const mensagem = texto(req.body?.mensagem, 4000)
    const notificar = req.body?.notificar !== false

    if (!service.podeMudarPara(req.ator, chamado, status)) throw erro(403, 'Você não pode aplicar este status.')
    if (status === chamado.status) throw erro(400, 'O chamado já está neste status.')
    if (status === 'resolvido' && mensagem.length < 5) {
      throw erro(400, 'Descreva a solução: ela vai no e-mail ao solicitante.')
    }

    const encerra = status === 'resolvido' || status === 'cancelado'
    await repo.atualizar(chamado.id, {
      status,
      ...(encerra ? { resolucao: mensagem || null } : {}),
    })
    await repo.registrarHistorico({
      chamadoId: chamado.id,
      autor: req.ator,
      tipo: 'status',
      // Resolucao e cancelamento sao vistos pelo solicitante na consulta; as
      // trocas intermediarias tambem, para ele saber que alguem esta cuidando.
      mensagem: `Status: ${service.STATUS[status]}.${mensagem ? `\n${mensagem}` : ''}`,
      publico: true,
    })

    const atualizado = await repo.buscar(chamado.id)
    if (encerra && notificar) {
      enviarEAnotar(chamado.id, `${service.STATUS[status].toLowerCase()} ao solicitante`,
        () => emails.avisarEncerramento(atualizado, mensagem))
    }
    res.json(atualizado)
  }))

  /** Nota interna: so a equipe ve. */
  router.post('/chamados/:id/notas', tratar(async (req, res) => {
    const chamado = await carregarChamado(req)
    const mensagem = texto(req.body?.mensagem, 4000)
    if (!mensagem) throw erro(400, 'Escreva a nota.')
    await repo.registrarHistorico({ chamadoId: chamado.id, autor: req.ator, tipo: 'nota', mensagem })
    res.status(201).json({ ok: true })
  }))

  /** Mensagem ao solicitante: vai por e-mail e aparece na consulta publica. */
  router.post('/chamados/:id/respostas', tratar(async (req, res) => {
    const chamado = await carregarChamado(req)
    const mensagem = texto(req.body?.mensagem, 4000)
    if (mensagem.length < 2) throw erro(400, 'Escreva a mensagem.')
    if (chamado.status === 'cancelado') throw erro(400, 'Chamado cancelado: reabra antes de responder.')

    await repo.registrarHistorico({ chamadoId: chamado.id, autor: req.ator, tipo: 'resposta', mensagem, publico: true })
    enviarEAnotar(chamado.id, 'resposta ao solicitante', () => emails.enviarResposta(chamado, mensagem))
    res.status(201).json({ ok: true })
  }))

  router.delete('/chamados/:id', tratar(async (req, res) => {
    if (!service.podeExcluir(req.ator)) throw erro(403, 'Apenas o administrador exclui chamados.')
    const chamado = await carregarChamado(req)
    await repo.excluir(chamado.id)
    console.log(`[suporte] chamado ${chamado.protocolo} excluido por ${req.ator.name} (id ${req.ator.id})`)
    res.status(204).end()
  }))

  return router
}
