'use strict'

/**
 * A GRE num formato so: "1ª GRE".
 *
 * As dezesseis regionais chegam escritas de todo jeito, porque cada formulario
 * e cada exportacao resolveu a seu modo:
 *
 *   "1ª GRE - João Pessoa"   "16° GRE - Santa Rita"   "12ª"
 *   "01ª GRE"                "5a GRE"                 "GRE 7"
 *
 * Sao a MESMA regional escrita de seis maneiras. Enquanto cada uma virar um
 * valor proprio, o seletor do painel lista repetido, o filtro de uma nao acha
 * as linhas da outra, e a soma por regional se parte em pedacos.
 *
 * O padrao escolhido e o que o sistema ja usava: numero sem zero a esquerda,
 * ordinal feminino, espaco, "GRE". O nome da cidade sai -- ele identifica a
 * sede, nao a regional, e "1ª GRE" com e sem "João Pessoa" nunca foram duas
 * coisas diferentes.
 *
 * O que nao for reconhecido volta como chegou, sem virar nada: "Sem GRE" deve
 * continuar sendo "Sem GRE", e um valor estranho precisa aparecer na tela para
 * alguem ver que existe -- sumir em silencio seria pior.
 */

/** Aceita 1 a 16 escrito de qualquer jeito, com ou sem sufixo e cidade. */
const FORMATO = /^0*(\d{1,2})\s*(?:[ªº°o]|a)?\s*(?:GRE\b.*)?$/i

/** "GRE 7" e "GRE - 7": o numero vem depois da sigla. */
const SIGLA_PRIMEIRO = /^GRE\s*[-–—]?\s*0*(\d{1,2})\b.*$/i

function padronizarGre(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null

  const direto = texto.match(FORMATO)
  const invertido = direto ? null : texto.match(SIGLA_PRIMEIRO)
  const numero = Number((direto || invertido || [])[1])

  // Fora de 1..16 nao e regional: e ano, matricula ou lixo que caiu na coluna.
  if (!numero || numero < 1 || numero > 16) return texto

  return `${numero}ª GRE`
}

/**
 * O formato canonico, para quem precisa validar em vez de converter.
 *
 * Sem zero a esquerda: `\d{1,2}` aceitava "01ª GRE" como se ja estivesse
 * certo, e por isso a correcao nunca o tocava -- a regional aparecia duas
 * vezes no filtro, uma como "01ª GRE" e outra como "1ª GRE", cada uma com um
 * pedaco das pessoas. Quem converte sempre soube resolver isso; quem validava
 * e que dizia que nao precisava.
 */
const ehGrePadrao = (valor) => /^[1-9][0-9]?ª GRE$/.test(String(valor ?? ''))

/**
 * Poe as GREs ja gravadas no formato unico -- uma vez, e nunca mais.
 *
 * A base foi importada antes de a conversao existir na entrada, e por isso
 * guarda "1ª GRE - João Pessoa", "16° GRE - Santa Rita" e "12ª" para regionais
 * que o painel precisa somar juntas. Enquanto isso nao for arrumado no banco, o
 * seletor lista a mesma regional tres vezes e cada filtro pega um terco das
 * pessoas.
 *
 * Roda no boot porque o projeto nao tem runner de migracao: um .sql que
 * ninguem executa nao arruma banco nenhum. E barato repetir -- a consulta so
 * devolve o que ainda esta fora do padrao, e depois da primeira vez isso e
 * vazio (ou sao valores que nao dao para converter, como "Sem GRE", que devem
 * mesmo ficar como estao).
 */
async function padronizarGresGravadas(pool, tabela) {
  const [[existe]] = await pool.query(
    `SELECT COUNT(*) AS tem FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [tabela]
  )
  if (!Number(existe.tem)) return

  const [fora] = await pool.query(
    `SELECT DISTINCT gre FROM ${tabela}
      WHERE gre IS NOT NULL AND gre <> '' AND gre NOT REGEXP '^[1-9][0-9]?ª GRE$'`
  )

  for (const linha of fora) {
    const padrao = padronizarGre(linha.gre)
    // So troca o que virou uma das dezesseis. O resto fica visivel na tela, que
    // e como alguem descobre que existe um valor estranho na base.
    if (padrao && padrao !== linha.gre && ehGrePadrao(padrao)) {
      await pool.execute(`UPDATE ${tabela} SET gre = ? WHERE gre = ?`, [padrao, linha.gre])
      console.log(`[gre] "${linha.gre}" -> "${padrao}" em ${tabela}`)
    }
  }
}

module.exports = { padronizarGre, ehGrePadrao, padronizarGresGravadas }
