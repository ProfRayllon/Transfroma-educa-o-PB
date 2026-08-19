'use strict'

const repo = require('./cursistas.repo')
const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf } = require('../../shared/cpf')
const { registrar, ACOES } = require('../../shared/audit')

const COLUNAS = [
  'cpf', 'nome_completo', 'data_nascimento', 'email', 'telefone',
  'matricula', 'cargo', 'escola', 'municipio', 'regional',
]

const MAX_LINHAS = 20000

// Lotes de 500 mantem cada consulta pequena o bastante para a VPS (que tem pouca
// RAM livre) e reduzem 13 mil idas ao banco para ~26.
const TAMANHO_DO_LOTE = 500

/**
 * Leitor de CSV com ponto e virgula, tolerante a campos entre aspas.
 * Escrito a mao para nao adicionar dependencia por um formato simples e fixo.
 */
function parseCsv(texto) {
  const limpo = String(texto || '').replace(/^﻿/, '') // remove BOM do Excel
  const linhas = limpo.split(/\r?\n/).filter((linha) => linha.trim() !== '')
  if (linhas.length === 0) return { cabecalho: [], linhas: [] }

  const separar = (linha) => {
    const campos = []
    let atual = ''
    let dentroDeAspas = false

    for (let i = 0; i < linha.length; i += 1) {
      const char = linha[i]
      if (char === '"') {
        if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i += 1 }
        else dentroDeAspas = !dentroDeAspas
      } else if (char === ';' && !dentroDeAspas) {
        campos.push(atual.trim())
        atual = ''
      } else {
        atual += char
      }
    }
    campos.push(atual.trim())
    return campos
  }

  const cabecalho = separar(linhas[0]).map((c) => c.toLowerCase().replace(/\s+/g, '_'))
  return { cabecalho, linhas: linhas.slice(1).map(separar) }
}

function normalizarData(valor) {
  const texto = String(valor || '').trim()
  if (!texto) return null
  // Aceita AAAA-MM-DD e DD/MM/AAAA, os dois formatos que saem do Excel.
  let match = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  return null
}

/**
 * Importa a base oficial.
 *
 * Roda em transacao: ou a base entra inteira, ou nao entra nada. Com ~13 mil
 * registros, uma importacao parcial deixaria o cadastro em estado ambiguo e
 * dificil de reconciliar.
 */
async function importar({ conteudo, actor, req }) {
  requireMysql()

  const { cabecalho, linhas } = parseCsv(conteudo)

  if (cabecalho.length === 0) {
    throw Object.assign(new Error('Arquivo vazio.'), { statusCode: 400 })
  }
  const faltando = ['cpf', 'nome_completo'].filter((coluna) => !cabecalho.includes(coluna))
  if (faltando.length > 0) {
    throw Object.assign(
      new Error(`Colunas obrigatorias ausentes: ${faltando.join(', ')}. Use o modelo em database/import.`),
      { statusCode: 400 }
    )
  }
  if (linhas.length > MAX_LINHAS) {
    throw Object.assign(
      new Error(`O arquivo tem ${linhas.length} linhas; o limite e ${MAX_LINHAS}.`),
      { statusCode: 400 }
    )
  }

  const indice = Object.fromEntries(COLUNAS.map((coluna) => [coluna, cabecalho.indexOf(coluna)]))
  const valor = (linha, coluna) => (indice[coluna] >= 0 ? linha[indice[coluna]] || '' : '')

  const validos = []
  const rejeitados = []
  const cpfsVistos = new Map()

  linhas.forEach((linha, posicao) => {
    const numeroDaLinha = posicao + 2 // +1 do cabecalho, +1 porque planilha comeca em 1
    const cpf = normalizeCpf(valor(linha, 'cpf'))
    const nome = String(valor(linha, 'nome_completo') || '').trim()

    if (!cpf || !isValidCpf(cpf)) {
      rejeitados.push({ linha: numeroDaLinha, motivo: 'CPF invalido' })
      return
    }
    if (!nome) {
      rejeitados.push({ linha: numeroDaLinha, motivo: 'Nome completo vazio' })
      return
    }
    if (cpfsVistos.has(cpf)) {
      rejeitados.push({ linha: numeroDaLinha, motivo: `CPF repetido (ja aparece na linha ${cpfsVistos.get(cpf)})` })
      return
    }
    cpfsVistos.set(cpf, numeroDaLinha)

    validos.push({
      cpf,
      name: nome.slice(0, 150),
      birthDate: normalizarData(valor(linha, 'data_nascimento')),
      email: String(valor(linha, 'email') || '').trim().toLowerCase().slice(0, 150) || null,
      phone: String(valor(linha, 'telefone') || '').replace(/\D/g, '').slice(0, 20) || null,
      registration: String(valor(linha, 'matricula') || '').trim().slice(0, 30) || null,
      position: String(valor(linha, 'cargo') || '').trim().slice(0, 120) || null,
      school: String(valor(linha, 'escola') || '').trim().slice(0, 200) || null,
      municipality: String(valor(linha, 'municipio') || '').trim().slice(0, 120) || null,
      regional: String(valor(linha, 'regional') || '').trim().slice(0, 120) || null,
    })
  })

  let inseridos = 0
  let atualizados = 0

  if (validos.length > 0) {
    const conexao = await getPool().getConnection()
    try {
      await conexao.beginTransaction()
      for (let i = 0; i < validos.length; i += TAMANHO_DO_LOTE) {
        const lote = validos.slice(i, i + TAMANHO_DO_LOTE)
        const resultado = await repo.upsertLoteFromImport(lote, conexao)
        inseridos += resultado.inseridos
        atualizados += resultado.atualizados
      }
      await conexao.commit()
    } catch (error) {
      await conexao.rollback()
      throw error
    } finally {
      conexao.release()
    }
  }

  const resumo = {
    totalLinhas: linhas.length,
    inseridos,
    atualizados,
    rejeitados: rejeitados.length,
    // Amostra para o admin corrigir a origem sem despejar o arquivo inteiro na tela.
    exemplosRejeitados: rejeitados.slice(0, 50),
  }

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.BASE_IMPORTADA,
    req,
    details: { totalLinhas: resumo.totalLinhas, inseridos, atualizados, rejeitados: rejeitados.length },
  })

  return resumo
}

module.exports = { importar, parseCsv }
