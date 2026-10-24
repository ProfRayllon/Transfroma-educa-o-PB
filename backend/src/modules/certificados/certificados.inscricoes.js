'use strict'

const { getPool } = require('../../shared/db')

/**
 * Quem tem certificado valido de um curso fica inscrito nele.
 *
 * Assim o curso aparece em "Meus cursos" da pessoa, ja com o botao do
 * certificado -- e quem concluiu nao precisa ter feito a inscricao pelo sistema
 * (os primeiros cursos rodaram antes dele). Chamado ao gravar a base, ao incluir
 * uma pessoa a mao e ao reativar um certificado; e, pela sincronizacao dos
 * cursos obrigatorios, quando um cursista entra na base depois do certificado.
 *
 * - Liga pelo CPF: o certificado vem de planilha externa e nao conhece o id.
 * - Inscricao cancelada volta a valer: ter o certificado e ter concluido.
 * - `exported_at` ja preenchido: a exportacao de inscricoes alimenta a
 *   matricula no AVA, e curso concluido nao deve gerar matricula nova.
 * - Revogar ou excluir o certificado NAO desfaz a inscricao: a pessoa fez o
 *   curso; so o documento deixou de valer.
 *
 * @returns {Promise<number>} linhas afetadas (novas contam 1, reativadas 2)
 */
async function inscreverPelaBase({ courseId = null, conexao = null } = {}) {
  // Exigido aqui dentro, e nao no topo: cursistas.obrigatorios (que chama esta
  // funcao) e carregado pelo proprio cursistas.service, e o require no topo
  // fecharia um ciclo de modulos.
  const { EDICAO_ATUAL } = require('../cursistas/cursistas.service')
  const alvo = conexao || getPool()
  const [resultado] = await alvo.execute(
    `INSERT INTO inscricoes (cursista_id, course_id, edition, status, exported_at)
     SELECT cu.id, ce.course_id, ?, 'inscrito', NOW()
       FROM certificados ce
       JOIN cursistas cu ON cu.cpf = ce.cpf AND cu.status = 'ativo'
      WHERE ce.status = 'valido' ${courseId ? 'AND ce.course_id = ?' : ''}
     ON DUPLICATE KEY UPDATE
       cancelled_at = IF(inscricoes.status = 'cancelado', NULL, inscricoes.cancelled_at),
       status = IF(inscricoes.status = 'cancelado', 'inscrito', inscricoes.status)`,
    courseId ? [EDICAO_ATUAL, courseId] : [EDICAO_ATUAL]
  )
  return resultado.affectedRows
}

module.exports = { inscreverPelaBase }
