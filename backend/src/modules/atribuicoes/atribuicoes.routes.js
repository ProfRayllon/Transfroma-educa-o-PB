'use strict'

const express = require('express')

const repo = require('./atribuicoes.repo')
const service = require('./atribuicoes.service')
const { exportarMes } = require('./atribuicoes.export')

/**
 * Rotas do modulo de Atribuicoes -- o que a equipe chama de Frequencia.
 *
 * Tres leituras, tres publicos, cada uma com o seu filtro travado no servidor:
 *
 *   /minhas         quem executa   ve so o que e dele
 *   /avaliar        quem avalia    ve so o que foi designado a ele
 *   /acompanhamento quem gerencia  ve o mes inteiro
 *
 * A separacao nao e de tela: nenhuma delas aceita um parametro que amplie o
 * proprio alcance, entao trocar a URL no navegador nao mostra a lista de outra
 * pessoa.
 */
module.exports = function criarRotasAtribuicoes({ authInterna, getUsuarioInterno, listarUsuariosPorPerfis }) {
  const router = express.Router()

  /**
   * O perfil vem do banco, e nao do token.
   *
   * Mesma razao do resto do sistema: uma troca de perfil passa a valer na hora,
   * sem exigir novo login. Um token emitido antes da mudanca continuaria
   * carregando o perfil antigo.
   */
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

  function tratar(handler) {
    return async (req, res) => {
      try {
        await handler(req, res)
      } catch (error) {
        const status = error.statusCode || 500
        if (status >= 500) console.error('[atribuicoes]', error)
        res.status(status).json({
          // 503 tem a mensagem preservada: ele nao e uma falha inesperada, e o
          // aviso de que a API subiu sem banco. Esconde-lo atras de "erro
          // interno" transformaria um problema de configuracao em um bug para
          // alguem caçar. Nos demais 5xx nada sai daqui, para detalhe interno
          // nao virar resposta.
          message: status >= 500 && status !== 503 ? 'Erro interno do servidor.' : error.message,
        })
      }
    }
  }

  router.use(authInterna, carregarAtor)

  // ---------------------------------------------------------------------------
  // Apoio a tela de atribuir
  // ---------------------------------------------------------------------------

  /**
   * As pessoas que podem receber atividade, agrupadas por perfil.
   *
   * O agrupamento e o que permite os dois modos que a coordenacao pediu: marcar
   * o perfil inteiro de uma vez ou escolher uma pessoa so. Para o servidor os
   * dois casos chegam iguais -- uma lista de ids.
   */
  router.get('/pessoas', tratar(async (req, res) => {
    if (!service.podeAtribuir(req.ator)) {
      return res.status(403).json({ message: 'Voce nao tem permissao para atribuir atividades.' })
    }

    const perfis = Object.keys(service.ROTULOS_PERFIL).filter((perfil) => perfil !== service.PERFIL_QUE_NAO_RECEBE)
    const pessoas = await listarUsuariosPorPerfis(perfis)

    const grupos = perfis
      .map((perfil) => ({
        role: perfil,
        label: service.ROTULOS_PERFIL[perfil],
        pessoas: pessoas
          .filter((pessoa) => pessoa.role === perfil)
          .map(({ id, name, email }) => ({ id, name, email })),
      }))
      .filter((grupo) => grupo.pessoas.length > 0)

    res.json(grupos)
  }))

  /**
   * Candidatos a avaliador: qualquer pessoa ativa, administrador incluido.
   *
   * Sem restricao de perfil de proposito -- quem atribui sabe melhor que o
   * sistema quem tem condicao de julgar aquela entrega. Um supervisor de tutoria
   * avaliando um tutor e o caso comum, mas nao e o unico.
   */
  router.get('/avaliadores', tratar(async (req, res) => {
    if (!service.podeAtribuir(req.ator)) {
      return res.status(403).json({ message: 'Voce nao tem permissao para atribuir atividades.' })
    }

    const pessoas = await listarUsuariosPorPerfis(Object.keys(service.ROTULOS_PERFIL))
    res.json(pessoas.map(({ id, name, role }) => ({
      id,
      name,
      role,
      roleLabel: service.ROTULOS_PERFIL[role] || role,
    })))
  }))

  // ---------------------------------------------------------------------------
  // Atribuir
  // ---------------------------------------------------------------------------

  router.post('/', tratar(async (req, res) => {
    const resultado = await service.criar({
      dados: req.body,
      actor: req.ator,
      buscarUsuario: getUsuarioInterno,
    })
    res.status(201).json(resultado)
  }))

  router.put('/:id', tratar(async (req, res) => {
    res.json(await service.editar({ id: req.params.id, actor: req.ator, dados: req.body }))
  }))

  router.delete('/:id', tratar(async (req, res) => {
    await service.excluir({ id: req.params.id, actor: req.ator })
    res.status(204).end()
  }))

  // ---------------------------------------------------------------------------
  // Quem executa
  // ---------------------------------------------------------------------------

  router.get('/minhas', tratar(async (req, res) => {
    res.json(await service.listarMinhas({ actor: req.ator, mes: req.query.mes }))
  }))

  router.post('/:id/checkin', tratar(async (req, res) => {
    const atualizada = await service.darCheckin({
      id: req.params.id,
      actor: req.ator,
      // Sem o campo, marca como feito: e o caminho que a tela usa em 9 de 10
      // cliques, e desmarcar sempre manda `feito: false` explicito.
      feito: req.body?.feito === undefined ? true : Boolean(req.body.feito),
      observacao: req.body?.observacao,
    })
    res.json(atualizada)
  }))

  // ---------------------------------------------------------------------------
  // Quem avalia
  // ---------------------------------------------------------------------------

  router.get('/avaliar', tratar(async (req, res) => {
    res.json(await service.listarParaAvaliar({
      actor: req.ator,
      mes: req.query.mes,
      apenasPendentes: req.query.todas !== '1',
    }))
  }))

  router.put('/:id/avaliacao', tratar(async (req, res) => {
    const atualizada = await service.registrarAvaliacao({
      id: req.params.id,
      actor: req.ator,
      avaliacao: req.body?.avaliacao,
      observacao: req.body?.observacao,
    })
    res.json(atualizada)
  }))

  // ---------------------------------------------------------------------------
  // Quem acompanha
  // ---------------------------------------------------------------------------

  router.get('/acompanhamento', tratar(async (req, res) => {
    res.json(await service.acompanhamento({
      actor: req.ator,
      mes: req.query.mes,
      role: req.query.role,
    }))
  }))

  /**
   * O que cada perfil ve no menu, em uma chamada so.
   *
   * Serve para o menu saber se mostra "Minhas atividades", se mostra a aba de
   * avaliacao e quantas pendencias existem -- sem a tela precisar bater em tres
   * rotas so para se desenhar.
   */
  router.get('/resumo', tratar(async (req, res) => {
    const mes = service.normalizarMes(req.query.mes)
    const [minhas, pendentesParaAvaliar, souAvaliador] = await Promise.all([
      repo.listar({ mes, responsavelId: req.ator.id }),
      repo.contarPendentesDoAvaliador(req.ator.id),
      repo.ehAvaliadorDeAlgo(req.ator.id),
    ])

    res.json({
      mes,
      podeAtribuir: service.podeAtribuir(req.ator),
      podeExportar: service.podeExportar(req.ator),
      recebeAtividade: service.podeReceber(req.ator),
      souAvaliador,
      minhas: service.resumir(minhas),
      pendentesParaAvaliar,
    })
  }))

  // ---------------------------------------------------------------------------
  // Relatorio
  // ---------------------------------------------------------------------------

  /**
   * Planilha do mes, so para o administrador.
   *
   * `Content-Disposition` com o nome ja montado: o navegador salva
   * "frequencia-2026-08.csv" em vez de "relatorio", que e o que faz diferenca
   * quando ha doze arquivos na pasta de downloads.
   */
  router.get('/relatorio', tratar(async (req, res) => {
    if (!service.podeExportar(req.ator)) {
      return res.status(403).json({ message: 'Somente o administrador pode baixar o relatorio do mes.' })
    }

    const { csv, nomeArquivo } = await exportarMes({ mes: req.query.mes, role: req.query.role || null })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
    res.send(csv)
  }))

  return router
}
