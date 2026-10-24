'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { registrar, ACOES } = require('../../shared/audit')
const { EDICAO_ATUAL } = require('./cursistas.service')
const { inscreverPelaBase } = require('../certificados/certificados.inscricoes')

/**
 * Cursos de inscricao obrigatoria: todo cursista ativo da base fica inscrito,
 * automaticamente, e nao pode cancelar.
 *
 * Ligar a opcao inscreve a base inteira de uma vez. Quem entra na base depois
 * (importacao ou cadastro manual) e inscrito por `sincronizar`, chamado ao fim
 * dessas duas operacoes. Desligar so tira a obrigatoriedade: as inscricoes
 * feitas continuam, e voltam a poder ser canceladas dentro da janela.
 *
 * O administrador ainda consegue cancelar uma inscricao obrigatoria pela tela
 * do cursista -- e a excecao consciente, e a sincronizacao nao a desfaz.
 */

function erro(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

/**
 * Inscreve os cursistas ativos nos cursos obrigatorios (ou so no curso dado).
 * Linha que ja existe nao e tocada -- nem a cancelada pelo administrador.
 * @returns {Promise<number>} quantas inscricoes novas entraram
 */
async function sincronizar({ courseId = null, conexao = null } = {}) {
  const alvo = conexao || getPool()
  const [resultado] = await alvo.execute(
    `INSERT INTO inscricoes (cursista_id, course_id, edition, status)
     SELECT cu.id, c.id, ?, 'inscrito'
       FROM cursistas cu
       JOIN courses c ON c.inscricao_obrigatoria = 1 ${courseId ? 'AND c.id = ?' : ''}
      WHERE cu.status = 'ativo'
     ON DUPLICATE KEY UPDATE course_id = inscricoes.course_id`,
    courseId ? [EDICAO_ATUAL, courseId] : [EDICAO_ATUAL]
  )
  // Quem entra na base depois do certificado ja emitido ganha a inscricao do
  // curso concluido (so na sincronizacao geral, que e a de cadastro/importacao).
  if (!courseId) await inscreverPelaBase({ conexao })
  // Com ON DUPLICATE KEY, linha nova conta 1 e linha existente sem mudanca, 0.
  return resultado.affectedRows
}

/** Liga ou desliga a obrigatoriedade de um curso. */
async function definir({ courseId, ativo, actor, req }) {
  requireMysql()
  if (!Number.isInteger(courseId) || courseId <= 0) throw erro(400, 'Curso invalido.')
  const [[curso]] = await getPool().execute('SELECT id, name FROM courses WHERE id = ?', [courseId])
  if (!curso) throw erro(404, 'Curso nao encontrado.')

  await getPool().execute('UPDATE courses SET inscricao_obrigatoria = ? WHERE id = ?', [ativo ? 1 : 0, courseId])
  const inscritos = ativo ? await sincronizar({ courseId }) : 0

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ativo ? ACOES.CURSO_OBRIGATORIO_LIGADO : ACOES.CURSO_OBRIGATORIO_DESLIGADO,
    req,
    details: { courseId, edition: EDICAO_ATUAL, inscritos },
  })

  return { courseId, curso: curso.name, obrigatorio: Boolean(ativo), inscritos }
}

/** Ids dos cursos obrigatorios, para a tela marcar. */
async function listar() {
  requireMysql()
  const [linhas] = await getPool().execute('SELECT id FROM courses WHERE inscricao_obrigatoria = 1')
  return linhas.map((l) => l.id)
}

module.exports = { sincronizar, definir, listar }
