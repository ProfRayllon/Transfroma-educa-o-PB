'use strict'

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const QRCode = require('qrcode')

/**
 * Monta o PDF de um certificado: a arte do curso de fundo e os dados por cima.
 *
 * Nada e guardado. O mesmo registro gera sempre o mesmo certificado, entao o
 * arquivo nasce no clique de baixar e morre na resposta -- 15 mil certificados
 * guardados seriam 4,5 GB por curso; os registros, 3 MB.
 *
 * As posicoes estao no espaco da arte (1600 x 1131, a proporcao do A4 deitado)
 * e sao convertidas para pontos do PDF na hora. Foram tiradas do certificado
 * do Google for Education, para o novo sair igual ao que ja circula. Arte de
 * outro tamanho e esticada para o A4 -- toda arte do programa tem essa proporcao.
 *
 * Fontes: Helvetica e Courier, as padrao do PDF. Nao embutem arquivo nenhum, e
 * a codificacao delas cobre acentos, cedilha, "º" e o travessao do texto.
 */

const LARGURA = 841.89 // A4 deitado, em pontos
const ALTURA = 595.28
const ARTE_L = 1600
const ARTE_A = 1131
const E = LARGURA / ARTE_L // escala arte -> pdf

const BRANCO = rgb(1, 1, 1)
const TEXTO_CLARO = rgb(1, 1, 1)
const TEXTO_CODIGO = rgb(0.93, 0.92, 0.97)
const TEXTO_CARTAO = rgb(0.13, 0.13, 0.16)

const TEXTO_PADRAO =
  '— inscrito(a) no CPF sob o nº {cpf} — concluiu o curso {curso}, ofertado pela Secretaria de Estado ' +
  'da Educação da Paraíba (SEE/PB), por meio do Programa Transforma Educação PB, realizado no período ' +
  'de {periodo}, com carga horária total de {carga} horas.'

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos']

/** 30 -> "trinta". Carga horaria cabe com folga em 1..999. */
function porExtenso(n) {
  n = Math.trunc(Number(n))
  if (!Number.isFinite(n) || n < 0 || n > 999) return String(n)
  if (n < 20) return UNIDADES[n]
  if (n < 100) {
    const resto = n % 10
    return DEZENAS[Math.floor(n / 10)] + (resto ? ` e ${UNIDADES[resto]}` : '')
  }
  if (n === 100) return 'cem'
  const resto = n % 100
  return CENTENAS[Math.floor(n / 100)] + (resto ? ` e ${porExtenso(resto)}` : '')
}

const formatarCpf = (cpf) => String(cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')

/** Troca os campos do texto pelos dados do certificado. */
function preencherTexto(modelo, { cpf, curso, periodo, cargaHoraria }) {
  const valores = {
    cpf: formatarCpf(cpf),
    curso: curso || '',
    periodo: periodo || '',
    carga: cargaHoraria ? `${cargaHoraria} (${porExtenso(cargaHoraria)})` : '',
  }
  return String(modelo || TEXTO_PADRAO).replace(/\{(cpf|curso|periodo|carga)\}/g, (_, campo) => valores[campo])
}

/**
 * Tira do texto o que a fonte padrao nao desenha (emoji, aspas de outras
 * linguas...). Sem isso o pdf-lib lanca erro e o cursista ficaria sem nada.
 */
function compativel(fonte, texto) {
  let saida = ''
  for (const ch of String(texto)) {
    try { fonte.encodeText(ch); saida += ch } catch { saida += ch === '“' || ch === '”' ? '"' : '' }
  }
  return saida
}

/** Quebra o texto em linhas que caibam na largura. */
function quebrarLinhas(texto, fonte, tamanho, largura) {
  const linhas = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = tentativa
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Maior tamanho (ate `maximo`) em que o texto cabe numa linha. */
function tamanhoQueCabe(texto, fonte, maximo, largura, minimo = 6) {
  const medida = fonte.widthOfTextAtSize(texto, maximo)
  return medida <= largura ? maximo : Math.max(minimo, maximo * (largura / medida))
}

/** Texto centrado em `cx`, com a linha de base em `y` -- ambos no espaco da arte. */
function centrado(pagina, texto, { cx, y, fonte, tamanho, cor }) {
  const largura = fonte.widthOfTextAtSize(texto, tamanho)
  pagina.drawText(texto, { x: cx * E - largura / 2, y: ALTURA - y * E, size: tamanho, font: fonte, color: cor })
}

/** Retangulo de cantos arredondados, no espaco da arte. */
function cartao(pagina, { x, y, l, a, raio, cor }) {
  const r = raio
  const caminho = `M ${r} 0 H ${l - r} Q ${l} 0 ${l} ${r} V ${a - r} Q ${l} ${a} ${l - r} ${a} H ${r} Q 0 ${a} 0 ${a - r} V ${r} Q 0 0 ${r} 0 Z`
  // drawSvgPath usa y crescendo para baixo a partir do ponto dado, como a arte.
  pagina.drawSvgPath(caminho, { x: x * E, y: ALTURA - y * E, scale: E, color: cor })
}

/**
 * @param {object} dados
 * @param {Buffer} dados.arte       imagem de fundo (JPEG ou PNG)
 * @param {string} dados.tipoArte   'image/jpeg' | 'image/png'
 * @param {string} dados.nome       nome como sai no certificado
 * @param {string} dados.cpf        11 digitos
 * @param {string} dados.codigo     codigo de validacao
 * @param {string} dados.curso      nome do curso no certificado
 * @param {string} dados.periodo
 * @param {number} dados.cargaHoraria
 * @param {string} [dados.texto]    modelo do texto, com {cpf} {curso} {periodo} {carga}
 * @param {string} dados.urlValidacao  pagina de validacao, sem o codigo
 * @returns {Promise<Buffer>}
 */
async function gerarPdf(dados) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Certificado - ${dados.curso || ''}`)
  pdf.setAuthor('Programa Transforma Educação PB')
  pdf.setCreator('Transforma Educação PB')
  const pagina = pdf.addPage([LARGURA, ALTURA])

  if (dados.arte?.length) {
    // Copia para um bloco proprio. O Buffer que o mysql2 devolve e um recorte de
    // um pacote maior (byteOffset != 0), e o leitor de JPEG do pdf-lib olha o
    // ArrayBuffer inteiro desde o inicio -- nao achava o FFD8 e falhava com
    // "SOI not found". Lido de arquivo o recorte comeca no zero e o erro some,
    // por isso so apareceu em producao.
    const arte = new Uint8Array(dados.arte)
    // JPEG entra como esta, sem decodificar: e o que deixa a geracao barata.
    const imagem = dados.tipoArte === 'image/png' ? await pdf.embedPng(arte) : await pdf.embedJpg(arte)
    pagina.drawImage(imagem, { x: 0, y: 0, width: LARGURA, height: ALTURA })
  }

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)

  // Cartao de verificacao: cobre o da arte (que apontava para o Google) com um
  // novo, no mesmo lugar, levando ao sistema.
  const base = String(dados.urlValidacao || '').replace(/\/+$/, '')
  cartao(pagina, { x: 143, y: 252, l: 337, a: 151, raio: 24, cor: BRANCO })
  const qr = await QRCode.toBuffer(`${base}/${dados.codigo}`, { type: 'png', margin: 0, width: 360, errorCorrectionLevel: 'M' })
  const imagemQr = await pdf.embedPng(new Uint8Array(qr))
  const ladoQr = 112
  pagina.drawImage(imagemQr, { x: 158 * E, y: ALTURA - (271 + ladoQr) * E, width: ladoQr * E, height: ladoQr * E })

  const xTexto = 284
  const larguraTexto = 468 - xTexto
  // Cada linha em pedacos [texto, negrito?], como no cartao original.
  const linhasCartao = [
    [['Para verificar a', false]],
    [['autenticidade deste', false]],
    [['certificado, acesse', false]],
    [['o ', false], ['QR Code', true], [' ou o ', false], ['link', true], [':', false]],
  ]
  linhasCartao.forEach((pedacos, i) => {
    let x = xTexto * E
    for (const [texto, forte] of pedacos) {
      const fonte = forte ? negrito : regular
      pagina.drawText(texto, { x, y: ALTURA - (291 + i * 23) * E, size: 18.5 * E, font: fonte, color: TEXTO_CARTAO })
      x += fonte.widthOfTextAtSize(texto, 18.5 * E)
    }
  })
  const link = base.replace(/^https?:\/\//, '')
  const tamanhoLink = tamanhoQueCabe(link, regular, 13 * E, larguraTexto * E, 4)
  pagina.drawText(link, { x: xTexto * E, y: ALTURA - 381 * E, size: tamanhoLink, font: regular, color: TEXTO_CARTAO })

  centrado(pagina, 'Código de validação:', { cx: 311, y: 432, fonte: mono, tamanho: 19 * E, cor: TEXTO_CODIGO })
  centrado(pagina, dados.codigo, { cx: 311, y: 457, fonte: mono, tamanho: 19 * E, cor: TEXTO_CODIGO })

  centrado(pagina, 'Certificamos que', { cx: 800, y: 450, fonte: regular, tamanho: 25 * E, cor: TEXTO_CLARO })

  const nome = compativel(negrito, String(dados.nome || '').toUpperCase())
  const larguraUtil = 1180 * E
  centrado(pagina, nome, { cx: 800, y: 538, fonte: negrito, tamanho: tamanhoQueCabe(nome, negrito, 44 * E, larguraUtil), cor: TEXTO_CLARO })

  // Texto corrido: centrado em ate 6 linhas; se o texto configurado for longo,
  // a fonte diminui ate caber, em vez de invadir as assinaturas.
  const corpo = compativel(regular, preencherTexto(dados.texto, dados))
  let tamanho = 25 * E
  let linhas = quebrarLinhas(corpo, regular, tamanho, larguraUtil)
  while (linhas.length > 6 && tamanho > 8) {
    tamanho -= 0.5
    linhas = quebrarLinhas(corpo, regular, tamanho, larguraUtil)
  }
  const entre = tamanho * 1.55
  const topo = 682 * E - ((linhas.length - 4) * entre) / 2 // 4 linhas: o layout original
  linhas.forEach((linha, i) => {
    const largura = regular.widthOfTextAtSize(linha, tamanho)
    pagina.drawText(linha, { x: 800 * E - largura / 2, y: ALTURA - topo - i * entre, size: tamanho, font: regular, color: TEXTO_CLARO })
  })

  return Buffer.from(await pdf.save())
}

module.exports = { gerarPdf, preencherTexto, porExtenso, TEXTO_PADRAO }
