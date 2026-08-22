/**
 * Formatacao dos dados de curso nas telas publicas.
 *
 * Estava dentro do componente da capa porque so ele precisava; com a carga
 * horaria entrando em quatro telas, ficar num modulo proprio evita a terceira
 * copia do mesmo mapa.
 */

// As trilhas chegam do banco sem acento (`Educacao Socioemocional`). O mapa e so
// de exibicao -- trilha nova que apareca no cadastro continua aparecendo, com o
// texto do banco, em vez de sumir da lista.
const NOMES_TRILHA = {
  'Educacao Socioemocional': 'Educação Socioemocional',
  'Educacao, Ciencia e Tecnologia': 'Educação, Ciência e Tecnologia',
  'Area de Ciencias Humanas': 'Ciências Humanas',
  'Area de Matematica e Ciencias da Natureza': 'Matemática e Ciências da Natureza',
  'Area de Linguagens': 'Linguagens',
  'Gestao Pedagogica': 'Gestão Pedagógica',
  'Inclusao, Diversidade e Equidade': 'Inclusão, Diversidade e Equidade',
}

export const nomeTrilha = (valor) => NOMES_TRILHA[valor] || valor || 'Trilha'

/**
 * O que o cursista ve sobre a duracao do curso.
 *
 * Prefere a carga horaria, que e a informacao que interessa a quem vai se
 * inscrever (e o que vai no certificado). Cai para o numero de encontros
 * enquanto a equipe nao tiver preenchido a carga -- melhor mostrar o dado que
 * existe do que uma etiqueta vazia ou "0h".
 *
 * Devolve null quando nao ha nenhum dos dois, para a tela poder omitir a
 * etiqueta inteira em vez de exibir um rotulo sem valor.
 */
/**
 * Quando a inscricao abre ou fecha, em texto.
 *
 * "Em breve" sozinho fez a equipe achar que a data nao tinha salvado: o curso
 * mostrava a etiqueta sem dizer que a janela comecava dali a algumas horas.
 * Dizer a data resolve a duvida antes de ela existir.
 *
 * As datas chegam da API em ISO com fuso; o Date do navegador ja converte para
 * o horario local de quem le.
 */
export function quandoInscricao(curso) {
  const formatar = (valor) => new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  if (curso?.situacao === 'em_breve' && curso.enrollmentOpensAt) {
    return `Inscrições abrem em ${formatar(curso.enrollmentOpensAt)}`
  }
  if (curso?.situacao === 'aberto' && curso.enrollmentClosesAt) {
    return `Inscreva-se até ${formatar(curso.enrollmentClosesAt)}`
  }
  if (curso?.situacao === 'encerrado' && curso.enrollmentClosesAt) {
    return `Inscrições encerradas em ${formatar(curso.enrollmentClosesAt)}`
  }
  return null
}

export function duracaoCurso(curso) {
  if (Number(curso?.workloadHours) > 0) {
    return { texto: `${curso.workloadHours}h`, tipo: 'carga' }
  }
  if (Number(curso?.totalSessions) > 0) {
    const n = Number(curso.totalSessions)
    return { texto: `${n} ${n === 1 ? 'encontro' : 'encontros'}`, tipo: 'encontros' }
  }
  return null
}
