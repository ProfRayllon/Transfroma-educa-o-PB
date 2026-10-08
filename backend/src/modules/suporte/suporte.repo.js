'use strict'

const { getPool } = require('../../shared/db')
const { maskCpf, formatCpf } = require('../../shared/cpf')
const { STATUS_PENDENTES } = require('./suporte.service')

/**
 * Acesso a dados do Suporte.
 *
 * O recorte de quem ve o que chega pronto do service como `escopo`: este
 * arquivo so traduz em SQL, e nao decide permissao.
 */

const COLUNAS = `
  c.id, c.protocolo, c.nome, c.cpf, c.email, c.categoria, c.descricao, c.status,
  c.encaminhado_perfil, c.responsavel_id, c.resolucao, c.resolvido_em,
  c.criado_em, c.atualizado_em,
  u.name AS responsavel_nome, u.email AS responsavel_email`

function mapear(linha, { cpfCompleto = false } = {}) {
  if (!linha) return null
  return {
    id: linha.id,
    protocolo: linha.protocolo,
    nome: linha.nome,
    cpf: cpfCompleto ? formatCpf(linha.cpf) : maskCpf(linha.cpf),
    email: linha.email,
    categoria: linha.categoria,
    descricao: linha.descricao,
    status: linha.status,
    encaminhadoPerfil: linha.encaminhado_perfil,
    responsavelId: linha.responsavel_id,
    responsavelNome: linha.responsavel_nome || null,
    responsavelEmail: linha.responsavel_email || null,
    resolucao: linha.resolucao,
    resolvidoEm: linha.resolvido_em,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  }
}

/** Protocolo legivel e unico, derivado do id: 2026000123. */
function montarProtocolo(id) {
  return `${new Date().getFullYear()}${String(id).padStart(6, '0')}`
}

async function criar({ nome, cpf, email, categoria, descricao, ip }) {
  const conexao = await getPool().getConnection()
  try {
    await conexao.beginTransaction()
    const [resultado] = await conexao.execute(
      `INSERT INTO suporte_chamados (nome, cpf, email, categoria, descricao, ip)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, cpf, email, categoria, descricao, ip]
    )
    const id = resultado.insertId
    const protocolo = montarProtocolo(id)
    await conexao.execute('UPDATE suporte_chamados SET protocolo = ? WHERE id = ?', [protocolo, id])
    await conexao.execute(
      `INSERT INTO suporte_historico (chamado_id, autor_nome, tipo, mensagem, publico)
       VALUES (?, ?, 'abertura', ?, 1)`,
      [id, nome, 'Chamado aberto pelo solicitante.']
    )
    await conexao.commit()
    return buscar(id)
  } catch (error) {
    await conexao.rollback()
    throw error
  } finally {
    conexao.release()
  }
}

async function buscar(id, opcoes) {
  const [[linha]] = await getPool().execute(
    `SELECT ${COLUNAS} FROM suporte_chamados c
       LEFT JOIN users u ON u.id = c.responsavel_id
      WHERE c.id = ?`,
    [id]
  )
  return mapear(linha, opcoes)
}

/**
 * O WHERE do escopo. `todos` para quem gere o suporte; senao, o que foi
 * encaminhado para a pessoa ou para o perfil dela.
 */
function clausulaDeEscopo(escopo) {
  if (escopo.todos) return { sql: '1 = 1', params: [] }
  return {
    sql: '(c.responsavel_id = ? OR c.encaminhado_perfil = ?)',
    params: [escopo.usuarioId, escopo.perfil],
  }
}

async function listar(escopo, { status, categoria, busca, perfil } = {}) {
  const base = clausulaDeEscopo(escopo)
  const filtros = [base.sql]
  const params = [...base.params]

  if (status === 'pendentes') {
    filtros.push(`c.status IN (${STATUS_PENDENTES.map(() => '?').join(', ')})`)
    params.push(...STATUS_PENDENTES)
  } else if (status) {
    filtros.push('c.status = ?')
    params.push(status)
  }
  if (categoria) {
    filtros.push('c.categoria = ?')
    params.push(categoria)
  }
  if (perfil === 'sem_encaminhamento') {
    filtros.push('c.encaminhado_perfil IS NULL AND c.responsavel_id IS NULL')
  } else if (perfil) {
    filtros.push('c.encaminhado_perfil = ?')
    params.push(perfil)
  }
  if (busca) {
    const digitos = String(busca).replace(/\D/g, '')
    const termo = `%${String(busca).trim()}%`
    const partes = ['c.protocolo LIKE ?', 'c.nome LIKE ?', 'c.email LIKE ?']
    const valores = [termo, termo, termo]
    if (digitos.length >= 3) {
      partes.push('c.cpf LIKE ?')
      valores.push(`%${digitos}%`)
    }
    filtros.push(`(${partes.join(' OR ')})`)
    params.push(...valores)
  }

  const [linhas] = await getPool().execute(
    `SELECT ${COLUNAS} FROM suporte_chamados c
       LEFT JOIN users u ON u.id = c.responsavel_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY FIELD(c.status, 'aberto', 'em_andamento', 'aguardando_solicitante', 'resolvido', 'cancelado'),
               c.criado_em DESC
      LIMIT 500`,
    params
  )

  // Contagem por status sobre o escopo inteiro, sem os filtros da tela: os
  // numeros do topo sao o retrato da fila, e nao do recorte que esta aberto.
  const [contagens] = await getPool().execute(
    `SELECT c.status, COUNT(*) AS total FROM suporte_chamados c
      WHERE ${base.sql} GROUP BY c.status`,
    base.params
  )

  return {
    chamados: linhas.map((l) => mapear(l)),
    totais: Object.fromEntries(contagens.map((c) => [c.status, Number(c.total)])),
  }
}

async function contarPendentes(escopo) {
  const base = clausulaDeEscopo(escopo)
  const [[linha]] = await getPool().execute(
    `SELECT COUNT(*) AS total FROM suporte_chamados c
      WHERE ${base.sql} AND c.status IN (${STATUS_PENDENTES.map(() => '?').join(', ')})`,
    [...base.params, ...STATUS_PENDENTES]
  )
  return Number(linha.total)
}

async function historico(chamadoId, { somentePublico = false } = {}) {
  const [linhas] = await getPool().execute(
    `SELECT id, autor_id, autor_nome, tipo, mensagem, publico, criado_em
       FROM suporte_historico
      WHERE chamado_id = ? ${somentePublico ? 'AND publico = 1' : ''}
      ORDER BY criado_em, id`,
    [chamadoId]
  )
  return linhas.map((l) => ({
    id: l.id,
    autorId: l.autor_id,
    autorNome: l.autor_nome,
    tipo: l.tipo,
    mensagem: l.mensagem,
    publico: Boolean(l.publico),
    criadoEm: l.criado_em,
  }))
}

async function registrarHistorico({ chamadoId, autor = null, tipo, mensagem = null, publico = false }) {
  await getPool().execute(
    `INSERT INTO suporte_historico (chamado_id, autor_id, autor_nome, tipo, mensagem, publico)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [chamadoId, autor?.id ?? null, autor?.name ?? null, tipo, mensagem, publico ? 1 : 0]
  )
}

/** Atualiza so os campos informados. Nomes de coluna vem de uma lista fixa. */
const CAMPOS_ATUALIZAVEIS = {
  status: 'status',
  encaminhadoPerfil: 'encaminhado_perfil',
  responsavelId: 'responsavel_id',
  resolucao: 'resolucao',
}

async function atualizar(id, campos) {
  const sets = []
  const params = []
  for (const [chave, coluna] of Object.entries(CAMPOS_ATUALIZAVEIS)) {
    if (campos[chave] === undefined) continue
    sets.push(`${coluna} = ?`)
    params.push(campos[chave])
  }
  if (campos.status !== undefined) {
    sets.push(campos.status === 'resolvido' ? 'resolvido_em = NOW()' : 'resolvido_em = NULL')
  }
  if (!sets.length) return
  params.push(id)
  await getPool().execute(`UPDATE suporte_chamados SET ${sets.join(', ')} WHERE id = ?`, params)
}

/**
 * O chamado ainda nao concluido deste e-mail, se houver. Concluido e resolvido
 * ou cancelado; os demais status contam como em aberto.
 */
async function buscarEmAbertoPorEmail(email) {
  const [[linha]] = await getPool().execute(
    `SELECT protocolo FROM suporte_chamados
      WHERE email = ? AND status IN (${STATUS_PENDENTES.map(() => '?').join(', ')})
      ORDER BY criado_em DESC
      LIMIT 1`,
    [email, ...STATUS_PENDENTES]
  )
  return linha ? { protocolo: linha.protocolo } : null
}

/** Apaga o chamado; o historico vai junto pela FK com ON DELETE CASCADE. */
async function excluir(id) {
  const [resultado] = await getPool().execute('DELETE FROM suporte_chamados WHERE id = ?', [id])
  return resultado.affectedRows > 0
}

/** A consulta do proprio solicitante: protocolo e CPF precisam bater juntos. */
async function buscarPorProtocoloECpf(protocolo, cpf) {
  const [[linha]] = await getPool().execute(
    `SELECT ${COLUNAS} FROM suporte_chamados c
       LEFT JOIN users u ON u.id = c.responsavel_id
      WHERE c.protocolo = ? AND c.cpf = ?`,
    [protocolo, cpf]
  )
  return mapear(linha)
}

module.exports = {
  criar,
  buscar,
  listar,
  contarPendentes,
  historico,
  registrarHistorico,
  atualizar,
  excluir,
  buscarEmAbertoPorEmail,
  buscarPorProtocoloECpf,
}
