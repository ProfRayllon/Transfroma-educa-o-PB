'use strict'

/**
 * Regras do Suporte: quem ve, quem mexe, e o que cada um pode fazer.
 *
 * Dois papeis:
 *   - quem GERE o suporte (perfil `suporte` e o administrador): ve todos os
 *     chamados, encaminha, cancela e reabre;
 *   - quem RECEBE um encaminhamento: ve so os chamados mandados para o perfil
 *     dele ou para ele mesmo, e trabalha neles -- responde, anota, resolve.
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
 * Perfis que podem receber um encaminhamento. Todos os da equipe: quem resolve
 * um problema de certificado nao e quem resolve um de acesso, e a lista certa
 * so o suporte sabe no momento de encaminhar.
 */
const PERFIS_DESTINO = [
  'suporte', 'administrador', 'gerencia', 'coordenador', 'supervisor', 'supervisor_tutoria',
  'professor', 'tutor', 'revisor', 'tecnico', 'gestao', 'ti',
]

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

/** O chamado foi encaminhado a esta pessoa, ou ao perfil dela. */
function recebeuOChamado(ator, chamado) {
  if (!ator || !chamado) return false
  if (chamado.responsavelId != null && Number(chamado.responsavelId) === Number(ator.id)) return true
  return Boolean(chamado.encaminhadoPerfil) && chamado.encaminhadoPerfil === ator.role
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
  erro,
  gereSuporte,
  recebeuOChamado,
  podeVer,
  podeMudarPara,
}
