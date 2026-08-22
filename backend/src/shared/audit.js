'use strict'

const { getPool, isMysqlMode } = require('./db')

/**
 * Trilha de auditoria do modulo de cursistas (LGPD).
 *
 * Registra quem fez o que sobre dado pessoal. As acoes de maior risco sao a
 * importacao e a exportacao da base, que tocam os ~13 mil registros de uma vez.
 *
 * Nunca gravar CPF, senha ou qualquer dado pessoal em `details`: a trilha
 * referencia o cursista pelo id.
 */
const ACOES = {
  PRIMEIRO_ACESSO: 'primeiro_acesso',
  LOGIN: 'login',
  LOGIN_FALHA: 'login_falha',
  CONTA_BLOQUEADA: 'conta_bloqueada',
  SENHA_DEFINIDA: 'senha_definida',
  SENHA_ALTERADA: 'senha_alterada',
  SENHA_RESETADA_ADMIN: 'senha_resetada_admin',
  DADOS_ALTERADOS: 'dados_alterados',
  INSCRICAO_CRIADA: 'inscricao_criada',
  INSCRICAO_CANCELADA: 'inscricao_cancelada',
  BASE_IMPORTADA: 'base_importada',
  BASE_EXPORTADA: 'base_exportada',

  // Manutencao do cadastro pela coordenacao. Separadas das acoes do proprio
  // cursista de proposito: quando um dado divergir do que a pessoa informou,
  // a trilha precisa dizer se quem mudou foi ela ou a equipe.
  CURSISTA_CRIADO_ADMIN: 'cursista_criado_admin',
  CURSISTA_EDITADO_ADMIN: 'cursista_editado_admin',
  CURSISTA_EXCLUIDO_ADMIN: 'cursista_excluido_admin',
  // O CPF e o login. Trocar significa que a pessoa entra por outro numero a
  // partir dali, entao merece uma acao propria e nao se dilui em "editado".
  CPF_ALTERADO_ADMIN: 'cpf_alterado_admin',
  // Abrir o cadastro completo expoe o CPF inteiro na tela. Registrar o acesso e
  // o que a LGPD pede de quem trata dado pessoal: saber quem viu o que.
  CADASTRO_ABERTO_ADMIN: 'cadastro_aberto_admin',
}

function clientIp(req) {
  return String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 45) || null
}

/**
 * A auditoria nunca pode derrubar a operacao que ela observa: falha aqui vira
 * log de erro, nao excecao para o usuario.
 */
async function registrar({ actorType, actorId = null, actorLabel = null, action, cursistaId = null, req = null, details = null }) {
  if (!isMysqlMode()) return

  try {
    await getPool().execute(
      `INSERT INTO cursista_auditoria
         (actor_type, actor_id, actor_label, action, cursista_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actorType,
        actorId,
        actorLabel ? String(actorLabel).slice(0, 150) : null,
        action,
        cursistaId,
        req ? clientIp(req) : null,
        req ? String(req.get?.('user-agent') || '').slice(0, 255) || null : null,
        details ? JSON.stringify(details).slice(0, 4000) : null,
      ]
    )
  } catch (error) {
    console.error('[auditoria] falha ao registrar', action, error.message)
  }
}

module.exports = { registrar, ACOES }
