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

const perfilDe = (item) => ROTULOS_PERFIL[item.responsavel.role] || item.responsavel.role
const situacaoDe = (item) => ROTULOS_SITUACAO[item.situacao] || item.situacao

/** Agrupa os itens do mes por pessoa, ja com o resumo de cada uma. */
function agruparPorPessoa(itens) {
  const mapa = new Map()
  for (const item of itens) {
    const chave = item.responsavel.id
    if (!mapa.has(chave)) mapa.set(chave, { pessoa: item.responsavel, itens: [] })
    mapa.get(chave).itens.push(item)
  }

  return [...mapa.values()]
    .map((linha) => ({ ...linha, ...resumir(linha.itens) }))
    .sort((a, b) => perfilDe(a.itens[0]).localeCompare(perfilDe(b.itens[0]), 'pt-BR')
      || a.frequencia - b.frequencia
      || a.pessoa.name.localeCompare(b.pessoa.name, 'pt-BR'))
}

/**
 * Colunas fixas das duas planilhas: quem e a pessoa e como foi o mes dela.
 *
 * Repetidas em cada linha na versao detalhada de proposito -- e o que deixa a
 * tabela dinamica somar por perfil sem ninguem precisar cruzar duas abas.
 */
const COLUNAS_PESSOA = [
  { titulo: 'mes', valor: (l) => l.mes },
  { titulo: 'perfil', valor: (l) => l.perfil },
  { titulo: 'pessoa', valor: (l) => l.pessoa.name },
  { titulo: 'email', valor: (l) => l.pessoa.email || '' },
  { titulo: 'frequencia_pct', valor: (l) => l.frequencia },
  { titulo: 'atividades_atribuidas', valor: (l) => l.total },
  { titulo: 'cumpridas', valor: (l) => l.cumpridas },
  { titulo: 'nao_cumpridas', valor: (l) => l.naoCumpridas },
  { titulo: 'aguardando_avaliacao', valor: (l) => l.aguardando },
  { titulo: 'a_fazer', valor: (l) => l.aFazer },
]

/**
 * Planilha de frequencia: UMA linha por pessoa, atividades nas colunas.
 *
 * E a leitura que a coordenacao faz de verdade -- a mesma forma de um diario de
 * classe, com as pessoas nas linhas e o que foi cobrado nas colunas. Como a
 * atribuicao normalmente vai para o perfil inteiro, os titulos se repetem entre
 * as pessoas e as colunas se alinham sozinhas; celula vazia quer dizer que
 * aquela atividade nao foi atribuida aquela pessoa.
 *
 * As colunas saem das mais compartilhadas para as menos: assim o que vale para
 * o grupo todo fica a esquerda, perto dos totais, e o que e de uma pessoa so
 * cai para a direita em vez de furar a leitura no meio.
 */
function montarMatriz(itens, mes) {
  const quantasPessoas = new Map()
  for (const item of itens) {
    if (!quantasPessoas.has(item.titulo)) quantasPessoas.set(item.titulo, new Set())
    quantasPessoas.get(item.titulo).add(item.responsavel.id)
  }

  const titulos = [...quantasPessoas.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([titulo]) => titulo)

  const colunasAtividades = titulos.map((titulo) => ({
    titulo,
    valor: (linha) => {
      // A mesma pessoa pode ter recebido duas atividades de mesmo titulo no mes
      // (uma correcao, uma repeticao). Juntar em vez de deixar uma sobrescrever
      // a outra -- silenciosamente perder uma linha do relatorio seria pior que
      // uma celula com dois valores.
      const dela = linha.itens.filter((item) => item.titulo === titulo)
      return dela.map(situacaoDe).join(' | ')
    },
  }))

  const colunas = [
    ...COLUNAS_PESSOA,
    { titulo: 'avaliadores', valor: (l) => [...new Set(l.itens.map((i) => i.avaliador.name))].join(' | ') },
    ...colunasAtividades,
  ]

  const linhas = agruparPorPessoa(itens).map((linha) => ({
    ...linha,
    mes,
    perfil: perfilDe(linha.itens[0]),
  }))

  return { colunas, linhas }
}

/**
 * Planilha detalhada: uma linha por atividade.
 *
 * Continua existindo porque a matriz nao tem onde caber o que o avaliador
 * escreveu -- e a justificativa de um "nao cumprido" e exatamente o que a
 * coordenacao vai querer ler quando o percentual chamar atencao.
 */
function montarDetalhada(itens, mes) {
  const colunas = [
    ...COLUNAS_PESSOA,
    { titulo: 'atividade', valor: (l) => l.item.titulo },
    { titulo: 'descricao', valor: (l) => l.item.descricao || '' },
    { titulo: 'prazo', valor: (l) => dataBr(l.item.prazo) },
    { titulo: 'atribuida_em', valor: (l) => dataBr(l.item.criadoEm) },
    { titulo: 'atribuida_por', valor: (l) => l.item.criadoPor?.name || '' },
    { titulo: 'marcou_como_feito', valor: (l) => (l.item.checkinEm ? 'Sim' : 'Nao') },
    { titulo: 'data_do_checkin', valor: (l) => dataBr(l.item.checkinEm) },
    { titulo: 'observacao_da_pessoa', valor: (l) => l.item.checkinObs || '' },
    { titulo: 'avaliador', valor: (l) => l.item.avaliador.name },
    { titulo: 'resultado', valor: (l) => situacaoDe(l.item) },
    { titulo: 'data_da_avaliacao', valor: (l) => dataBr(l.item.avaliadoEm) },
    { titulo: 'justificativa_do_avaliador', valor: (l) => l.item.avaliacaoObs || '' },
  ]

  const linhas = []
  for (const grupo of agruparPorPessoa(itens)) {
    const perfil = perfilDe(grupo.itens[0])
    for (const item of grupo.itens) {
      linhas.push({ ...grupo, mes, perfil, item })
    }
  }

  return { colunas, linhas }
}

const FORMATOS = {
  matriz: montarMatriz,
  detalhado: montarDetalhada,
}

/**
 * Planilha do mes para o administrador.
 *
 * Ordenada por perfil e, dentro dele, da menor frequencia para a maior: quem
 * precisa de atencao aparece no topo de cada bloco, que e a leitura que a
 * coordenacao faz do relatorio.
 */
async function exportarMes({ mes, role = null, formato = 'matriz' }) {
  const mesReferencia = normalizarMes(mes)
  const montar = FORMATOS[formato] || FORMATOS.matriz
  const itens = await repo.listar({
    mes: mesReferencia,
    roles: role ? [String(role)] : null,
  })

  const { colunas, linhas } = montar(itens, mesReferencia)
  const sufixoFormato = formato === 'detalhado' ? '-detalhado' : ''

  return {
    csv: montarCsv(colunas, linhas),
    nomeArquivo: `frequencia-${mesReferencia}${role ? `-${role}` : ''}${sufixoFormato}.csv`,
    rotulo: rotuloMes(mesReferencia),
    total: linhas.length,
  }
}

module.exports = { exportarMes, FORMATOS }
