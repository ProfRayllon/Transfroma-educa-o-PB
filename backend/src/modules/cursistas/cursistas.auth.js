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

/**
 * Senha de primeiro acesso, igual para toda a base.
 *
 * So existe na variavel de ambiente, sem valor de reserva no codigo. Um fallback
 * aqui teria dois problemas: publicaria a senha no repositorio (que e publico) e,
 * pior, faria o sistema aceitar em silencio um valor conhecido caso alguem
 * esquecesse de configurar a variavel no servidor.
 *
 * Sem a variavel definida, o primeiro acesso falha fechado -- nenhuma conta e
 * aberta por engano. Quem ja definiu a propria senha nao e afetado: aquele
 * caminho usa bcrypt contra o hash gravado e nao passa por aqui.
 *
 * Estar em variavel tambem permite trocar o valor sem deploy, por edicao ou se
 * ele vazar.
 */
const SENHA_PADRAO = process.env.CURSISTA_SENHA_PADRAO || ''

if (!SENHA_PADRAO) {
  console.warn(
    '[cursistas] CURSISTA_SENHA_PADRAO nao definida: o primeiro acesso vai recusar ' +
    'qualquer senha ate a variavel ser configurada no .env do servidor.'
  )
}

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
 * Regras da senha definida pelo cursista.
 *
 * A senha padrao e o CPF sao barrados explicitamente: a padrao e publica (vai
 * para 13 mil pessoas) e o CPF acabou de ser digitado no login. Sem essas duas
 * recusas, a "troca" de senha poderia nao trocar nada.
 */
function validarNovaSenha(senha, cpf) {
  const valor = String(senha || '')
  if (valor.length < MIN_PASSWORD_LENGTH) {
    throw erro(400, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  }
  if (safeEquals(valor, SENHA_PADRAO)) {
    throw erro(400, 'A nova senha nao pode ser a senha padrao de primeiro acesso.')
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
 * Enquanto `password_hash` for NULL a conta esta em primeiro acesso e vale a
 * senha padrao da edicao. Depois que o cursista define a propria senha, a padrao
 * deixa de autenticar aquela conta -- a regra vem da ausencia do hash, nao de um
 * flag que alguem possa esquecer de conferir.
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

  // A guarda de SENHA_PADRAO vazia vem ANTES da comparacao, e nao pode virar um
  // safeEquals a mais: `timingSafeEqual` entre dois buffers vazios devolve TRUE,
  // entao, sem variavel configurada, uma senha vazia abriria qualquer conta que
  // ainda esta em primeiro acesso.
  const senhaConfere = primeiroAcesso
    ? Boolean(SENHA_PADRAO) && safeEquals(String(senha || ''), SENHA_PADRAO)
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
  SENHA_PADRAO,
  TOKEN_AUDIENCE,
  MAX_FAILED_ATTEMPTS,
  LOCK_MINUTES,
  MIN_PASSWORD_LENGTH,
}
