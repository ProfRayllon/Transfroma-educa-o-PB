/**
 * Vocabulario compartilhado pelas telas de Atribuicoes (a "Frequencia").
 *
 * Fica fora das paginas porque as duas leem os mesmos rotulos e a mesma conta de
 * frequencia: duplicar isso foi o que produziu, no modulo antigo, dois numeros
 * de frequencia na mesma tela calculados por regras diferentes.
 */

export const ROTULOS_PERFIL = {
  administrador: 'Administrador',
  gerencia: 'Gerência',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor(a)',
  tutor: 'Tutor(a)',
  tecnico: 'Apoio técnico',
  gestao: 'Gestão de Pessoas',
  revisor: 'Revisor(a)',
  supervisor_tutoria: 'Supervisor de tutoria',
  ti: 'TI',
}

/** Ordem em que os perfis aparecem nos filtros e no seletor de pessoas. */
export const PERFIS_QUE_RECEBEM = [
  'coordenador', 'supervisor', 'supervisor_tutoria', 'professor',
  'tutor', 'revisor', 'tecnico', 'gestao', 'gerencia', 'ti',
]

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

export function rotuloMes(mes) {
  if (!mes) return ''
  const [ano, numero] = mes.split('-').map(Number)
  return `${MESES[numero - 1]}/${ano}`
}

/** O ultimo dia do mes, para limitar o seletor de prazo ao mes de referencia. */
export function ultimoDiaDoMes(mes) {
  if (!mes) return ''
  const [ano, numero] = mes.split('-').map(Number)
  return `${mes}-${String(new Date(ano, numero, 0).getDate()).padStart(2, '0')}`
}

/**
 * Data em dd/mm/aaaa.
 *
 * O prazo chega como "AAAA-MM-DD", que e uma data de CALENDARIO e nao um
 * instante. Passar essa string por `new Date` a interpreta como meia-noite em
 * UTC, e o navegador em Sao Paulo (UTC-3) a exibe como o dia anterior -- um
 * prazo 25/08 apareceria 24/08 para a pessoa. Por isso a data pura e so
 * reordenada, sem passar por fuso nenhum.
 *
 * Check-in e avaliacao chegam como carimbo ISO completo: sao instantes de
 * verdade e continuam convertidos para o fuso de quem le.
 */
export function dataBr(valor) {
  if (!valor) return ''
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soData) return `${soData[3]}/${soData[2]}/${soData[1]}`
  return new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function iniciais(nome = '') {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
}

/**
 * Quanto falta para o prazo, em dias.
 *
 * Positivo e futuro, zero e hoje, negativo e atrasado. Comparado por data pura
 * (sem hora): uma entrega marcada para hoje as 23h nao pode aparecer como
 * atrasada porque o relogio passou das 9h.
 */
export function diasAteOPrazo(prazo) {
  if (!prazo) return null
  const hoje = new Date()
  const referencia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const [ano, mes, dia] = prazo.split('-').map(Number)
  const alvo = new Date(ano, mes - 1, dia)
  return Math.round((alvo - referencia) / 86400000)
}

/**
 * O aviso de prazo que a pessoa ve.
 *
 * So aparece enquanto houver o que fazer -- depois de avaliado o prazo virou
 * historia, e manter "atrasada" em vermelho ao lado de um "Cumprido" seria
 * cobrar por algo que ja foi aceito.
 */
export function avisoDePrazo(item) {
  if (!item.prazo || item.situacao !== 'a_fazer') return null
  const dias = diasAteOPrazo(item.prazo)
  if (dias < 0) return { texto: `Atrasada há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? 's' : ''}`, tom: 'atrasado' }
  if (dias === 0) return { texto: 'Vence hoje', tom: 'hoje' }
  if (dias <= 3) return { texto: `Vence em ${dias} dia${dias !== 1 ? 's' : ''}`, tom: 'proximo' }
  return { texto: `Prazo ${dataBr(item.prazo)}`, tom: 'normal' }
}

export const CLASSES_AVISO_PRAZO = {
  atrasado: 'text-red-600 bg-red-50 border-red-200',
  hoje: 'text-amber-700 bg-amber-50 border-amber-200',
  proximo: 'text-amber-700 bg-amber-50 border-amber-200',
  normal: 'text-gray-500 bg-gray-50 border-gray-200',
}

/** Verde a partir de 70%, ambar a partir de 40%, vermelho abaixo disso. */
export function corDaFrequencia(pct) {
  if (pct >= 70) return { barra: 'bg-green-500', texto: 'text-green-700' }
  if (pct >= 40) return { barra: 'bg-amber-500', texto: 'text-amber-700' }
  return { barra: 'bg-red-500', texto: 'text-red-700' }
}
