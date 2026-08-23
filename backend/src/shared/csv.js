'use strict'

/**
 * Escapa uma celula de CSV.
 *
 * O `'` inicial e o que impede o Excel/LibreOffice de interpretar a celula como
 * formula. Sem ele, alguem pode gravar `=...` no titulo de uma atividade e a
 * formula executa quando a coordenacao abre a planilha.
 *
 * Envolver em aspas NAO resolve: o leitor remove as aspas antes de avaliar o
 * conteudo da celula.
 */
function escaparCsv(valor) {
  let texto = String(valor ?? '')
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Monta o CSV a partir de uma lista de colunas `{ titulo, valor(linha) }`.
 *
 * Separador `;` e BOM no inicio: e o que faz o Excel em portugues abrir o
 * arquivo com as colunas separadas e os acentos corretos, sem passar pelo
 * assistente de importacao.
 */
function montarCsv(colunas, linhas) {
  const conteudo = [
    colunas.map((coluna) => escaparCsv(coluna.titulo)).join(';'),
    ...linhas.map((linha) => colunas.map((coluna) => escaparCsv(coluna.valor(linha))).join(';')),
  ]
  return `﻿${conteudo.join('\r\n')}\r\n`
}

module.exports = { escaparCsv, montarCsv }
