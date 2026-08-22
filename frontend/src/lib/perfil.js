/**
 * Regras de perfil que a tela precisa conhecer.
 *
 * Espelham o backend, que e quem decide de verdade -- aqui elas existem so para
 * a tela nao oferecer um botao que a API vai recusar. Quando divergirem, quem
 * vale e o backend: o resultado visivel de um erro aqui e um 403 ao clicar, e
 * nao acesso indevido.
 */

/**
 * Perfis com poder total sobre Cursos.
 *
 * 'gerencia' e um administrador restrito a Cursos: dentro desta tela faz tudo o
 * que o administrador faz, e fora dela nao enxerga nada. Equivale a
 * `mandaEmCursos` em backend/src/app.js -- as duas listas precisam andar juntas.
 */
const PERFIS_COM_PODER_EM_CURSOS = ['administrador', 'gerencia']

export const mandaEmCursos = (user) => PERFIS_COM_PODER_EM_CURSOS.includes(user?.role)

/**
 * Telas que cada perfil alcanca.
 *
 * `null` significa "sem restricao de tela" -- o perfil segue as regras de cada
 * pagina, como sempre foi. Uma lista significa que o perfil so entra nesses
 * caminhos, mesmo digitando o endereco na barra do navegador.
 *
 * Existe porque esconder o item do menu nao e restringir: ate aqui, qualquer
 * pessoa autenticada que digitasse /acessos abria a tela. As chamadas de API
 * eram recusadas pelo backend, entao nao havia vazamento de dado -- mas a
 * pessoa via uma tela quebrada em vez de um "nao e para voce".
 */
const TELAS_POR_PERFIL = {
  gerencia: ['/cursos', '/perfil', '/notificacoes'],
}

export function telasPermitidas(user) {
  return TELAS_POR_PERFIL[user?.role] || null
}

/** Primeira tela do perfil, para redirecionar quem entra em caminho proibido. */
export function telaInicial(user) {
  const permitidas = telasPermitidas(user)
  if (permitidas) return permitidas[0]
  return user?.role === 'administrador' ? '/painel' : '/cursos'
}

export function podeAcessar(user, caminho) {
  const permitidas = telasPermitidas(user)
  if (!permitidas) return true
  // Compara pelo inicio para as subrotas acompanharem a tela-mae:
  // /cursos/7/ementa faz parte de Cursos.
  return permitidas.some((tela) => caminho === tela || caminho.startsWith(`${tela}/`))
}

/** Nome de exibicao de cada perfil. */
export const NOMES_DE_PERFIL = {
  administrador: 'Administrador',
  gerencia: 'Gerência',
  coordenador: 'Coordenador',
  supervisor: 'Supervisor',
  professor: 'Professor',
  tutor: 'Tutor',
  tecnico: 'Apoio técnico',
  gestao: 'Gestão de Pessoas',
  revisor: 'Revisor(a)',
  supervisor_tutoria: 'Supervisor de tutoria',
  ti: 'TI',
}
