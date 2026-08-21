'use strict'

const zlib = require('zlib')

/**
 * Leitor minimo de .xlsx.
 *
 * Um .xlsx e um ZIP com XML dentro, e o Node ja traz o `zlib` -- entao da para
 * ler a planilha sem acrescentar dependencia ao projeto. Le apenas o necessario:
 * nomes das abas, strings compartilhadas e valores das celulas.
 */

const ASSINATURA_CENTRAL = 0x02014b50
const ASSINATURA_FIM_CENTRAL = 0x06054b50

/** Extrai as entradas do ZIP percorrendo o diretorio central. */
function lerZip(buffer) {
  // O fim do diretorio central fica no rodape; pode haver comentario depois dele.
  let fimCentral = -1
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 22 - 65535; i -= 1) {
    if (buffer.readUInt32LE(i) === ASSINATURA_FIM_CENTRAL) { fimCentral = i; break }
  }
  if (fimCentral === -1) throw Object.assign(new Error('Arquivo nao parece um .xlsx valido.'), { statusCode: 400 })

  const totalEntradas = buffer.readUInt16LE(fimCentral + 10)
  let posicao = buffer.readUInt32LE(fimCentral + 16)
  const arquivos = new Map()

  for (let i = 0; i < totalEntradas; i += 1) {
    if (buffer.readUInt32LE(posicao) !== ASSINATURA_CENTRAL) break

    const metodo = buffer.readUInt16LE(posicao + 10)
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20)
    const tamanhoNome = buffer.readUInt16LE(posicao + 28)
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30)
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32)
    const inicioLocal = buffer.readUInt32LE(posicao + 42)
    const nome = buffer.toString('utf8', posicao + 46, posicao + 46 + tamanhoNome)

    // O cabecalho local repete nome e extra, com tamanhos proprios.
    const nomeLocal = buffer.readUInt16LE(inicioLocal + 26)
    const extraLocal = buffer.readUInt16LE(inicioLocal + 28)
    const inicioDados = inicioLocal + 30 + nomeLocal + extraLocal
    const dados = buffer.subarray(inicioDados, inicioDados + tamanhoComprimido)

    arquivos.set(nome, metodo === 0 ? dados : zlib.inflateRawSync(dados))
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario
  }

  return arquivos
}

function decodificarXml(texto) {
  return String(texto)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCharCode(Number(codigo)))
    .replace(/&amp;/g, '&')
}

/** "AB12" -> indice 27 da coluna (base zero). */
function indiceDaColuna(referencia) {
  const letras = (referencia.match(/^[A-Z]+/) || [''])[0]
  let indice = 0
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64)
  return indice - 1
}

/**
 * Datas no Excel sao numero serial contado de 1899-12-30.
 * Aceita tambem texto ja em AAAA-MM-DD ou DD/MM/AAAA.
 */
function normalizarData(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null

  let match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`

  match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`

  if (/^\d+(\.\d+)?$/.test(texto)) {
    const data = new Date((Number(texto) - 25569) * 86400 * 1000)
    if (!Number.isNaN(data.getTime())) return data.toISOString().slice(0, 10)
  }

  return null
}

/**
 * Le a planilha e devolve, por aba, uma lista de objetos com as colunas do
 * cabecalho como chaves.
 */
function lerPlanilha(buffer) {
  const arquivos = lerZip(buffer)

  const ler = (caminho) => {
    const conteudo = arquivos.get(caminho)
    return conteudo ? conteudo.toString('utf8') : ''
  }

  // Strings compartilhadas: as celulas de texto guardam so o indice.
  const compartilhadas = []
  const ssXml = ler('xl/sharedStrings.xml')
  if (ssXml) {
    for (const si of ssXml.split('<si>').slice(1)) {
      const partes = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1])
      compartilhadas.push(decodificarXml(partes.join('')))
    }
  }

  // Nome da aba -> arquivo da planilha, via workbook + rels.
  const relacoes = new Map()
  for (const m of ler('xl/_rels/workbook.xml.rels').matchAll(/Id="([^"]*)"[^>]*Target="([^"]*)"/g)) {
    relacoes.set(m[1], m[2].replace(/^\/?xl\//, ''))
  }

  const abas = new Map()
  for (const m of ler('xl/workbook.xml').matchAll(/<sheet[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)) {
    const alvo = relacoes.get(m[2])
    if (alvo) abas.set(decodificarXml(m[1]), alvo)
  }

  const resultado = new Map()

  for (const [nomeDaAba, caminho] of abas) {
    const xml = ler(`xl/${caminho}`)
    const linhas = []

    for (const linhaXml of xml.split('<row ').slice(1)) {
      const celulas = []
      for (const m of linhaXml.matchAll(/<c r="([A-Z]+\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const [, referencia, atributos, corpo = ''] = m
        const tipo = (atributos.match(/t="([^"]*)"/) || [])[1]

        let valor = ''
        if (tipo === 's') {
          const indice = (corpo.match(/<v>(\d+)<\/v>/) || [])[1]
          valor = indice !== undefined ? (compartilhadas[Number(indice)] ?? '') : ''
        } else if (tipo === 'inlineStr') {
          valor = decodificarXml((corpo.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || '')
        } else {
          valor = decodificarXml((corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '')
        }

        celulas[indiceDaColuna(referencia)] = valor
      }
      linhas.push(celulas)
    }

    const cabecalho = (linhas[0] || []).map((c) => String(c ?? '').trim())
    const registros = linhas.slice(1)
      .map((linha) => {
        const registro = {}
        cabecalho.forEach((coluna, i) => { if (coluna) registro[coluna] = linha[i] ?? '' })
        return registro
      })
      // Linha em branco no fim da planilha e comum e nao deve virar registro.
      .filter((registro) => Object.values(registro).some((v) => String(v).trim() !== ''))

    resultado.set(nomeDaAba, { cabecalho, registros })
  }

  return resultado
}

module.exports = { lerPlanilha, normalizarData }
