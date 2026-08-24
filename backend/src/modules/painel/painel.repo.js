'use strict'

const { getPool, requireMysql } = require('../../shared/db')

/**
 * As consultas do dashboard.
 *
 * Regra unica deste modulo: daqui so sai AGREGADO. Nenhuma consulta devolve
 * linha de cursista -- sao treze mil pessoas, e um painel que trafega a base
 * inteira para contar por GRE seria lento no servidor, pesado na rede e um
 * problema de LGPD na tela. Todo recorte que a tela oferece ja vem somado.
 *
 * ─── O filtro de curso ───
 * Quase toda consulta aceita `cursoId`. Quando ele vem, o universo deixa de ser
 * "a base" e passa a ser "quem se inscreveu naquele curso" -- e a conta muda de
 * significado, nao so de tamanho. As duas coisas que NAO se filtram por curso
 * estao marcadas onde aparecem: o funil (mede a base inteira, ate a inscricao) e
 * a serie de logins (um login nao pertence a curso nenhum).
 */

const numero = (valor) => Number(valor || 0)

/** DATE do MySQL lido como data local, sem passar por ISO/UTC. */
function dia(valor) {
  if (!valor) return null
  if (typeof valor === 'string') return valor.slice(0, 10)
  const d = new Date(valor)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * O recorte por curso, como pedaco de SQL reutilizavel.
 *
 * EXISTS em vez de JOIN de proposito: quem tem dois vinculos de escola apareceria
 * duas vezes num JOIN com inscricoes, e a contagem de pessoas sairia inflada.
 */
function filtroDeCurso(cursoId, aliasCursista = 'c') {
  if (!cursoId) return { sql: '', params: [] }
  return {
    sql: ` AND EXISTS (SELECT 1 FROM inscricoes i
                        WHERE i.cursista_id = ${aliasCursista}.id
                          AND i.course_id = ?
                          AND i.status = 'inscrito')`,
    params: [cursoId],
  }
}

/* ─── Indicadores do topo ─── */

async function totais({ cursoId = null, dias = 30 } = {}) {
  requireMysql()
  const pool = getPool()
  const curso = filtroDeCurso(cursoId)

  const [[pessoas]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(c.status = 'ativo') AS ativos,
       SUM(c.password_hash IS NOT NULL) AS comSenha,
       SUM(c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1) AS confirmados,
       SUM(c.last_access_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS acessaramNaJanela
     FROM cursistas c
     WHERE 1 = 1${curso.sql}`,
    [dias, ...curso.params]
  )

  /**
   * Escolas: as duas pontas da mesma conta.
   *
   * `total` e o universo que este sistema conhece -- toda escola que aparece em
   * algum vinculo da base oficial. `alcancadas` e quantas delas ja tem alguem
   * engajado: com cadastro confirmado, ou inscrito no curso quando ha filtro.
   *
   * O denominador NAO e o total de escolas da rede estadual: esse numero nao
   * existe no banco. Enquanto nao existir, o percentual daqui responde "das
   * escolas que temos na base, quantas se mexeram" -- e nao "que fracao da rede
   * o programa cobre", que e outra pergunta.
   */
  const [[escolas]] = await pool.query(
    'SELECT COUNT(DISTINCT escola) AS total, COUNT(DISTINCT gre) AS gres FROM cursista_vinculos'
  )
  const [[alcance]] = await pool.query(
    `SELECT COUNT(DISTINCT v.escola) AS alcancadas
       FROM cursista_vinculos v
       JOIN cursistas c ON c.id = v.cursista_id
      WHERE ${cursoId ? '1 = 1' : 'c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1'}${curso.sql}`,
    curso.params
  )

  const [[cursos]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(status_ava = 'publicado') AS publicados FROM courses"
  )
  const [[equipe]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(status = 'ativo') AS ativos FROM users"
  )
  const [[inscricoes]] = await pool.query(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT cursista_id) AS pessoas
       FROM inscricoes
      WHERE status = 'inscrito'${cursoId ? ' AND course_id = ?' : ''}`,
    cursoId ? [cursoId] : []
  )

  const escolasTotal = numero(escolas.total)
  const escolasAlcancadas = numero(alcance.alcancadas)

  return {
    cursistas: numero(pessoas.total),
    cursistasAtivos: numero(pessoas.ativos),
    comSenha: numero(pessoas.comSenha),
    confirmados: numero(pessoas.confirmados),
    acessaramNaJanela: numero(pessoas.acessaramNaJanela),
    diasDaJanela: dias,
    escolas: escolasAlcancadas,
    escolasTotal,
    escolasPct: escolasTotal ? Math.round((escolasAlcancadas / escolasTotal) * 1000) / 10 : 0,
    gres: numero(escolas.gres),
    cursos: numero(cursos.total),
    cursosPublicados: numero(cursos.publicados),
    equipe: numero(equipe.total),
    equipeAtiva: numero(equipe.ativos),
    inscricoes: numero(inscricoes.total),
    inscritos: numero(inscricoes.pessoas),
  }
}

/* ─── Territorio ─── */

async function porGre({ cursoId = null } = {}) {
  requireMysql()
  const curso = filtroDeCurso(cursoId)

  const [linhas] = await getPool().query(
    `SELECT
       v.gre,
       COUNT(DISTINCT v.cursista_id) AS cursistas,
       COUNT(DISTINCT v.escola) AS escolas,
       COUNT(DISTINCT CASE WHEN c.password_hash IS NOT NULL AND c.cadastro_confirmado = 1
                           THEN v.cursista_id END) AS confirmados
     FROM cursista_vinculos v
     JOIN cursistas c ON c.id = v.cursista_id
     WHERE v.gre IS NOT NULL${curso.sql}
     GROUP BY v.gre
     ORDER BY cursistas DESC`,
    curso.params
  )

  return linhas.map((l) => ({
    gre: l.gre,
    cursistas: numero(l.cursistas),
    escolas: numero(l.escolas),
    confirmados: numero(l.confirmados),
    adesao: numero(l.cursistas) ? Math.round((numero(l.confirmados) / numero(l.cursistas)) * 100) : 0,
  }))
}

async function escolasComMaisCursistas({ cursoId = null, limite = 8 } = {}) {
  requireMysql()
  const curso = filtroDeCurso(cursoId)

  const [linhas] = await getPool().query(
    `SELECT v.escola, v.gre, COUNT(DISTINCT v.cursista_id) AS cursistas
       FROM cursista_vinculos v
       JOIN cursistas c ON c.id = v.cursista_id
      WHERE v.escola IS NOT NULL${curso.sql}
      GROUP BY v.escola, v.gre
      ORDER BY cursistas DESC
      LIMIT ?`,
    [...curso.params, limite]
  )
  return linhas.map((l) => ({ escola: l.escola, gre: l.gre, cursistas: numero(l.cursistas) }))
}

/* ─── Jornada ─── */

/**
 * O funil da base inteira, SEM filtro de curso.
 *
 * Ele mede o caminho da base oficial ate a inscricao: filtrar por curso deixaria
 * todas as etapas iguais a ultima, porque quem se inscreveu necessariamente
 * passou por todas as anteriores. O funil de um curso seria uma linha reta.
 */
async function funil() {
  requireMysql()
  const pool = getPool()

  const [[c]] = await pool.query(
    `SELECT
       COUNT(*) AS base,
       SUM(first_access_at IS NOT NULL) AS acessaram,
       SUM(password_hash IS NOT NULL) AS definiramSenha,
       SUM(password_hash IS NOT NULL AND cadastro_confirmado = 1) AS confirmaram
     FROM cursistas`
  )
  const [[i]] = await pool.query(
    "SELECT COUNT(DISTINCT cursista_id) AS inscreveram FROM inscricoes WHERE status = 'inscrito'"
  )

  const base = numero(c.base)
  const pct = (v) => (base ? Math.round((v / base) * 1000) / 10 : 0)

  return [
    { etapa: 'Na base oficial', total: base, pct: 100 },
    { etapa: 'Fizeram o primeiro acesso', total: numero(c.acessaram), pct: pct(numero(c.acessaram)) },
    { etapa: 'Definiram a senha', total: numero(c.definiramSenha), pct: pct(numero(c.definiramSenha)) },
    { etapa: 'Confirmaram o cadastro', total: numero(c.confirmaram), pct: pct(numero(c.confirmaram)) },
    { etapa: 'Inscreveram-se em um curso', total: numero(i.inscreveram), pct: pct(numero(i.inscreveram)) },
  ]
}

async function perfilDaRede({ cursoId = null } = {}) {
  requireMysql()
  const pool = getPool()
  const curso = filtroDeCurso(cursoId)

  const consulta = async (coluna, limite) => {
    const [linhas] = await pool.query(
      `SELECT c.${coluna} AS chave, COUNT(*) AS total
         FROM cursistas c
        WHERE c.${coluna} IS NOT NULL AND c.${coluna} <> ''${curso.sql}
        GROUP BY c.${coluna} ORDER BY total DESC ${limite ? `LIMIT ${Number(limite)}` : ''}`,
      curso.params
    )
    return linhas.map((l) => ({ chave: l.chave, total: numero(l.total) }))
  }

  // A faixa de idade sai calculada do banco: mandar treze mil datas de
  // nascimento para a tela agrupar seria o oposto do que este modulo faz.
  const [faixas] = await pool.query(
    `SELECT faixa, COUNT(*) AS total FROM (
       SELECT CASE
         WHEN TIMESTAMPDIFF(YEAR, c.birth_date, CURDATE()) < 30 THEN 'Ate 29 anos'
         WHEN TIMESTAMPDIFF(YEAR, c.birth_date, CURDATE()) < 40 THEN '30 a 39'
         WHEN TIMESTAMPDIFF(YEAR, c.birth_date, CURDATE()) < 50 THEN '40 a 49'
         WHEN TIMESTAMPDIFF(YEAR, c.birth_date, CURDATE()) < 60 THEN '50 a 59'
         ELSE '60 ou mais'
       END AS faixa
       FROM cursistas c WHERE c.birth_date IS NOT NULL${curso.sql}
     ) t GROUP BY faixa
     ORDER BY FIELD(faixa, 'Ate 29 anos', '30 a 39', '40 a 49', '50 a 59', '60 ou mais')`,
    curso.params
  )

  return {
    eixos: await consulta('eixo_tecnologico'),
    funcoes: await consulta('funcao'),
    componentes: await consulta('componente_curricular', 10),
    genero: await consulta('genero'),
    faixaEtaria: faixas.map((l) => ({ chave: l.faixa, total: numero(l.total) })),
  }
}

/* ─── Inscricoes ─── */

async function inscricoesPorCurso() {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT
       c.id, c.name, c.primary_trail AS trilha, c.status_ava,
       c.enrollment_opens_at AS abre, c.enrollment_closes_at AS fecha,
       COUNT(i.id) AS inscritos
     FROM courses c
     LEFT JOIN inscricoes i ON i.course_id = c.id AND i.status = 'inscrito'
     GROUP BY c.id
     ORDER BY inscritos DESC`
  )
  const agora = new Date()
  return linhas.map((l) => ({
    id: l.id,
    curso: l.name,
    trilha: l.trilha,
    publicado: l.status_ava === 'publicado',
    inscritos: numero(l.inscritos),
    // "Aberto" e resposta do servidor: o relogio do navegador de quem apresenta
    // pode estar em qualquer fuso.
    aberto: Boolean(l.abre && l.fecha && new Date(l.abre) <= agora && agora <= new Date(l.fecha)),
  }))
}

/* ─── Series ─── */

/**
 * A serie diaria, com os dias vazios preenchidos.
 *
 * O banco so tem linha em dia que teve evento. Sem completar os buracos, uma
 * sexta sem acesso nenhum sumiria e a linha ligaria quinta com sabado --
 * desenhando uma continuidade que nao houve.
 *
 * Os LOGINS sao sempre globais: um login nao pertence a curso. Ja as INSCRICOES
 * saem da propria tabela de inscricoes quando ha filtro, que e a unica fonte que
 * sabe de qual curso cada uma foi.
 */
async function serie({ cursoId = null, dias = 30 } = {}) {
  requireMysql()
  const pool = getPool()

  const [acessos] = await pool.query(
    `SELECT DATE(created_at) AS dia, action, COUNT(*) AS total
       FROM cursista_auditoria
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND action IN ('login', 'primeiro_acesso')
      GROUP BY DATE(created_at), action`,
    [dias]
  )

  const [novasInscricoes] = await pool.query(
    `SELECT DATE(enrolled_at) AS dia, COUNT(*) AS total
       FROM inscricoes
      WHERE status = 'inscrito'
        AND enrolled_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ${cursoId ? 'AND course_id = ?' : ''}
      GROUP BY DATE(enrolled_at)`,
    cursoId ? [dias, cursoId] : [dias]
  )

  const mapa = new Map()
  const garantir = (d) => {
    if (!mapa.has(d)) mapa.set(d, { dia: d, login: 0, primeiroAcesso: 0, inscricao: 0 })
    return mapa.get(d)
  }
  for (const l of acessos) {
    const alvo = garantir(dia(l.dia))
    if (l.action === 'login') alvo.login = numero(l.total)
    else alvo.primeiroAcesso = numero(l.total)
  }
  for (const l of novasInscricoes) garantir(dia(l.dia)).inscricao = numero(l.total)

  const resultado = []
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  for (let i = dias; i >= 0; i -= 1) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - i)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    resultado.push(mapa.get(chave) || { dia: chave, login: 0, primeiroAcesso: 0, inscricao: 0 })
  }
  return resultado
}

async function acessosPorHora({ dias = 30 } = {}) {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT HOUR(created_at) AS hora, COUNT(*) AS total
       FROM cursista_auditoria
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND action IN ('login', 'primeiro_acesso')
      GROUP BY HOUR(created_at)`,
    [dias]
  )
  const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0 }))
  for (const l of linhas) porHora[Number(l.hora)].total = numero(l.total)
  return porHora
}

/* ─── Operacional ─── */

async function equipe() {
  requireMysql()
  const [linhas] = await getPool().query(
    `SELECT role, COUNT(*) AS total, SUM(status = 'ativo') AS ativos
       FROM users GROUP BY role ORDER BY total DESC`
  )
  return linhas.map((l) => ({ role: l.role, total: numero(l.total), ativos: numero(l.ativos) }))
}

async function producao() {
  requireMysql()
  const pool = getPool()

  const [estagios] = await pool.query(
    'SELECT stage, COUNT(*) AS total FROM course_modules GROUP BY stage'
  )
  const [[materiais]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(published = 1) AS publicados,
       SUM(status IN ('concluido', 'aprovado', 'validado')) AS prontos
     FROM materials`
  )
  // Modulo com prazo vencido que ainda nao chegou em 'publicado': e o unico
  // recorte desta faixa que pede acao, e por isso vem separado do resto.
  const [[atrasados]] = await pool.query(
    `SELECT COUNT(*) AS total FROM course_modules
      WHERE deadline IS NOT NULL AND deadline < CURDATE() AND stage <> 'publicado'`
  )

  return {
    modulosPorEstagio: estagios.map((l) => ({ estagio: l.stage, total: numero(l.total) })),
    materiais: {
      total: numero(materiais.total),
      publicados: numero(materiais.publicados),
      prontos: numero(materiais.prontos),
    },
    modulosAtrasados: numero(atrasados.total),
  }
}

/**
 * A frequencia do mes, vinda do modulo de Atribuicoes.
 *
 * Consulta direta a tabela em vez de chamar o service de la: o dashboard quer o
 * total da rede, e aquele service filtra tudo pela hierarquia de quem pediu --
 * usa-lo aqui devolveria a visao de uma pessoa, e nao a do programa.
 */
async function frequenciaDaEquipe(mes) {
  requireMysql()
  const pool = getPool()

  const [[geral]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(avaliacao = 'cumprido') AS cumpridas,
       SUM(avaliacao = 'nao_cumprido') AS naoCumpridas,
       SUM(avaliacao IS NULL AND checkin_em IS NOT NULL) AS aguardando,
       SUM(avaliacao IS NULL AND checkin_em IS NULL) AS aFazer
     FROM atribuicoes WHERE mes_referencia = ?`,
    [mes]
  )

  const [porPerfil] = await pool.query(
    `SELECT u.role, COUNT(*) AS total, SUM(a.avaliacao = 'cumprido') AS cumpridas
       FROM atribuicoes a
       JOIN users u ON u.id = a.responsavel_id
      WHERE a.mes_referencia = ?
      GROUP BY u.role ORDER BY total DESC`,
    [mes]
  )

  const total = numero(geral.total)
  return {
    mes,
    total,
    cumpridas: numero(geral.cumpridas),
    naoCumpridas: numero(geral.naoCumpridas),
    aguardando: numero(geral.aguardando),
    aFazer: numero(geral.aFazer),
    frequencia: total ? Math.round((numero(geral.cumpridas) / total) * 100) : 0,
    porPerfil: porPerfil.map((l) => ({
      role: l.role,
      total: numero(l.total),
      cumpridas: numero(l.cumpridas),
      frequencia: numero(l.total) ? Math.round((numero(l.cumpridas) / numero(l.total)) * 100) : 0,
    })),
  }
}

module.exports = {
  totais,
  porGre,
  escolasComMaisCursistas,
  funil,
  perfilDaRede,
  inscricoesPorCurso,
  serie,
  acessosPorHora,
  equipe,
  producao,
  frequenciaDaEquipe,
}
