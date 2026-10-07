'use strict'

const nodemailer = require('nodemailer')

/**
 * Envio de e-mail do sistema.
 *
 * Um transporte so, criado na primeira chamada: a configuracao vem do .env e
 * nao muda com a API no ar. Sem SMTP_HOST o envio vira um aviso no log -- o
 * ambiente local e o de testes funcionam sem caixa de e-mail, e quem chamou
 * recebe `false` para registrar que a mensagem nao saiu.
 *
 * Nunca lanca: e-mail e efeito colateral. Um chamado aberto continua aberto
 * mesmo que o servidor de e-mail esteja fora, e o historico do chamado diz que
 * a mensagem falhou.
 */
let transporte = null

function configurado() {
  return Boolean(process.env.SMTP_HOST)
}

function obterTransporte() {
  if (transporte) return transporte
  const porta = Number(process.env.SMTP_PORT) || 587
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : porta === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  })
  return transporte
}

function remetente() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER
}

/** Caixa da equipe que recebe o aviso de cada chamado novo. */
function caixaDaEquipe() {
  return process.env.SUPORTE_EMAIL_EQUIPE || process.env.SMTP_USER || ''
}

/** Escapa texto do usuario antes de entrar no HTML do e-mail. */
function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * @returns {Promise<boolean>} se a mensagem foi aceita pelo servidor SMTP.
 */
async function enviarEmail({ para, assunto, texto, html, responderPara }) {
  if (!para) return false
  if (!configurado()) {
    console.warn(`[email] SMTP nao configurado; mensagem "${assunto}" para ${para} nao enviada.`)
    return false
  }
  try {
    await obterTransporte().sendMail({
      from: remetente(),
      to: para,
      replyTo: responderPara || undefined,
      subject: assunto,
      text: texto,
      html,
    })
    return true
  } catch (error) {
    console.error('[email] falha ao enviar', assunto, error.message)
    return false
  }
}

module.exports = { enviarEmail, escaparHtml, caixaDaEquipe, configurado }
