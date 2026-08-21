'use strict'

const { getPool, requireMysql } = require('../../shared/db')
const { registrar, ACOES } = require('../../shared/audit')

/**
 * Mapa de colunas da planilha enviada ao AVA.
 *
 * ISOLADO DE PROPOSITO: quando o layout exigido pelo AVA RIEH/PB chegar, basta
 * reescrever este array -- nenhuma outra parte do modulo precisa mudar.
 * `valor` recebe a linha ja carregada do banco.
 */
const COLUNAS_AVA = [
  // AUTH_USER_ID: a base oficial reserva esta coluna para o id do sistema de
  // autenticacao, e e este modulo que o preenche.
  { titulo: 'auth_user_id', valor: (r) => r.id },
  { titulo: 'usuario_id', valor: (r) => r.usuario_id || '' },
  { titulo: 'cpf', valor: (r) => r.cpf },
  { titulo: 'nome_completo', valor: (r) => r.name },
  { titulo: 'email', valor: (r) => r.email_institucional || r.email_pessoal || '' },
  { titulo: 'email_pessoal', valor: (r) => r.email_pessoal || '' },
  { titulo: 'telefone', valor: (r) => r.phone || '' },
  { titulo: 'data_nascimento', valor: (r) => (r.birth_date ? new Date(r.birth_date).toISOString().slice(0, 10) : '') },
  { titulo: 'funcao', valor: (r) => r.funcao || '' },
  { titulo: 'componente_curricular', valor: (r) => r.componente_curricular || '' },
  { titulo: 'gre', valor: (r) => r.gre || '' },
  { titulo: 'escola', valor: (r) => r.escola || '' },
  { titulo: 'inep', valor: (r) => r.inep || '' },
  { titulo: 'curso', valor: (r) => r.course_name },
  { titulo: 'data_inscricao', valor: (r) => (r.enrolled_at ? new Date(r.enrolled_at).toISOString().slice(0, 10) : '') },
]

const data = (valor) => (valor ? new Date(valor).toISOString().slice(0, 10) : '')
const dataHora = (valor) => (valor ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '')
const sim = (valor) => (Number(valor) ? 'Sim' : 'Nao')

/**
 * Planilha completa dos inscritos, para uso da coordenacao.
 *
 * Separada de COLUNAS_AVA de proposito: aquela precisa bater exatamente com o
 * modelo que o AVA exige (ainda por definir), e mistura-las faria a chegada do
 * modelo oficial quebrar este relatorio, ou o contrario.
 *
 * Aqui vai tudo o que o cadastro guarda sobre o cursista, mais o vinculo com a
 * escola e os dados da inscricao.
 */
const COLUNAS_COMPLETO = [
  { titulo: 'curso', valor: (r) => r.course_name },
  { titulo: 'trilha', valor: (r) => r.secondary_trail || '' },
  { titulo: 'edicao', valor: (r) => r.edition },
  { titulo: 'data_inscricao', valor: (r) => dataHora(r.enrolled_at) },
  { titulo: 'cpf', valor: (r) => r.cpf },
  { titulo: 'nome_completo', valor: (r) => r.name },
  { titulo: 'data_nascimento', valor: (r) => data(r.birth_date) },
  { titulo: 'genero', valor: (r) => r.genero || '' },
  { titulo: 'email_institucional', valor: (r) => r.email_institucional || '' },
  { titulo: 'email_pessoal', valor: (r) => r.email_pessoal || '' },
  { titulo: 'telefone', valor: (r) => r.phone || '' },
  { titulo: 'funcao', valor: (r) => r.funcao || '' },
  { titulo: 'componente_curricular', valor: (r) => r.componente_curricular || '' },
  { titulo: 'eixo_tecnologico', valor: (r) => r.eixo_tecnologico || '' },
  { titulo: 'curso_tecnico', valor: (r) => r.curso_tecnico || '' },
  { titulo: 'data_inicio_rede', valor: (r) => data(r.data_inicio_rede) },
  { titulo: 'gre', valor: (r) => r.gre || '' },
  { titulo: 'escola', valor: (r) => r.escola || '' },
  { titulo: 'inep', valor: (r) => r.inep || '' },
  // Quem atua em mais de uma escola tem as demais aqui, para a linha continuar
  // sendo uma por inscricao.
  { titulo: 'outras_escolas', valor: (r) => r.outras_escolas || '' },
  { titulo: 'qtde_vinculos', valor: (r) => r.qtde_vinculos ?? '' },
  { titulo: 'usuario_id', valor: (r) => r.usuario_id || '' },
  { titulo: 'cadastro_confirmado', valor: (r) => sim(r.cadastro_confirmado) },
  { titulo: 'ultimo_acesso', valor: (r) => dataHora(r.last_access_at) },
]

const FORMATOS = { ava: COLUNAS_AVA, completo: COLUNAS_COMPLETO }

/**
 * Escapa o valor para CSV e neutraliza formula de planilha.
 *
 * O `'` inicial e o que impede o Excel/LibreOffice de interpretar a celula como
 * formula. Sem ele, um cursista pode gravar `=...` no proprio e-mail e a formula
 * executa quando o administrador abre a planilha -- que e justamente o arquivo
 * com o CPF de todos os inscritos, na coluna ao lado.
 * Envolver em aspas NAO resolve: o leitor da planilha remove as aspas antes de
 * avaliar o conteudo da celula.
 */
function escaparCsv(valor) {
  let texto = String(valor ?? '')
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Gera a planilha de inscritos para carga no AVA.
 *
 * Esta e a superficie de maior risco do modulo -- um arquivo com o CPF de todos
 * os inscritos. Por isso: restrita a administrador, sempre registrada na trilha
 * de auditoria e nunca acessivel por link publico.
 */
async function exportarInscritos({ courseId = null, edition, formato = 'completo', actor, req }) {
  requireMysql()

  const colunas = FORMATOS[formato] || COLUNAS_COMPLETO

  const params = [edition]
  let filtroCurso = ''
  if (courseId) {
    filtroCurso = 'AND i.course_id = ?'
    params.push(courseId)
  }

  // O vinculo principal (ordem 1) vem por LEFT JOIN e os demais por subconsulta
  // agregada: quem tem mais de uma escola geraria linhas duplicadas num JOIN
  // simples, e a planilha espera uma linha por inscricao.
  const [rows] = await getPool().execute(
    `SELECT c.id, c.usuario_id, c.cpf, c.name, c.email_institucional, c.email_pessoal,
            c.phone, c.birth_date, c.genero, c.funcao, c.componente_curricular,
            c.eixo_tecnologico, c.curso_tecnico, c.data_inicio_rede, c.qtde_vinculos,
            c.cadastro_confirmado, c.last_access_at,
            v.gre, v.escola, v.inep,
            (SELECT GROUP_CONCAT(o.escola ORDER BY o.ordem SEPARATOR ' | ')
               FROM cursista_vinculos o
              WHERE o.cursista_id = c.id AND o.ordem > 1) AS outras_escolas,
            cur.name AS course_name, cur.secondary_trail, i.edition, i.enrolled_at
     FROM inscricoes i
     JOIN cursistas c ON c.id = i.cursista_id
     JOIN courses cur ON cur.id = i.course_id
     LEFT JOIN cursista_vinculos v ON v.cursista_id = c.id AND v.ordem = 1
     WHERE i.status = 'inscrito' AND i.edition = ? ${filtroCurso}
     ORDER BY cur.name, c.name`,
    params
  )

  const linhas = [
    colunas.map((coluna) => coluna.titulo).join(';'),
    ...rows.map((row) => colunas.map((coluna) => escaparCsv(coluna.valor(row))).join(';')),
  ]

  // BOM para o Excel abrir os acentos corretamente.
  const csv = `﻿${linhas.join('\r\n')}\r\n`

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.BASE_EXPORTADA,
    req,
    details: { courseId: courseId ? Number(courseId) : 'todos', edition, formato, registros: rows.length },
  })

  return { csv, total: rows.length }
}

/** Marca as inscricoes como enviadas ao AVA, para acompanhar o que ja foi carregado. */
async function marcarComoExportadas({ courseId, edition }) {
  requireMysql()
  const params = [edition]
  let filtroCurso = ''
  if (courseId) {
    filtroCurso = 'AND course_id = ?'
    params.push(courseId)
  }
  await getPool().execute(
    `UPDATE inscricoes SET exported_at = NOW()
     WHERE status = 'inscrito' AND edition = ? ${filtroCurso}`,
    params
  )
}

module.exports = { exportarInscritos, marcarComoExportadas, COLUNAS_AVA, COLUNAS_COMPLETO, FORMATOS }
