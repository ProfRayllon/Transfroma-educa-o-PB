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

/**
 * Teto para o conteudo descomprimido.
 *
 * ZIP permite razoes de compressao enormes: alguns KB podem virar gigabytes ao
 * inflar. A VPS roda com menos de 1 GB de RAM, entao um arquivo assim derrubaria
 * a API inteira. A base real dos 13 mil, descomprimida, fica na casa das dezenas
 * de MB -- 300 MB e folga larga com protecao efetiva.
 */
const MAX_DESCOMPRIMIDO = 300 * 1024 * 1024

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function escaparXml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function referenciaCelula(linha, coluna) {
  let n = coluna + 1
  let letras = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    letras = String.fromCharCode(65 + resto) + letras
    n = Math.floor((n - 1) / 26)
  }
  return `${letras}${linha + 1}`
}

function criarZip(entradas) {
  const partes = []
  const central = []
  let offset = 0

  for (const entrada of entradas) {
    const nome = Buffer.from(entrada.nome, 'utf8')
    const dados = Buffer.isBuffer(entrada.conteudo) ? entrada.conteudo : Buffer.from(String(entrada.conteudo), 'utf8')
    const comprimido = zlib.deflateRawSync(dados)
    const crc = crc32(dados)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(0, 10)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nome.length, 26)
    local.writeUInt16LE(0, 28)

    partes.push(local, nome, comprimido)

    const cabecalho = Buffer.alloc(46)
    cabecalho.writeUInt32LE(ASSINATURA_CENTRAL, 0)
    cabecalho.writeUInt16LE(20, 4)
    cabecalho.writeUInt16LE(20, 6)
    cabecalho.writeUInt16LE(0x0800, 8)
    cabecalho.writeUInt16LE(8, 10)
    cabecalho.writeUInt32LE(0, 12)
    cabecalho.writeUInt32LE(crc, 16)
    cabecalho.writeUInt32LE(comprimido.length, 20)
    cabecalho.writeUInt32LE(dados.length, 24)
    cabecalho.writeUInt16LE(nome.length, 28)
    cabecalho.writeUInt16LE(0, 30)
    cabecalho.writeUInt16LE(0, 32)
    cabecalho.writeUInt16LE(0, 34)
    cabecalho.writeUInt16LE(0, 36)
    cabecalho.writeUInt32LE(0, 38)
    cabecalho.writeUInt32LE(offset, 42)
    central.push(cabecalho, nome)

    offset += local.length + nome.length + comprimido.length
  }

  const centralOffset = offset
  const centralBuffer = Buffer.concat(central)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(ASSINATURA_FIM_CENTRAL, 0)
  fim.writeUInt16LE(0, 4)
  fim.writeUInt16LE(0, 6)
  fim.writeUInt16LE(entradas.length, 8)
  fim.writeUInt16LE(entradas.length, 10)
  fim.writeUInt32LE(centralBuffer.length, 12)
  fim.writeUInt32LE(centralOffset, 16)
  fim.writeUInt16LE(0, 20)

  return Buffer.concat([...partes, centralBuffer, fim])
}

/**
 * Escritor minimo de .xlsx.
 *
 * Gera uma unica aba com strings inline. E suficiente para relatorios tabulares
 * e evita puxar uma dependencia grande so para exportar a base.
 */
function criarPlanilha({ nomeAba = 'Dados', colunas, linhas }) {
  const cabecalho = colunas.map((coluna) => coluna.titulo)
  const dados = [cabecalho, ...linhas.map((linha) => colunas.map((coluna) => coluna.valor(linha)))]
  const largura = colunas.map((coluna, indice) => {
    const maior = dados.reduce((max, linha) => Math.max(max, String(linha[indice] ?? '').length), 0)
    return Math.min(60, Math.max(10, maior + 2))
  })

  const linhasXml = dados.map((linha, rowIndex) => {
    const celulas = linha.map((valor, colIndex) => {
      let texto = String(valor ?? '')
      if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
      return `<c r="${referenciaCelula(rowIndex, colIndex)}" t="inlineStr"><is><t>${escaparXml(texto)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${celulas}</row>`
  }).join('')

  const cols = largura.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols>${cols}</cols><sheetData>${linhasXml}</sheetData></worksheet>`

  return criarZip([
    { nome: '[Content_Types].xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { nome: '_rels/.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nome: 'xl/workbook.xml', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escaparXml(String(nomeAba).slice(0, 31) || 'Dados')}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: sheet },
  ])
}

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

  // So as partes que o leitor realmente usa sao descomprimidas. Uma planilha pode
  // carregar imagens e outros anexos pesados que nao interessam aqui.
  const INTERESSAM = /^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/

  let totalDescomprimido = 0

  for (let i = 0; i < totalEntradas; i += 1) {
    if (posicao + 46 > buffer.length) break
    if (buffer.readUInt32LE(posicao) !== ASSINATURA_CENTRAL) break

    const metodo = buffer.readUInt16LE(posicao + 10)
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20)
    const tamanhoDescomprimido = buffer.readUInt32LE(posicao + 24)
    const tamanhoNome = buffer.readUInt16LE(posicao + 28)
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30)
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32)
    const inicioLocal = buffer.readUInt32LE(posicao + 42)
    const nome = buffer.toString('utf8', posicao + 46, posicao + 46 + tamanhoNome)

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario

    if (!INTERESSAM.test(nome)) continue

    // O tamanho declarado nao e confiavel, mas serve para recusar cedo o que ja
    // se anuncia grande demais; o total real e conferido depois de inflar.
    totalDescomprimido += tamanhoDescomprimido
    if (totalDescomprimido > MAX_DESCOMPRIMIDO) {
      throw Object.assign(new Error('Planilha grande demais para processar.'), { statusCode: 400 })
    }

    // O cabecalho local repete nome e extra, com tamanhos proprios.
    if (inicioLocal + 30 > buffer.length) continue
    const nomeLocal = buffer.readUInt16LE(inicioLocal + 26)
    const extraLocal = buffer.readUInt16LE(inicioLocal + 28)
    const inicioDados = inicioLocal + 30 + nomeLocal + extraLocal
    const dados = buffer.subarray(inicioDados, inicioDados + tamanhoComprimido)

    const conteudo = metodo === 0
      ? dados
      : zlib.inflateRawSync(dados, { maxOutputLength: MAX_DESCOMPRIMIDO })

    arquivos.set(nome, conteudo)
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
      /*
       * Os atributos param antes de uma "/" que feche a tag. Com `[^>]*` a
       * barra de `<c r="N5" s="3"/>` entrava nos atributos, o `/>` deixava de
       * casar, e o corpo ia buscar o `</c>` da celula SEGUINTE: a celula vazia
       * roubava o valor da vizinha, e a vizinha sumia. Se a vizinha fosse
       * texto, entrava o numero interno dela no lugar do texto.
       *
       * Acontece em toda celula vazia que tenha formatacao -- comum em
       * planilha exportada, onde a coluna inteira tem estilo. Na avaliacao do
       * Google, as 38 pessoas que pularam uma pergunta tiveram a nota geral
       * gravada dentro dela.
       */
      for (const m of linhaXml.matchAll(/<c r="([A-Z]+\d+)"((?:[^>/]|\/(?!>))*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
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

module.exports = { lerPlanilha, normalizarData, criarPlanilha }
