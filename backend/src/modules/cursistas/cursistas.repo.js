'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, maskCpf } = require('../../shared/cpf')

/**
 * Converte a linha do banco para o objeto exposto pela API.
 *
 * O hash da senha e os contadores de bloqueio nunca saem daqui. O CPF sai
 * mascarado por padrao: completo, so para o proprio titular (`fullCpf`).
 */
function mapCursista(row, { fullCpf = false } = {}) {
  if (!row) return null
  const data = (valor) => (valor ? new Date(valor).toISOString().slice(0, 10) : null)

  return {
    id: row.id,
    usuarioId: row.usuario_id || null,
    cpf: fullCpf ? row.cpf : maskCpf(row.cpf),
    name: row.name,

    // Base oficial: somente leitura para o cursista.
    funcao: row.funcao || '',
    componenteCurricular: row.componente_curricular || '',
    eixoTecnologico: row.eixo_tecnologico || '',
    cursoTecnico: row.curso_tecnico || '',
    formacaoEncontrada: Boolean(row.formacao_encontrada),
    qtdeVinculos: row.qtde_vinculos ?? 1,
    dataInicioRede: data(row.data_inicio_rede),

    // Preenchidos pelo cursista.
    birthDate: data(row.birth_date),
    emailInstitucional: row.email_institucional || '',
    emailPessoal: row.email_pessoal || '',
    phone: row.phone || '',
    genero: row.genero || '',

    status: row.status,
    passwordDefined: Boolean(row.password_hash),
    cadastroConfirmado: Boolean(row.cadastro_confirmado),
    dataConfirmacao: row.data_confirmacao || null,
    firstAccessAt: row.first_access_at || null,
    lastAccessAt: row.last_access_at || null,
  }
}

/** Uso interno da autenticacao -- carrega os campos sensiveis. */
async function findByCpfForAuth(cpf) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT id, cpf, name, status, password_hash, failed_attempts, locked_until,
            first_access_at, cadastro_confirmado
     FROM cursistas WHERE cpf = ? LIMIT 1`,
    [normalizeCpf(cpf)]
  )
  return rows[0] || null
}

async function findByIdForAuth(id) {
  requireMysql()
  const [rows] = await getPool().execute(
    `SELECT id, cpf, name, status, password_hash, failed_attempts, locked_until,
            first_access_at, cadastro_confirmado
     FROM cursistas WHERE id = ? LIMIT 1`,
    [id]
  )
  return rows[0] || null
}

async function listarVinculos(cursistaId) {
  requireMysql()
  const [rows] = await getPool().execute(
    'SELECT ordem, inep, gre, escola FROM cursista_vinculos WHERE cursista_id = ? ORDER BY ordem',
    [cursistaId]
  )
  return rows.map((row) => ({
    ordem: row.ordem,
    inep: row.inep || '',
    gre: row.gre || '',
    escola: row.escola || '',
  }))
}

async function findById(id, options) {
  requireMysql()
  const [rows] = await getPool().execute('SELECT * FROM cursistas WHERE id = ? LIMIT 1', [id])
  if (!rows[0]) return null
  const cursista = mapCursista(rows[0], options)
  cursista.vinculos = await listarVinculos(id)
  return cursista
}

async function setPassword(id, passwordHash) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET password_hash = ?, failed_attempts = 0, locked_until = NULL,
         first_access_at = COALESCE(first_access_at, NOW())
     WHERE id = ?`,
    [passwordHash, id]
  )
}

/**
 * Volta a conta para o estado de primeiro acesso: o CPF passa a valer como senha
 * de novo e a troca sera exigida na proxima entrada.
 *
 * O cadastro ja confirmado e mantido de proposito -- os dados continuam validos,
 * e obrigar a preencher tudo outra vez so porque a pessoa esqueceu a senha seria
 * atrito sem ganho.
 */
async function resetPassword(id) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET password_hash = NULL, failed_attempts = 0, locked_until = NULL, first_access_at = NULL
     WHERE id = ?`,
    [id]
  )
}

async function registerSuccessfulLogin(id) {
  requireMysql()
  await getPool().execute(
    'UPDATE cursistas SET last_access_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = ?',
    [id]
  )
}

/**
 * Conta a tentativa falha e bloqueia temporariamente ao atingir o limite.
 * O bloqueio e por conta; o limite por IP fica no rate limiter da rota.
 */
async function registerFailedLogin(id, { maxAttempts, lockMinutes }) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET failed_attempts = failed_attempts + 1,
         locked_until = IF(failed_attempts + 1 >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
     WHERE id = ?`,
    [maxAttempts, lockMinutes, id]
  )
}

/**
 * Grava os dados que o proprio cursista preenche e confirma o cadastro.
 * Nome, CPF, funcao e vinculos ficam de fora: vem da base oficial.
 */
async function atualizarCadastro(id, dados) {
  requireMysql()
  await getPool().execute(
    `UPDATE cursistas
     SET birth_date = ?, email_institucional = ?, email_pessoal = ?, phone = ?, genero = ?,
         cadastro_confirmado = 1,
         data_confirmacao = COALESCE(data_confirmacao, NOW())
     WHERE id = ?`,
    [
      dados.birthDate || null,
      dados.emailInstitucional || null,
      dados.emailPessoal || null,
      dados.phone || null,
      dados.genero || null,
      id,
    ]
  )
}

/**
 * Insere ou atualiza um lote de cursistas da base oficial.
 *
 * Em lote de proposito: com ~13 mil registros, um INSERT por linha seriam 13 mil
 * idas ao banco (dezenas de segundos, estourando o timeout do proxy e segurando
 * uma transacao longa). Em lotes de 500, sao ~26 consultas.
 *
 * O UPDATE nao toca em password_hash nem em cadastro_confirmado: reimportar a
 * base atualiza cadastro, nunca derruba quem ja acessou. E usa COALESCE nos
 * campos de contato para nao apagar o que o cursista preencheu com o vazio da
 * planilha.
 */
/**
 * `atualizarStatus` so vem verdadeiro quando a planilha realmente tem a coluna
 * ATIVO. Sem ela, o status de quem ja existe fica fora da clausula de
 * atualizacao e e preservado -- importar uma base incompleta nao pode reativar
 * em silencio contas que a coordenacao desativou.
 */
async function upsertLoteFromImport(records, connection, { atualizarStatus = false } = {}) {
  const runner = connection || getPool()
  if (records.length === 0) return { inseridos: 0, atualizados: 0, conflitos: [] }

  // O upsert em lote nao permite saber, linha a linha, o que foi insercao ou
  // atualizacao (affectedRows vem somado), entao conferimos antes quais ja existem.
  const cpfs = records.map((record) => record.cpf)
  const [existentes] = await runner.query('SELECT cpf FROM cursistas WHERE cpf IN (?)', [cpfs])
  const jaExistiam = new Set(existentes.map((row) => row.cpf))

  // usuario_id tambem e chave unica: se o da planilha ja pertence a OUTRO CPF, o
  // upsert atualizaria o cadastro daquela pessoa (nome, e-mails, funcao) em vez
  // de inserir esta -- misturando dado pessoal entre contas. Esses registros sao
  // separados e devolvidos como conflito, nao gravados.
  const usuarioIds = records.map((record) => record.usuarioId).filter(Boolean)
  const donoPorUsuarioId = new Map()
  if (usuarioIds.length > 0) {
    const [rows] = await runner.query(
      'SELECT usuario_id, cpf FROM cursistas WHERE usuario_id IN (?)',
      [usuarioIds]
    )
    rows.forEach((row) => donoPorUsuarioId.set(row.usuario_id, row.cpf))
  }

  const conflitos = []
  const gravaveis = records.filter((record) => {
    const dono = record.usuarioId && donoPorUsuarioId.get(record.usuarioId)
    if (dono && dono !== record.cpf) {
      conflitos.push({ usuarioId: record.usuarioId, cpf: record.cpf })
      return false
    }
    return true
  })

  if (gravaveis.length === 0) {
    return { inseridos: 0, atualizados: 0, conflitos }
  }

  const valores = []
  const placeholders = gravaveis
    .map((record) => {
      valores.push(
        record.usuarioId || null,
        record.cpf,
        record.name,
        record.funcao || null,
        record.componenteCurricular || null,
        record.eixoTecnologico || null,
        record.cursoTecnico || null,
        record.formacaoEncontrada ? 1 : 0,
        record.qtdeVinculos || 1,
        record.dataInicioRede || null,
        record.birthDate || null,
        record.emailInstitucional || null,
        record.emailPessoal || null,
        record.genero || null,
        // Cadastro novo sem a coluna ATIVO na planilha entra como ativo; a
        // preservacao do status de quem ja existe e feita na clausula de
        // atualizacao (ver `atualizarStatus` abaixo).
        record.status || 'ativo'
      )
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    })
    .join(', ')

  await runner.query(
    `INSERT INTO cursistas
       (usuario_id, cpf, name, funcao, componente_curricular, eixo_tecnologico, curso_tecnico,
        formacao_encontrada, qtde_vinculos, data_inicio_rede,
        birth_date, email_institucional, email_pessoal, genero, status)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE
       usuario_id = COALESCE(VALUES(usuario_id), usuario_id),
       name = VALUES(name),
       funcao = VALUES(funcao),
       componente_curricular = VALUES(componente_curricular),
       eixo_tecnologico = VALUES(eixo_tecnologico),
       curso_tecnico = VALUES(curso_tecnico),
       formacao_encontrada = VALUES(formacao_encontrada),
       qtde_vinculos = VALUES(qtde_vinculos),
       data_inicio_rede = COALESCE(VALUES(data_inicio_rede), data_inicio_rede),
       birth_date = COALESCE(birth_date, VALUES(birth_date)),
       email_institucional = COALESCE(VALUES(email_institucional), email_institucional),
       email_pessoal = COALESCE(VALUES(email_pessoal), email_pessoal),
       genero = COALESCE(genero, VALUES(genero))${atualizarStatus ? ',\n       status = VALUES(status)' : ''}`,
    valores
  )

  const atualizados = gravaveis.filter((record) => jaExistiam.has(record.cpf)).length

  return {
    inseridos: gravaveis.length - atualizados,
    atualizados,
    conflitos,
  }
}

/** Regrava os vinculos do lote: a base oficial e a fonte da verdade da lotacao. */
async function substituirVinculos(records, connection) {
  const runner = connection || getPool()
  const comVinculos = records.filter((record) => record.vinculos?.length)
  if (comVinculos.length === 0) return

  const [rows] = await runner.query(
    'SELECT id, cpf FROM cursistas WHERE cpf IN (?)',
    [comVinculos.map((record) => record.cpf)]
  )
  const idPorCpf = new Map(rows.map((row) => [row.cpf, row.id]))
  const ids = [...idPorCpf.values()]
  if (ids.length === 0) return

  await runner.query('DELETE FROM cursista_vinculos WHERE cursista_id IN (?)', [ids])

  const valores = []
  const placeholders = []
  for (const record of comVinculos) {
    const cursistaId = idPorCpf.get(record.cpf)
    if (!cursistaId) continue
    for (const vinculo of record.vinculos) {
      valores.push(cursistaId, vinculo.ordem, vinculo.inep, vinculo.gre, vinculo.escola)
      placeholders.push('(?, ?, ?, ?, ?)')
    }
  }
  if (placeholders.length === 0) return

  await runner.query(
    `INSERT INTO cursista_vinculos (cursista_id, ordem, inep, gre, escola)
     VALUES ${placeholders.join(', ')}`,
    valores
  )
}

async function list({ search = '', status = '', situacao = '', page = 1, perPage = 50 }) {
  requireMysql()
  const filters = []
  const params = []

  if (search) {
    const digits = normalizeCpf(search)
    // Busca por CPF exige o numero completo: busca parcial por CPF viraria uma
    // forma de varrer a base pelos primeiros digitos.
    if (digits.length === 11) {
      filters.push('(name LIKE ? OR cpf = ? OR usuario_id = ?)')
      params.push(`%${search}%`, digits, search)
    } else {
      filters.push('(name LIKE ? OR usuario_id = ?)')
      params.push(`%${search}%`, search)
    }
  }
  if (status) {
    filters.push('status = ?')
    params.push(status)
  }
  // As tres situacoes precisam ser mutuamente exclusivas para os numeros do painel
  // fecharem. O caso que quebra isso e real: o reset de senha pelo admin zera o
  // password_hash mas mantem o cadastro confirmado, entao "completo" tambem exige
  // ter senha definida -- quem foi resetado volta a contar como primeiro acesso.
  if (situacao === 'pendente_primeiro_acesso') filters.push('password_hash IS NULL')
  if (situacao === 'pendente_confirmacao') filters.push('password_hash IS NOT NULL AND cadastro_confirmado = 0')
  if (situacao === 'completo') filters.push('password_hash IS NOT NULL AND cadastro_confirmado = 1')

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const limit = Math.min(Math.max(Number(perPage) || 50, 1), 200)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit

  const [rows] = await getPool().query(
    `SELECT * FROM cursistas ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [[{ total }]] = await getPool().query(
    `SELECT COUNT(*) AS total FROM cursistas ${where}`,
    params
  )

  return { items: rows.map((row) => mapCursista(row)), total, page: Number(page) || 1, perPage: limit }
}

/**
 * Panorama de acesso para a administracao.
 *
 * Só numeros agregados. Acompanhar a adesao nao exige olhar o cadastro de
 * ninguem, e a LGPD pede que o tratamento se limite ao necessario para a
 * finalidade -- por isso nada aqui identifica pessoas.
 */
async function estatisticas() {
  requireMysql()

  const [[totais]] = await getPool().query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'ativo') AS ativos,
       SUM(password_hash IS NULL) AS pendentesPrimeiroAcesso,
       SUM(password_hash IS NOT NULL) AS comSenhaDefinida,
       -- Exige senha definida pelo mesmo motivo do filtro da listagem: quem teve a
       -- senha resetada pelo admin mantem o cadastro confirmado e contaria duas vezes.
       SUM(password_hash IS NOT NULL AND cadastro_confirmado = 1) AS cadastrosConfirmados,
       SUM(locked_until IS NOT NULL AND locked_until > NOW()) AS bloqueadas,
       SUM(last_access_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS ativosUltimos7Dias,
       SUM(email_institucional IS NULL AND email_pessoal IS NULL) AS semEmail,
       SUM(phone IS NULL) AS semTelefone
     FROM cursistas`
  )

  const [porDia] = await getPool().query(
    `SELECT DATE(created_at) AS dia, action, COUNT(*) AS total
     FROM cursista_auditoria
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND action IN ('primeiro_acesso', 'login', 'senha_definida', 'inscricao_criada')
     GROUP BY DATE(created_at), action
     ORDER BY dia`
  )

  const [tentativas] = await getPool().query(
    `SELECT action, COUNT(*) AS total
     FROM cursista_auditoria
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       AND action IN ('login_falha', 'conta_bloqueada')
     GROUP BY action`
  )

  const [[inscricoes]] = await getPool().query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT cursista_id) AS cursistasInscritos
     FROM inscricoes WHERE status = 'inscrito'`
  )

  const numero = (valor) => Number(valor || 0)

  return {
    cadastro: {
      total: numero(totais.total),
      ativos: numero(totais.ativos),
      pendentesPrimeiroAcesso: numero(totais.pendentesPrimeiroAcesso),
      comSenhaDefinida: numero(totais.comSenhaDefinida),
      cadastrosConfirmados: numero(totais.cadastrosConfirmados),
      bloqueadas: numero(totais.bloqueadas),
      ativosUltimos7Dias: numero(totais.ativosUltimos7Dias),
      semEmail: numero(totais.semEmail),
      semTelefone: numero(totais.semTelefone),
    },
    inscricoes: {
      total: numero(inscricoes.total),
      cursistasInscritos: numero(inscricoes.cursistasInscritos),
    },
    seguranca: Object.fromEntries(tentativas.map((linha) => [linha.action, numero(linha.total)])),
    porDia: porDia.map((linha) => ({
      dia: linha.dia instanceof Date ? linha.dia.toISOString().slice(0, 10) : String(linha.dia),
      action: linha.action,
      total: numero(linha.total),
    })),
  }
}

module.exports = {
  mapCursista,
  findByCpfForAuth,
  findByIdForAuth,
  findById,
  listarVinculos,
  setPassword,
  resetPassword,
  registerSuccessfulLogin,
  registerFailedLogin,
  atualizarCadastro,
  upsertLoteFromImport,
  substituirVinculos,
  list,
  estatisticas,
}
