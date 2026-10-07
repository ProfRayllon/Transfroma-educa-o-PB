/**
 * Nomes e cores do Suporte. Espelha backend/src/modules/suporte/suporte.service.js,
 * que e quem vale: aqui so decide o que desenhar.
 */

export const CATEGORIAS = {
  sistema: 'Sistema (acesso à plataforma)',
  ava: 'Ambiente virtual (AVA)',
  certificado: 'Certificado',
  dados: 'Dados cadastrais',
  duvida: 'Dúvida',
  outro: 'Outro',
}

/** Ajuda curta embaixo de cada categoria no formulario publico. */
export const DICAS_DE_CATEGORIA = {
  sistema: 'Não consigo entrar, senha, primeiro acesso, erro na página.',
  ava: 'Problemas dentro do ambiente virtual: aulas, atividades, acesso gov.br.',
  certificado: 'Emissão, correção ou certificado que não apareceu.',
  dados: 'Nome, CPF, e-mail, escola ou outro dado cadastral errado.',
  duvida: 'Perguntas sobre cursos, inscrições e o programa.',
  outro: 'Qualquer outro assunto.',
}

export const STATUS = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  aguardando_solicitante: 'Aguardando solicitante',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

export const CLASSE_DO_STATUS = {
  aberto: 'badge-danger',
  em_andamento: 'badge-warning',
  aguardando_solicitante: 'badge-blue',
  resolvido: 'badge-success',
  cancelado: 'badge-neutral',
}

export function formatarCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

export function formatarDataHora(valor) {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
