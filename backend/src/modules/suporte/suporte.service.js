'use strict'

/**
 * Regras do Suporte: quem ve, quem mexe, e o que cada um pode fazer.
 *
 * Dois papeis:
 *   - quem GERE o suporte (perfil `suporte` e o administrador): ve todos os
 *     chamados, encaminha, cancela e reabre;
 *   - quem RECEBE um encaminhamento: ve so os chamados mandados para ele
 *     mesmo, ou para o perfil dele sem pessoa escolhida, e trabalha neles --
 *     responde, anota, resolve. Chamado mandado a um colega do mesmo perfil
 *     nao aparece.
 *
 * Espelhado em frontend/src/lib/suporte.js. Quem vale e este arquivo.
 */

const CATEGORIAS = {
  sistema: 'Sistema (acesso à plataforma)',
  ava: 'Ambiente virtual (AVA)',
  certificado: 'Certificado',
  dados: 'Dados cadastrais',
  duvida: 'Dúvida',
  outro: 'Outro',
}

const STATUS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_solicitante: 'Aguardando solicitante',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

/** Status em que o chamado ainda pede trabalho de alguem. */
const STATUS_PENDENTES = ['aberto', 'em_andamento', 'aguardando_solicitante']

const PERFIS_QUE_GEREM = ['suporte', 'administrador']

/**
 * Perfis que recebem casos encaminhados e tem o Suporte sempre no menu (com
 * os proprios casos, nao a fila inteira). Professor, tutor, revisor e gestao
 * ficam de fora.
 */
const PERFIS_QUE_RECEBEM = ['gerencia', 'coordenador', 'supervisor', 'supervisor_tutoria', 'tecnico', 'ti']

/** Para quem o suporte pode encaminhar: quem gere e quem recebe. */
const PERFIS_DESTINO = [...PERFIS_QUE_GEREM, ...PERFIS_QUE_RECEBEM]

/** Status que quem recebeu o encaminhamento pode aplicar. */
const STATUS_DE_QUEM_RECEBE = ['em_andamento', 'aguardando_solicitante', 'resolvido']

function erro(statusCode, message) {
  const e = new Error(message)
  e.statusCode = statusCode
  return e
}

function gereSuporte(ator) {
  return PERFIS_QUE_GEREM.includes(ator?.role)
}

/** O Suporte aparece no menu mesmo sem caso pendente. */
function temSuporteNoMenu(ator) {
  return gereSuporte(ator) || PERFIS_QUE_RECEBEM.includes(ator?.role)
}

/**
 * O chamado foi encaminhado a esta pessoa, ou ao perfil dela sem pessoa
 * escolhida. Com responsavel definido, so ele ve -- os colegas do perfil nao.
 * Espelha `clausulaDeEscopo` em suporte.repo.js.
 */
function recebeuOChamado(ator, chamado) {
  if (!ator || !chamado) return false
  if (chamado.responsavelId != null) return Number(chamado.responsavelId) === Number(ator.id)
  return Boolean(chamado.encaminhadoPerfil) && chamado.encaminhadoPerfil === ator.role
}

/**
 * Excluir apaga o chamado e o historico de vez -- nao ha lixeira. Fica so com
 * o administrador, e nao com o perfil suporte: quem atende encerra (resolvido
 * ou cancelado), e o registro continua existindo para a prestacao de contas.
 */
function podeExcluir(ator) {
  return ator?.role === 'administrador'
}

function podeVer(ator, chamado) {
  return gereSuporte(ator) || recebeuOChamado(ator, chamado)
}

function podeMudarPara(ator, chamado, status) {
  if (!STATUS[status]) return false
  if (gereSuporte(ator)) return true
  return recebeuOChamado(ator, chamado) && STATUS_DE_QUEM_RECEBE.includes(status)
}

module.exports = {
  CATEGORIAS,
  STATUS,
  STATUS_PENDENTES,
  PERFIS_DESTINO,
  PERFIS_QUE_RECEBEM,
  erro,
  gereSuporte,
  temSuporteNoMenu,
  recebeuOChamado,
  podeVer,
  podeExcluir,
  podeMudarPara,
}
