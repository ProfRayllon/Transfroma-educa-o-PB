'use strict'

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const repo = require('./cursistas.repo')
const { normalizeCpf, isValidCpf, safeEquals } = require('../../shared/cpf')
const { registrar, ACOES } = require('../../shared/audit')

const JWT_SECRET = process.env.JWT_SECRET
const TOKEN_EXPIRES_IN = process.env.CURSISTA_JWT_EXPIRES_IN || '4h'

/**
 * Publico-alvo do token. O token de cursista carrega audiencia propria e e
 * rejeitado pelo middleware da area interna, e vice-versa: mesmo que um token
 * seja aceito por engano em outra rota, ele nao autentica.
 */
const TOKEN_AUDIENCE = 'cursista'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const MIN_PASSWORD_LENGTH = 8

function assinarToken(cursista) {
  return jwt.sign(
    { id: cursista.id, type: TOKEN_AUDIENCE },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN, audience: TOKEN_AUDIENCE }
  )
}

function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET, { audience: TOKEN_AUDIENCE })
}

function erro(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

/**
 * Regras da senha definida pelo cursista. O CPF e barrado explicitamente: a senha
 * inicial e o CPF, e sem isso o cursista poderia "trocar" a senha para ela mesma.
 */
function validarNovaSenha(senha, cpf) {
  const valor = String(senha || '')
  if (valor.length < MIN_PASSWORD_LENGTH) {
    throw erro(400, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  }
  if (normalizeCpf(valor) === normalizeCpf(cpf) && normalizeCpf(valor).length === 11) {
    throw erro(400, 'A nova senha nao pode ser o seu CPF.')
  }
  if (!/[a-zA-Z]/.test(valor) || !/\d/.test(valor)) {
    throw erro(400, 'A senha deve conter letras e numeros.')
  }
  return valor
}

/**
 * Login do cursista.
 *
 * Enquanto `password_hash` for NULL a conta esta em primeiro acesso e o proprio
 * CPF vale como senha. Depois que a senha e definida, o CPF deixa de autenticar
 * -- a regra vem da ausencia do hash, nao de um flag que alguem possa esquecer
 * de conferir.
 */
async function login({ cpf, senha, req }) {
  const cpfNormalizado = normalizeCpf(cpf)

  // Mesma resposta para CPF invalido, inexistente ou senha errada: nao entregamos
  // ao atacante a informacao de quais CPFs estao na base.
  const credenciaisInvalidas = () => erro(401, 'CPF ou senha incorretos.')

  if (!isValidCpf(cpfNormalizado)) throw credenciaisInvalidas()

  const conta = await repo.findByCpfForAuth(cpfNormalizado)
  if (!conta) throw credenciaisInvalidas()

  // Conta bloqueada e conta inativa so podem ser reveladas DEPOIS que a senha
  // confere. Respondidas antes, elas viram um oraculo: so existem para CPF que
  // esta na base, e qualquer resposta diferente do 401 generico confirma que
  // aquela pessoa e cursista do programa (dado pessoal, LGPD).
  const bloqueada = Boolean(conta.locked_until) && new Date(conta.locked_until) > new Date()

  const primeiroAcesso = !conta.password_hash
  const senhaConfere = primeiroAcesso
    ? safeEquals(normalizeCpf(senha), cpfNormalizado)
    : await bcrypt.compare(String(senha || ''), conta.password_hash)

  if (!senhaConfere) {
    await repo.registerFailedLogin(conta.id, {
      maxAttempts: MAX_FAILED_ATTEMPTS,
      lockMinutes: LOCK_MINUTES,
    })
    await registrar({
      actorType: 'cursista',
      actorId: conta.id,
      action: conta.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS ? ACOES.CONTA_BLOQUEADA : ACOES.LOGIN_FALHA,
      cursistaId: conta.id,
      req,
    })
    throw credenciaisInvalidas()
  }

  // A partir daqui a senha confere, entao o titular provou ser dono da conta e
  // informar o motivo real da recusa nao entrega nada a um atacante.
  if (bloqueada) {
    throw erro(429, 'Muitas tentativas. Tente novamente em alguns minutos.')
  }
  if (conta.status !== 'ativo') {
    throw erro(403, 'Cadastro inativo. Procure a coordenacao do programa.')
  }

  await repo.registerSuccessfulLogin(conta.id)
  await registrar({
    actorType: 'cursista',
    actorId: conta.id,
    action: primeiroAcesso ? ACOES.PRIMEIRO_ACESSO : ACOES.LOGIN,
    cursistaId: conta.id,
    req,
  })

  return {
    token: assinarToken(conta),
    // Com a senha ainda nao definida, o front leva o cursista direto para a troca
    // e o middleware bloqueia qualquer outra rota ate ele concluir.
    precisaDefinirSenha: primeiroAcesso,
    // No primeiro acesso a senha ainda e o CPF, entao os dados pessoais nao saem
    // daqui: seriam entregues a quem apenas adivinhou o CPF. O cliente busca o
    // cadastro em /me depois da troca, que e onde exigirSenhaDefinida ja protege.
    cursista: primeiroAcesso ? null : await repo.findById(conta.id, { fullCpf: true }),
  }
}

/** Definicao da senha no primeiro acesso e troca posterior usam o mesmo caminho. */
async function definirSenha({ cursistaId, senhaAtual, novaSenha, req }) {
  const conta = await repo.findByIdForAuth(cursistaId)
  if (!conta) throw erro(404, 'Cadastro nao encontrado.')

  const primeiroAcesso = !conta.password_hash

  // Na troca comum exigimos a senha atual; no primeiro acesso o cursista acabou de
  // autenticar com o CPF e o token so serve para esta rota.
  if (!primeiroAcesso) {
    const confere = await bcrypt.compare(String(senhaAtual || ''), conta.password_hash)
    if (!confere) throw erro(400, 'Senha atual incorreta.')
  }

  const senha = validarNovaSenha(novaSenha, conta.cpf)
  await repo.setPassword(conta.id, await bcrypt.hash(senha, 10))

  await registrar({
    actorType: 'cursista',
    actorId: conta.id,
    action: primeiroAcesso ? ACOES.SENHA_DEFINIDA : ACOES.SENHA_ALTERADA,
    cursistaId: conta.id,
    req,
  })

  return { token: assinarToken(conta) }
}

module.exports = {
  login,
  definirSenha,
  verificarToken,
  assinarToken,
  validarNovaSenha,
  TOKEN_AUDIENCE,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  MIN_PASSWORD_LENGTH,
}
