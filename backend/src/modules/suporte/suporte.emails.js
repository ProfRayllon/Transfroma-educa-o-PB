'use strict'

const { enviarEmail, escaparHtml, caixaDaEquipe } = require('../../shared/email')
const { CATEGORIAS, STATUS } = require('./suporte.service')

/**
 * As mensagens que o Suporte manda.
 *
 * Todas devolvem se o e-mail saiu, para a rota registrar no historico -- quem
 * atende precisa saber que o solicitante NAO foi avisado, e nao descobrir isso
 * quando ele ligar reclamando.
 */

function linkDeConsulta(chamado) {
  const site = String(process.env.SITE_URL || '').replace(/\/+$/, '')
  if (!site) return ''
  return `${site}/suporte?protocolo=${encodeURIComponent(chamado.protocolo)}`
}

function moldura(titulo, corpoHtml) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f3fa;font-family:Arial,Helvetica,sans-serif;color:#1c1033">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#3b1d7a;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8">Transforma Educação PB · Suporte</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px">${escaparHtml(titulo)}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:22px;line-height:1.55;font-size:15px">
      ${corpoHtml}
    </div>
    <p style="font-size:12px;color:#8a8199;text-align:center;margin-top:14px">
      Mensagem automática. Para falar sobre este chamado, informe sempre o número do protocolo.
    </p>
  </div>
</body></html>`
}

function caixaProtocolo(chamado) {
  return `<div style="background:#f3e8ff;border-radius:10px;padding:12px 16px;margin:16px 0">
    <div style="font-size:12px;color:#6f35b5;text-transform:uppercase;letter-spacing:.1em">Protocolo</div>
    <div style="font-size:24px;font-weight:bold;letter-spacing:.04em">${escaparHtml(chamado.protocolo)}</div>
    <div style="font-size:13px;color:#566176;margin-top:4px">${escaparHtml(CATEGORIAS[chamado.categoria] || chamado.categoria)}</div>
  </div>`
}

function paragrafos(texto) {
  return escaparHtml(texto).replace(/\r?\n/g, '<br>')
}

function botaoConsulta(chamado) {
  const link = linkDeConsulta(chamado)
  if (!link) return ''
  return `<p style="margin-top:20px"><a href="${escaparHtml(link)}" style="display:inline-block;background:#6f35b5;color:#fff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:10px">Acompanhar o chamado</a></p>`
}

/** Para o solicitante, logo depois de abrir. */
function avisarAbertura(chamado) {
  const primeiroNome = String(chamado.nome).split(' ')[0]
  return enviarEmail({
    para: chamado.email,
    assunto: `Chamado de suporte recebido · Protocolo ${chamado.protocolo}`,
    texto: `Olá, ${primeiroNome}.\n\nRecebemos sua solicitação de suporte.\nProtocolo: ${chamado.protocolo}\nAssunto: ${CATEGORIAS[chamado.categoria]}\n\nVocê receberá um e-mail quando houver resposta ou quando o chamado for resolvido.\n${linkDeConsulta(chamado)}`,
    html: moldura('Recebemos sua solicitação', `
      <p>Olá, ${escaparHtml(primeiroNome)}.</p>
      <p>Seu chamado foi registrado. Guarde o número abaixo: com ele e o seu CPF você acompanha o andamento.</p>
      ${caixaProtocolo(chamado)}
      <p style="color:#566176;font-size:14px"><strong>O que você escreveu:</strong><br>${paragrafos(chamado.descricao)}</p>
      <p>Você receberá um e-mail quando houver resposta ou quando o chamado for resolvido.</p>
      ${botaoConsulta(chamado)}`),
  })
}

/** Para a caixa da equipe: um chamado novo chegou. */
function avisarEquipe(chamado) {
  return enviarEmail({
    para: caixaDaEquipe(),
    responderPara: chamado.email,
    assunto: `[Suporte] Novo chamado ${chamado.protocolo} · ${CATEGORIAS[chamado.categoria]}`,
    texto: `Novo chamado ${chamado.protocolo}\nNome: ${chamado.nome}\nE-mail: ${chamado.email}\nCategoria: ${CATEGORIAS[chamado.categoria]}\n\n${chamado.descricao}`,
    html: moldura('Novo chamado de suporte', `
      ${caixaProtocolo(chamado)}
      <p><strong>Solicitante:</strong> ${escaparHtml(chamado.nome)}<br>
         <strong>E-mail:</strong> ${escaparHtml(chamado.email)}</p>
      <p><strong>Descrição:</strong><br>${paragrafos(chamado.descricao)}</p>`),
  })
}

/** Para a pessoa que recebeu o encaminhamento. */
function avisarResponsavel(chamado, { email, nome }, observacao) {
  return enviarEmail({
    para: email,
    assunto: `[Suporte] Chamado ${chamado.protocolo} encaminhado a você`,
    texto: `Olá, ${nome}.\n\nO chamado ${chamado.protocolo} (${CATEGORIAS[chamado.categoria]}) foi encaminhado a você.\n${observacao ? `\nObservação: ${observacao}\n` : ''}\nAcesse o sistema, em Suporte, para atender.`,
    html: moldura('Chamado encaminhado a você', `
      <p>Olá, ${escaparHtml(String(nome).split(' ')[0])}.</p>
      <p>Um chamado de suporte foi encaminhado para você resolver.</p>
      ${caixaProtocolo(chamado)}
      <p><strong>Descrição:</strong><br>${paragrafos(chamado.descricao)}</p>
      ${observacao ? `<p><strong>Observação do suporte:</strong><br>${paragrafos(observacao)}</p>` : ''}
      <p>Acesse o sistema, no menu <strong>Suporte</strong>, para atender.</p>`),
  })
}

/** Uma resposta da equipe ao solicitante. */
function enviarResposta(chamado, mensagem) {
  return enviarEmail({
    para: chamado.email,
    assunto: `Resposta ao seu chamado · Protocolo ${chamado.protocolo}`,
    texto: `Olá, ${chamado.nome}.\n\n${mensagem}\n\nProtocolo: ${chamado.protocolo}\n${linkDeConsulta(chamado)}`,
    html: moldura('Resposta ao seu chamado', `
      <p>Olá, ${escaparHtml(String(chamado.nome).split(' ')[0])}.</p>
      <p>${paragrafos(mensagem)}</p>
      ${caixaProtocolo(chamado)}
      ${botaoConsulta(chamado)}`),
  })
}

/** Resolvido ou cancelado: o fim do chamado. */
function avisarEncerramento(chamado, mensagem) {
  const resolvido = chamado.status === 'resolvido'
  const titulo = resolvido ? 'Seu chamado foi resolvido' : 'Seu chamado foi encerrado'
  return enviarEmail({
    para: chamado.email,
    assunto: `${titulo} · Protocolo ${chamado.protocolo}`,
    texto: `Olá, ${chamado.nome}.\n\n${titulo} (${STATUS[chamado.status]}).\n\n${mensagem || ''}\n\nProtocolo: ${chamado.protocolo}\nSe o problema continuar, abra um novo chamado informando este protocolo.`,
    html: moldura(titulo, `
      <p>Olá, ${escaparHtml(String(chamado.nome).split(' ')[0])}.</p>
      ${mensagem ? `<p>${paragrafos(mensagem)}</p>` : ''}
      ${caixaProtocolo(chamado)}
      <p style="color:#566176;font-size:14px">Se o problema continuar, abra um novo chamado informando este protocolo.</p>`),
  })
}

module.exports = {
  avisarAbertura,
  avisarEquipe,
  avisarResponsavel,
  enviarResposta,
  avisarEncerramento,
}
