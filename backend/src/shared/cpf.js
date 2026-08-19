'use strict'

const crypto = require('crypto')

/**
 * Mantem so os digitos e completa com zeros a esquerda ate 11.
 * O preenchimento cobre o caso classico de base gerada pelo Excel, que trata CPF
 * como numero e come o zero inicial.
 */
function normalizeCpf(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length < 11 ? digits.padStart(11, '0') : digits
}

/**
 * Valida os digitos verificadores. Sem isso, qualquer sequencia de 11 numeros
 * entraria na base e viraria uma conta com senha conhecida.
 */
function isValidCpf(value) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return false
  // Sequencias repetidas (00000000000, 11111111111...) passam no calculo, mas nao existem.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  const digit = (length) => {
    let sum = 0
    for (let i = 0; i < length; i += 1) {
      sum += Number(cpf[i]) * (length + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

/**
 * Mascara para exibicao: 123.456.789-01 -> ***.456.789-**
 * Usada em listagens e logs; o CPF completo so aparece para o proprio titular
 * e nas telas administrativas que realmente precisam dele.
 */
function maskCpf(value) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return ''
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`
}

function formatCpf(value) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return String(value ?? '')
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

/**
 * Comparacao em tempo constante, para a conferencia do CPF como senha de primeiro
 * acesso nao vazar informacao pelo tempo de resposta.
 */
function safeEquals(a, b) {
  const bufferA = Buffer.from(String(a ?? ''), 'utf8')
  const bufferB = Buffer.from(String(b ?? ''), 'utf8')
  if (bufferA.length !== bufferB.length) return false
  return crypto.timingSafeEqual(bufferA, bufferB)
}

module.exports = { normalizeCpf, isValidCpf, maskCpf, formatCpf, safeEquals }
