'use strict'

const { montarCsv } = require('../../shared/csv')
const repo = require('./atribuicoes.repo')
const { ROTULOS_PERFIL, ROTULOS_SITUACAO, normalizarMes, rotuloMes, resumir } = require('./atribuicoes.service')

/**
 * Data para a planilha, em dd/mm/aaaa.
 *
 * "AAAA-MM-DD" (o prazo) e uma data de CALENDARIO, nao um instante. Passar essa
 * string por `new Date` a interpreta como meia-noite em UTC, e converter para
 * Sao Paulo (UTC-3) a puxa para o dia anterior -- um prazo 25/08 sairia 24/08 na
 * planilha. Por isso a data pura e so reordenada, sem passar por fuso nenhum.
 *
 * Os carimbos de check-in e avaliacao sao instantes de verdade e continuam
 * convertidos, que e o certo para eles.
 */
function dataBr(valor) {
  if (!valor) return ''
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

/**
 * Uma linha por atividade, com o perfil e o percentual da pessoa repetidos.
 *
 * Repetir parece redundante lendo de cima a baixo, mas e o que torna o arquivo
 * util: assim ele responde tanto "o que essa pessoa fez" quanto "como foi o
 * perfil inteiro" numa tabela dinamica, sem ninguem precisar cruzar duas abas.
 */
const COLUNAS = [
  { titulo: 'mes', valor: (l) => l.item.mesReferencia },
  { titulo: 'perfil', valor: (l) => ROTULOS_PERFIL[l.item.responsavel.role] || l.item.responsavel.role },
  { titulo: 'pessoa', valor: (l) => l.item.responsavel.name },
  { titulo: 'email', valor: (l) => l.item.responsavel.email || '' },
  { titulo: 'frequencia_da_pessoa_pct', valor: (l) => l.frequenciaPessoa },
  { titulo: 'atividades_atribuidas', valor: (l) => l.totalPessoa },
  { titulo: 'atividades_cumpridas', valor: (l) => l.cumpridasPessoa },
  { titulo: 'atividade', valor: (l) => l.item.titulo },
  { titulo: 'descricao', valor: (l) => l.item.descricao || '' },
  { titulo: 'prazo', valor: (l) => dataBr(l.item.prazo) },
  { titulo: 'marcou_como_feito', valor: (l) => (l.item.checkinEm ? 'Sim' : 'Nao') },
  { titulo: 'data_do_checkin', valor: (l) => dataBr(l.item.checkinEm) },
  { titulo: 'observacao_da_pessoa', valor: (l) => l.item.checkinObs || '' },
  { titulo: 'avaliador', valor: (l) => l.item.avaliador.name },
  { titulo: 'resultado', valor: (l) => ROTULOS_SITUACAO[l.item.situacao] || l.item.situacao },
  { titulo: 'data_da_avaliacao', valor: (l) => dataBr(l.item.avaliadoEm) },
  { titulo: 'justificativa_do_avaliador', valor: (l) => l.item.avaliacaoObs || '' },
  { titulo: 'atribuido_por', valor: (l) => l.item.criadoPor?.name || '' },
]

/**
 * Planilha do mes para o administrador.
 *
 * Ordenada por perfil e, dentro dele, da menor frequencia para a maior: quem
 * precisa de atencao aparece no topo de cada bloco, que e a leitura que a
 * coordenacao faz do relatorio.
 */
async function exportarMes({ mes, role = null }) {
  const mesReferencia = normalizarMes(mes)
  const itens = await repo.listar({
    mes: mesReferencia,
    roles: role ? [String(role)] : null,
  })

  // O percentual e da PESSOA, nao da linha -- por isso resume antes de montar.
  const porPessoa = new Map()
  for (const item of itens) {
    const chave = item.responsavel.id
    if (!porPessoa.has(chave)) porPessoa.set(chave, [])
    porPessoa.get(chave).push(item)
  }

  const linhas = []
  for (const [, itensDaPessoa] of porPessoa) {
    const resumo = resumir(itensDaPessoa)
    for (const item of itensDaPessoa) {
      linhas.push({
        item,
        frequenciaPessoa: resumo.frequencia,
        totalPessoa: resumo.total,
        cumpridasPessoa: resumo.cumpridas,
      })
    }
  }

  linhas.sort((a, b) => {
    const perfilA = ROTULOS_PERFIL[a.item.responsavel.role] || a.item.responsavel.role
    const perfilB = ROTULOS_PERFIL[b.item.responsavel.role] || b.item.responsavel.role
    return perfilA.localeCompare(perfilB, 'pt-BR')
      || a.frequenciaPessoa - b.frequenciaPessoa
      || a.item.responsavel.name.localeCompare(b.item.responsavel.name, 'pt-BR')
      || a.item.titulo.localeCompare(b.item.titulo, 'pt-BR')
  })

  return {
    csv: montarCsv(COLUNAS, linhas),
    nomeArquivo: `frequencia-${mesReferencia}${role ? `-${role}` : ''}.csv`,
    rotulo: rotuloMes(mesReferencia),
    total: linhas.length,
  }
}

module.exports = { exportarMes, COLUNAS }
