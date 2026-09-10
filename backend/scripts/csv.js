'use strict'

/**
 * Leitor de CSV conforme a RFC 4180.
 *
 * Escrito a mao, e nao com uma dependencia, porque o que precisa ser lido tem
 * exatamente um caso dificil -- virgula e aspas dentro do texto das perguntas do
 * formulario -- e um `split(',')` engoliria isso em silencio, deslocando as
 * colunas de uma linha so no meio de dez mil. O erro nao apareceria na
 * importacao; apareceria como um numero levemente errado no painel.
 *
 * As regras que importam: campo entre aspas pode conter virgula e quebra de
 * linha, e aspas dentro de campo entre aspas se escrevem duplicadas ("").
 */
/**
 * Descobre se o arquivo usa virgula ou ponto e virgula.
 *
 * O Excel em portugues salva CSV com PONTO E VIRGULA, e as exportacoes deste
 * proprio sistema tambem. Um leitor fixado em virgula nao falha nesses
 * arquivos: ele le a linha inteira como uma coluna so, e o dado entra no banco
 * como "25081454;Monte Horebe" -- errado, sem erro nenhum.
 *
 * A conta e feita so no cabecalho, e fora das aspas: o separador certo e o que
 * mais aparece ali, porque o cabecalho e a unica linha que garantidamente tem
 * um separador entre cada coluna.
 */
function descobrirSeparador(texto) {
  const cabecalho = texto.split('\n')[0]
  let virgulas = 0
  let pontos = 0
  let entreAspas = false
  for (const c of cabecalho) {
    if (c === '"') entreAspas = !entreAspas
    else if (!entreAspas && c === ',') virgulas += 1
    else if (!entreAspas && c === ';') pontos += 1
  }
  return pontos > virgulas ? ';' : ','
}

function lerCsv(texto, separador) {
  // O BOM que o Excel escreve gruda no nome da primeira coluna e faz a busca
  // pelo cabecalho falhar por um caractere invisivel.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1)
  const sep = separador || descobrirSeparador(texto)

  const linhas = []
  let campo = ''
  let linha = []
  let entreAspas = false

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]

    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 1 } else { entreAspas = false }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') { entreAspas = true; continue }
    if (c === sep) { linha.push(campo); campo = ''; continue }
    if (c === '\r') continue
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue }
    campo += c
  }

  // A ultima linha so entra se houver conteudo: arquivo terminado em quebra de
  // linha produziria uma linha vazia que viraria um registro fantasma.
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

/** Transforma o CSV em objetos, usando a primeira linha como cabecalho. */
function lerCsvComCabecalho(texto, separador) {
  const linhas = lerCsv(texto, separador)
  if (!linhas.length) return { colunas: [], registros: [] }

  const colunas = linhas[0].map((c) => c.trim())
  const registros = linhas.slice(1)
    // Linha em branco no fim da planilha e comum e nao e registro.
    .filter((l) => l.some((v) => String(v).trim() !== ''))
    .map((l) => {
      const obj = {}
      colunas.forEach((col, i) => { obj[col] = (l[i] === undefined ? '' : l[i]).trim() })
      return obj
    })

  return { colunas, registros }
}

module.exports = { lerCsv, lerCsvComCabecalho, descobrirSeparador }
