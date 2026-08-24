'use strict'

const repo = require('./atribuicoes.repo')

/**
 * Quem NAO recebe atividade.
 *
 * Administrador e gerencia coordenam o programa: eles poem atividade na
 * estrutura, nao recebem dela. Qualquer outro perfil recebe -- inclusive um que
 * seja criado depois, sem precisar lembrar de vir editar esta lista.
 */
const PERFIS_QUE_NAO_RECEBEM = ['administrador', 'gerencia']

const TODOS_OS_PERFIS = ['administrador', 'gerencia', 'coordenador', 'supervisor',
  'supervisor_tutoria', 'professor', 'tutor', 'revisor', 'tecnico', 'gestao', 'ti']

const PERFIS_QUE_RECEBEM = TODOS_OS_PERFIS.filter((perfil) => !PERFIS_QUE_NAO_RECEBEM.includes(perfil))

/**
 * Quem atribui PARA QUEM -- a hierarquia do programa.
 *
 * Antes, quem podia atribuir podia atribuir a qualquer um. Agora cada nivel
 * alcanca apenas o nivel abaixo dele, e a atividade desce a estrutura em vez de
 * pular etapas: a coordenacao cobra a supervisao, a supervisao cobra quem
 * produz e quem tutora. Um perfil ausente daqui (professor, revisor, apoio
 * tecnico, tutor) e ponta de linha -- so executa.
 *
 * Duas trilhas paralelas, que e como o sistema ja separa os papeis:
 *
 *   coordenador -> supervisor          -> professor, revisor
 *   coordenador -> supervisor_tutoria  -> tutor
 *
 * 'tecnico' e 'ti' sao o mesmo apoio tecnico com dois nomes: a coordenacao
 * alcanca os dois, e os dois sao ponta de linha. Continuam como perfis
 * separados no sistema porque 'ti' carrega um poder proprio fora daqui -- e
 * quem mexe no status do AVA, em Cursos. Juntar os dois resolveria a duplicidade
 * de nome e tiraria esse poder de quem o tem hoje.
 *
 * Administrador e gerencia alcancam todo mundo. A intencao da coordenacao e que
 * eles atribuam ao coordenador e deixem a hierarquia seguir, mas isso e pratica
 * de trabalho e nao trava de sistema -- eles precisam poder alcancar qualquer
 * perfil quando algo escapa do fluxo normal.
 */
const HIERARQUIA = {
  administrador: PERFIS_QUE_RECEBEM,
  gerencia: PERFIS_QUE_RECEBEM,
  coordenador: ['supervisor', 'supervisor_tutoria', 'revisor', 'professor', 'tecnico', 'ti'],
  supervisor: ['revisor', 'professor'],
  supervisor_tutoria: ['tutor'],
}

const PERFIS_QUE_ATRIBUEM = Object.keys(HIERARQUIA)

/**
 * Quem baixa a planilha do mes inteiro.
 *
 * Administrador e gerencia. A planilha atravessa a hierarquia -- traz todo
 * mundo, de qualquer perfil, sem o recorte que as telas aplicam --, entao ela
 * fica com os dois perfis que ja enxergam o programa inteiro.
 */
const PERFIS_QUE_EXPORTAM = ['administrador', 'gerencia']

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ROTULOS_PERFIL = {
  administrador: 'Administrador',
  gerencia: 'Gerencia',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor(a)',
  tutor: 'Tutor(a)',
  tecnico: 'Apoio tecnico',
  gestao: 'Gestao de Pessoas',
  revisor: 'Revisor(a)',
  supervisor_tutoria: 'Supervisor de tutoria',
  ti: 'TI',
}

const ROTULOS_SITUACAO = {
  cumprido: 'Cumprido',
  nao_cumprido: 'Nao cumprido',
  aguardando_avaliacao: 'Aguardando avaliacao',
  a_fazer: 'A fazer',
}

function erro(mensagem, statusCode = 400) {
  return Object.assign(new Error(mensagem), { statusCode })
}

function podeAtribuir(usuario) {
  return PERFIS_QUE_ATRIBUEM.includes(usuario?.role)
}

/** Os perfis que este usuario alcanca. Lista vazia para quem so executa. */
function perfisAlcancados(usuario) {
  return HIERARQUIA[usuario?.role] || []
}

function podeAtribuirPara(usuario, perfilAlvo) {
  return perfisAlcancados(usuario).includes(perfilAlvo)
}

function podeReceber(usuario) {
  return Boolean(usuario) && !PERFIS_QUE_NAO_RECEBEM.includes(usuario.role)
}

function podeExportar(usuario) {
  return PERFIS_QUE_EXPORTAM.includes(usuario?.role)
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

function validarMes(valor) {
  const mes = String(valor || '').trim()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw erro('Mes de referencia invalido. Use o formato AAAA-MM.')
  return mes
}

function normalizarMes(valor) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(valor || '')) ? String(valor) : mesAtual()
}

/**
 * O prazo precisa cair dentro do mes de referencia.
 *
 * Sem isso da para atribuir em agosto uma atividade com prazo em outubro, que
 * some do relatorio de agosto (onde ela conta) e nao aparece em outubro (onde a
 * pessoa a veria). O item ficaria invisivel para os dois lados.
 */
function validarPrazo(valor, mesReferencia) {
  if (!valor) return null
  const prazo = String(valor).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw erro('Prazo invalido.')
  if (!prazo.startsWith(`${mesReferencia}-`)) {
    throw erro('O prazo precisa estar dentro do mes de referencia da atividade.')
  }
  return prazo
}

function rotuloMes(mes) {
  const [ano, numero] = mes.split('-').map(Number)
  return `${MESES[numero - 1]}/${ano}`
}

/**
 * Cria a atividade para uma pessoa ou para varias de uma vez.
 *
 * A tela agrupa por perfil e deixa marcar todo mundo ou uma pessoa so; para o
 * servidor isso e sempre a mesma coisa -- uma lista de responsaveis. Nao ha
 * "atribuicao de perfil": se um tutor for contratado depois, ele nao herda
 * nada do que foi atribuido antes, e isso e proposital. Herdar em silencio era
 * o comportamento do modulo antigo e ninguem conseguia responder por que
 * alguem tinha uma meta que nunca lhe foi comunicada.
 */
async function criar({ dados, actor, buscarUsuario }) {
  if (!podeAtribuir(actor)) throw erro('Voce nao tem permissao para atribuir atividades.', 403)

  const titulo = String(dados?.titulo || '').trim()
  if (!titulo) throw erro('Informe o titulo da atividade.')
  if (titulo.length > 150) throw erro('O titulo pode ter no maximo 150 caracteres.')

  const mesReferencia = validarMes(dados?.mesReferencia)
  const prazo = validarPrazo(dados?.prazo, mesReferencia)
  const descricao = String(dados?.descricao || '').trim() || null

  const responsavelIds = [...new Set((Array.isArray(dados?.responsavelIds) ? dados.responsavelIds : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))]
  if (responsavelIds.length === 0) throw erro('Selecione ao menos uma pessoa para receber a atividade.')

  const avaliadorId = Number(dados?.avaliadorId)
  if (!Number.isInteger(avaliadorId) || avaliadorId <= 0) throw erro('Escolha quem vai avaliar a atividade.')

  const avaliador = await buscarUsuario(avaliadorId)
  if (!avaliador || avaliador.status !== 'ativo') throw erro('O avaliador escolhido nao esta ativo no sistema.')

  // Conferir um por um, e nao confiar na lista que veio da tela: a tela ja
  // mostra apenas os perfis alcancados, mas quem editar a requisicao conseguiria
  // atribuir para cima da hierarquia se a checagem morasse so no navegador.
  const responsaveis = await Promise.all(responsavelIds.map((id) => buscarUsuario(id)))
  responsaveis.forEach((pessoa, indice) => {
    if (!pessoa || pessoa.status !== 'ativo') {
      throw erro(`A pessoa selecionada (id ${responsavelIds[indice]}) nao esta ativa no sistema.`)
    }
    if (!podeReceber(pessoa)) {
      throw erro(`${pessoa.name} e ${ROTULOS_PERFIL[pessoa.role]} e nao recebe atribuicao.`)
    }
    if (!podeAtribuirPara(actor, pessoa.role)) {
      throw erro(`Voce nao atribui atividade para ${ROTULOS_PERFIL[pessoa.role]}. Seu perfil alcanca: ${perfisAlcancados(actor).map((r) => ROTULOS_PERFIL[r]).join(', ')}.`, 403)
    }
  })

  const ids = await repo.criarParaVarios({
    titulo,
    descricao,
    responsavelIds,
    avaliadorId,
    criadoPor: actor.id,
    mesReferencia,
    prazo,
  })

  return { criadas: ids.length, ids }
}

/** A lista da propria pessoa. Nao existe caminho para ver a lista de outra pessoa por aqui. */
async function listarMinhas({ actor, mes }) {
  const mesReferencia = normalizarMes(mes)
  const itens = await repo.listar({ mes: mesReferencia, responsavelId: actor.id })
  return { mes: mesReferencia, rotuloMes: rotuloMes(mesReferencia), ...resumir(itens), itens }
}

/**
 * A fila de quem avalia, em tres baldes.
 *
 * Antes so vinha o que estava pendente, e quem avaliava perdia de vista o que
 * ja tinha julgado no mes -- nao havia como responder "o que eu decidi sobre
 * essa pessoa semana passada?" sem procurar na tela de outra pessoa.
 *
 *   aguardando    a pessoa marcou como feita e espera o veredito -- o trabalho
 *   avaliadas     o historico do mes, com o que ele mesmo decidiu
 *   naoIniciadas  ninguem marcou ainda; nao ha o que julgar, mas ele precisa
 *                 conseguir ver quem esta parado
 */
async function listarParaAvaliar({ actor, mes }) {
  const mesReferencia = normalizarMes(mes)
  const itens = await repo.listar({ mes: mesReferencia, avaliadorId: actor.id })

  const avaliadas = itens.filter((item) => item.avaliacao)
  const aguardando = itens.filter((item) => !item.avaliacao && item.checkinEm)
  const naoIniciadas = itens.filter((item) => !item.avaliacao && !item.checkinEm)

  return {
    mes: mesReferencia,
    rotuloMes: rotuloMes(mesReferencia),
    aguardando,
    avaliadas,
    naoIniciadas,
    resumo: {
      aguardando: aguardando.length,
      avaliadas: avaliadas.length,
      cumpridas: avaliadas.filter((item) => item.avaliacao === 'cumprido').length,
      naoCumpridas: avaliadas.filter((item) => item.avaliacao === 'nao_cumprido').length,
      naoIniciadas: naoIniciadas.length,
    },
  }
}

function resumir(itens) {
  const total = itens.length
  const cumpridas = itens.filter((item) => item.avaliacao === 'cumprido').length
  const naoCumpridas = itens.filter((item) => item.avaliacao === 'nao_cumprido').length
  const aguardando = itens.filter((item) => item.situacao === 'aguardando_avaliacao').length
  const aFazer = itens.filter((item) => item.situacao === 'a_fazer').length

  return {
    total,
    cumpridas,
    naoCumpridas,
    aguardando,
    aFazer,
    // A frequencia e uma conta, nao uma coluna guardada: cumpridas sobre o total
    // atribuido. Uma regra so, igual em todas as telas.
    frequencia: total ? Math.round((cumpridas / total) * 100) : 0,
  }
}

/**
 * Acompanhamento do mes: uma linha por pessoa que tem atividade atribuida.
 *
 * Quem nao recebeu nada no mes nao aparece -- a tela responde "como foi o mes de
 * quem tinha o que fazer", e listar dezenas de linhas zeradas esconderia
 * justamente as que precisam de atencao.
 */
async function acompanhamento({ actor, mes, role }) {
  if (!podeAtribuir(actor)) throw erro('Sem acesso ao acompanhamento de frequencia.', 403)

  const mesReferencia = normalizarMes(mes)

  // O acompanhamento enxerga exatamente o que o perfil alcanca -- a supervisao
  // ve professores e revisores, nao o mes da coordenacao. Um filtro de perfil
  // fora desse alcance nao amplia nada: ele e cruzado com a lista permitida.
  const alcance = perfisAlcancados(actor)
  const roles = role ? alcance.filter((perfil) => perfil === String(role)) : alcance
  if (roles.length === 0) {
    return { mes: mesReferencia, rotuloMes: rotuloMes(mesReferencia), ...resumir([]), pessoas: [], perfis: alcance }
  }

  const itens = await repo.listar({ mes: mesReferencia, roles })

  const porPessoa = new Map()
  for (const item of itens) {
    const chave = item.responsavel.id
    if (!porPessoa.has(chave)) {
      porPessoa.set(chave, { ...item.responsavel, roleLabel: ROTULOS_PERFIL[item.responsavel.role] || item.responsavel.role, itens: [] })
    }
    porPessoa.get(chave).itens.push(item)
  }

  const pessoas = [...porPessoa.values()]
    .map((pessoa) => ({ ...pessoa, ...resumir(pessoa.itens) }))
    .sort((a, b) => a.frequencia - b.frequencia || a.name.localeCompare(b.name, 'pt-BR'))

  return {
    mes: mesReferencia,
    rotuloMes: rotuloMes(mesReferencia),
    ...resumir(itens),
    // Os perfis que a tela pode oferecer no filtro, vindos do servidor: assim o
    // que aparece no seletor e o que a pessoa realmente alcanca.
    perfis: alcance.map((perfil) => ({ role: perfil, label: ROTULOS_PERFIL[perfil] })),
    pessoas,
  }
}

/**
 * Check-in de quem executa.
 *
 * So o proprio responsavel marca -- se a chefia pudesse marcar por ele, o
 * modulo voltaria a ser o que era: uma pessoa digitando o mes inteiro sozinha.
 */
async function darCheckin({ id, actor, feito, observacao }) {
  const atribuicao = await repo.porId(id)
  if (!atribuicao) throw erro('Atividade nao encontrada.', 404)
  if (atribuicao.responsavel.id !== actor.id) {
    throw erro('Somente quem recebeu a atividade pode marcar que ela foi feita.', 403)
  }
  if (atribuicao.avaliacao) {
    throw erro('Esta atividade ja foi avaliada e nao pode mais ser alterada.', 409)
  }

  return repo.marcarCheckin(id, { feito: Boolean(feito), observacao })
}

/**
 * Veredito de quem avalia.
 *
 * Justificativa obrigatoria no "nao cumprido": e o unico texto que a pessoa
 * avaliada le na tela dela, e um "nao cumprido" seco nao diz o que houve.
 */
async function registrarAvaliacao({ id, actor, avaliacao, observacao }) {
  const atribuicao = await repo.porId(id)
  if (!atribuicao) throw erro('Atividade nao encontrada.', 404)
  if (atribuicao.avaliador.id !== actor.id) {
    throw erro('Somente quem foi designado para avaliar esta atividade pode registrar o resultado.', 403)
  }

  if (!atribuicao.checkinEm) {
    throw erro('A pessoa ainda nao marcou esta atividade como feita.', 409)
  }
  if (!['cumprido', 'nao_cumprido'].includes(avaliacao)) {
    throw erro('Resultado invalido. Use "cumprido" ou "nao_cumprido".')
  }

  const texto = String(observacao || '').trim()
  if (avaliacao === 'nao_cumprido' && !texto) {
    throw erro('Explique o que faltou para a atividade ser considerada cumprida.')
  }

  return repo.avaliar(id, { avaliacao, observacao: texto || null })
}

/** Corrigir a atividade depois de criada. Nao mexe em check-in nem em avaliacao. */
async function editar({ id, actor, dados }) {
  if (!podeAtribuir(actor)) throw erro('Voce nao tem permissao para editar atividades.', 403)

  const atribuicao = await repo.porId(id)
  if (!atribuicao) throw erro('Atividade nao encontrada.', 404)

  const campos = {}
  if (dados.titulo !== undefined) {
    const titulo = String(dados.titulo).trim()
    if (!titulo) throw erro('Informe o titulo da atividade.')
    if (titulo.length > 150) throw erro('O titulo pode ter no maximo 150 caracteres.')
    campos.titulo = titulo
  }
  if (dados.descricao !== undefined) campos.descricao = String(dados.descricao || '').trim() || null
  if (dados.prazo !== undefined) campos.prazo = validarPrazo(dados.prazo, atribuicao.mesReferencia)
  if (dados.avaliadorId !== undefined) {
    const avaliadorId = Number(dados.avaliadorId)
    if (!Number.isInteger(avaliadorId) || avaliadorId <= 0) throw erro('Avaliador invalido.')
    campos.avaliadorId = avaliadorId
  }

  return repo.atualizar(id, campos)
}

async function excluir({ id, actor }) {
  if (!podeAtribuir(actor)) throw erro('Voce nao tem permissao para excluir atividades.', 403)
  const atribuicao = await repo.porId(id)
  if (!atribuicao) throw erro('Atividade nao encontrada.', 404)
  await repo.excluir(id)
}

module.exports = {
  HIERARQUIA,
  PERFIS_QUE_ATRIBUEM,
  PERFIS_QUE_NAO_RECEBEM,
  ROTULOS_PERFIL,
  ROTULOS_SITUACAO,
  podeAtribuir,
  podeAtribuirPara,
  perfisAlcancados,
  podeReceber,
  podeExportar,
  mesAtual,
  normalizarMes,
  rotuloMes,
  resumir,
  criar,
  listarMinhas,
  listarParaAvaliar,
  acompanhamento,
  darCheckin,
  registrarAvaliacao,
  editar,
  excluir,
}
