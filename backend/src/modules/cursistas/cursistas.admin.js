'use strict'

const repo = require('./cursistas.repo')
const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf, maskCpf } = require('../../shared/cpf')
const { registrar, ACOES } = require('../../shared/audit')

/**
 * Manutencao do cadastro de cursistas pela coordenacao.
 *
 * Existe porque a importacao sozinha nao resolve o dia a dia: um CPF digitado
 * errado na origem, um professor que ficou de fora da base, um cadastro de teste
 * que precisa sumir. Reimportar a planilha inteira para corrigir uma linha e
 * caro e arriscado -- e nem resolve, porque a importacao nunca exclui ninguem.
 *
 * O que esta tela alcanca e exatamente o que o cursista NAO alcanca: nome, CPF,
 * dados funcionais e escolas. Os campos que ele preenche tambem sao editaveis
 * aqui, para a coordenacao corrigir um erro de digitacao a pedido dele.
 *
 * O que nao se edita por aqui, em nenhuma hipotese: senha, se o cadastro foi
 * confirmado e as datas de acesso. Isso e registro do que aconteceu, nao dado
 * cadastral -- poder reescrever apagaria a diferenca entre o que a pessoa fez e
 * o que disseram que ela fez.
 */

const MAX_VINCULOS = 4

/**
 * `payload` vai junto na resposta quando o status e de erro do cliente -- e como
 * a recusa por inscricoes existentes informa a tela quantas seriam apagadas.
 */
function erro(statusCode, message, payload = null) {
  return Object.assign(new Error(message), { statusCode, payload })
}

const texto = (valor, limite) => {
  const limpo = String(valor ?? '').trim().slice(0, limite)
  return limpo || null
}

/**
 * Aceita AAAA-MM-DD e DD/MM/AAAA, e recusa o resto.
 *
 * Devolve `undefined` para valor ausente (campo nao veio no formulario, nao
 * mexer) e `null` para valor vazio (limpar o campo). A distincao importa: sem
 * ela, editar so o nome apagaria a data de nascimento.
 */
function data(valor) {
  if (valor === undefined) return undefined
  const bruto = String(valor ?? '').trim()
  if (!bruto) return null

  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return bruto
  const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`

  throw erro(400, 'Data invalida. Use AAAA-MM-DD ou DD/MM/AAAA.')
}

function email(valor, rotulo) {
  if (valor === undefined) return undefined
  const limpo = String(valor ?? '').trim().toLowerCase().slice(0, 150)
  if (!limpo) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
    throw erro(400, `${rotulo} invalido.`)
  }
  return limpo
}

/**
 * Monta o objeto de gravacao a partir do corpo da requisicao.
 *
 * `parcial` distingue criacao de edicao: na criacao, CPF e nome sao exigidos; na
 * edicao, campo ausente significa "nao mexer" e so o que veio e validado.
 */
function montarDados(corpo, { parcial }) {
  const dados = {}

  if (corpo.cpf !== undefined || !parcial) {
    const cpf = normalizeCpf(corpo.cpf)
    if (!cpf) throw erro(400, 'Informe o CPF.')
    if (!isValidCpf(cpf)) throw erro(400, 'CPF invalido: os digitos verificadores nao conferem.')
    dados.cpf = cpf
  }

  if (corpo.name !== undefined || !parcial) {
    const nome = texto(corpo.name, 150)
    if (!nome) throw erro(400, 'Informe o nome completo.')
    dados.name = nome
  }

  if (corpo.usuarioId !== undefined) dados.usuarioId = texto(corpo.usuarioId, 20)
  if (corpo.funcao !== undefined) dados.funcao = texto(corpo.funcao, 120)
  if (corpo.componenteCurricular !== undefined) dados.componenteCurricular = texto(corpo.componenteCurricular, 120)
  if (corpo.eixoTecnologico !== undefined) dados.eixoTecnologico = texto(corpo.eixoTecnologico, 120)
  if (corpo.cursoTecnico !== undefined) dados.cursoTecnico = texto(corpo.cursoTecnico, 120)
  if (corpo.phone !== undefined) dados.phone = texto(String(corpo.phone ?? '').replace(/\D/g, ''), 20)
  if (corpo.genero !== undefined) dados.genero = texto(corpo.genero, 40)
  if (corpo.formacaoEncontrada !== undefined) dados.formacaoEncontrada = corpo.formacaoEncontrada ? 1 : 0

  const nascimento = data(corpo.birthDate)
  if (nascimento !== undefined) dados.birthDate = nascimento
  const inicioRede = data(corpo.dataInicioRede)
  if (inicioRede !== undefined) dados.dataInicioRede = inicioRede

  const institucional = email(corpo.emailInstitucional, 'E-mail institucional')
  if (institucional !== undefined) dados.emailInstitucional = institucional
  const pessoal = email(corpo.emailPessoal, 'E-mail pessoal')
  if (pessoal !== undefined) dados.emailPessoal = pessoal

  if (corpo.status !== undefined) {
    if (!['ativo', 'inativo'].includes(corpo.status)) throw erro(400, 'Status deve ser ativo ou inativo.')
    dados.status = corpo.status
  }

  if (corpo.vinculos !== undefined) {
    if (!Array.isArray(corpo.vinculos)) throw erro(400, 'Vinculos deve ser uma lista.')
    const vinculos = corpo.vinculos
      .map((vinculo) => ({
        inep: texto(vinculo?.inep, 12),
        gre: texto(vinculo?.gre, 60),
        escola: texto(vinculo?.escola, 200),
      }))
      // Linha totalmente em branco no formulario nao vira vinculo vazio no banco.
      .filter((vinculo) => vinculo.inep || vinculo.gre || vinculo.escola)

    if (vinculos.length > MAX_VINCULOS) {
      throw erro(400, `O cadastro aceita no maximo ${MAX_VINCULOS} escolas.`)
    }
    dados.vinculos = vinculos
  }

  return dados
}

/** Cadastro completo para a tela de edicao, com o CPF inteiro. */
async function detalhar({ id, actor, req }) {
  requireMysql()
  const cursista = await repo.findById(id, { fullCpf: true })
  if (!cursista) throw erro(404, 'Cursista nao encontrado.')

  cursista.dependencias = await repo.contarDependencias(id)

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.CADASTRO_ABERTO_ADMIN,
    cursistaId: Number(id),
    req,
  })

  return cursista
}

async function criar({ corpo, actor, req }) {
  requireMysql()
  const dados = montarDados(corpo || {}, { parcial: false })

  const conflito = await repo.encontrarConflito({ cpf: dados.cpf, usuarioId: dados.usuarioId })
  if (conflito) {
    throw erro(409, conflito.campo === 'cpf'
      ? `Este CPF ja esta cadastrado para ${conflito.name}.`
      : `O identificador ${dados.usuarioId} ja pertence a ${conflito.name}.`)
  }

  const conexao = await getPool().getConnection()
  let novoId
  try {
    await conexao.beginTransaction()
    novoId = await repo.criarManual(dados, conexao)
    if (dados.vinculos?.length) await repo.definirVinculos(novoId, dados.vinculos, conexao)
    await conexao.commit()
  } catch (error) {
    await conexao.rollback()
    throw error
  } finally {
    conexao.release()
  }

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.CURSISTA_CRIADO_ADMIN,
    cursistaId: novoId,
    req,
    // Sem CPF nem nome: a trilha aponta o cadastro pelo id.
    details: { origem: 'manual', vinculos: dados.vinculos?.length || 0 },
  })

  return repo.findById(novoId, { fullCpf: true })
}

async function atualizar({ id, corpo, actor, req }) {
  requireMysql()
  const atual = await repo.findRawById(id)
  if (!atual) throw erro(404, 'Cursista nao encontrado.')

  const dados = montarDados(corpo || {}, { parcial: true })

  if (dados.cpf || dados.usuarioId) {
    const conflito = await repo.encontrarConflito({
      cpf: dados.cpf,
      usuarioId: dados.usuarioId,
      exceto: Number(id),
    })
    if (conflito) {
      throw erro(409, conflito.campo === 'cpf'
        ? `Este CPF ja esta cadastrado para ${conflito.name}.`
        : `O identificador ${dados.usuarioId} ja pertence a ${conflito.name}.`)
    }
  }

  const cpfMudou = Boolean(dados.cpf) && dados.cpf !== atual.cpf

  const conexao = await getPool().getConnection()
  let alterados
  try {
    await conexao.beginTransaction()
    alterados = await repo.atualizarPeloAdmin(id, dados, atual, conexao)
    if (dados.vinculos !== undefined) await repo.definirVinculos(id, dados.vinculos, conexao)
    await conexao.commit()
  } catch (error) {
    await conexao.rollback()
    throw error
  } finally {
    conexao.release()
  }

  const base = {
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    cursistaId: Number(id),
    req,
  }

  if (alterados.length > 0 || dados.vinculos !== undefined) {
    await registrar({
      ...base,
      action: ACOES.CURSISTA_EDITADO_ADMIN,
      // Nomes dos campos, nunca os valores.
      details: { campos: alterados, vinculos: dados.vinculos !== undefined },
    })
  }

  // Acao separada: trocar o CPF muda por qual numero a pessoa entra no sistema,
  // e isso precisa ser encontravel na trilha sem ler o detalhe de cada edicao.
  if (cpfMudou) {
    await registrar({
      ...base,
      action: ACOES.CPF_ALTERADO_ADMIN,
      details: { de: maskCpf(atual.cpf), para: maskCpf(dados.cpf) },
    })
  }

  const atualizado = await repo.findById(id, { fullCpf: true })
  return {
    ...atualizado,
    // A tela avisa a pessoa: o login mudou junto.
    cpfAlterado: cpfMudou,
    camposAlterados: alterados,
  }
}

/**
 * Exclui o cadastro.
 *
 * Exclusao de verdade, nao desativacao: a coordenacao pede isto para desfazer
 * cadastro criado por engano, e um registro "inativo" continuaria ocupando o CPF
 * e impedindo o cadastro correto.
 *
 * As inscricoes tem ON DELETE CASCADE e vao junto -- por isso a exclusao de quem
 * tem inscricao exige confirmacao explicita: e a unica parte que nao volta.
 * A auditoria fica, porque foi criada sem FK exatamente para isso.
 */
async function excluir({ id, confirmarInscricoes, actor, req }) {
  requireMysql()
  const cursista = await repo.findById(id)
  if (!cursista) throw erro(404, 'Cursista nao encontrado.')

  const dependencias = await repo.contarDependencias(id)

  if (dependencias.inscricoes > 0 && !confirmarInscricoes) {
    throw erro(409,
      `Este cursista tem ${dependencias.inscricoes} inscricao(oes) registrada(s), que serao apagadas junto. Confirme para prosseguir.`,
      { dependencias, precisaConfirmarInscricoes: true }
    )
  }

  await repo.excluir(id)

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.CURSISTA_EXCLUIDO_ADMIN,
    cursistaId: Number(id),
    req,
    details: {
      origem: cursista.origem,
      inscricoesApagadas: dependencias.inscricoes,
      tinhaSenha: cursista.passwordDefined,
    },
  })

  return { dependencias }
}

module.exports = { detalhar, criar, atualizar, excluir, MAX_VINCULOS }
