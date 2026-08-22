'use strict'

const express = require('express')
const { getPool, requireMysql } = require('../../shared/db')

/**
 * Rotas do site publico (sem sessao).
 *
 * Tudo aqui e visivel a qualquer visitante, entao o criterio de cada campo e um
 * so: isto pode ser lido por qualquer pessoa da internet? Por isso a consulta
 * lista as colunas uma a uma em vez de devolver a linha do curso -- a tabela
 * `courses` carrega supervisor, coordenador e status no AVA, que sao informacao
 * interna da equipe e nao podem escapar num `SELECT *` futuro.
 */

// Imagem de curso e guardada como data URI editavel pela equipe. Servir o
// mime-type que veio do banco deixaria alguem com acesso ao cadastro publicar
// `data:text/html;...` e obter HTML executando no nosso proprio dominio (XSS
// armazenado). So estes quatro tipos saem daqui, e o Content-Type e escolhido
// desta lista, nunca copiado do valor guardado.
const TIPOS_IMAGEM = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
}

const MAX_IMAGEM_BYTES = 8 * 1024 * 1024

/**
 * Traduz a situacao ja decidida pelo MySQL.
 *
 * A comparacao com o horario atual acontece no SQL, e NAO aqui. O motivo e um
 * bug real: o banco roda em America/Sao_Paulo e o container da API em UTC, sem
 * TZ definido. A janela gravada como "21/08 19:55" significa 19:55 de Sao Paulo,
 * mas o driver entregava a data ao Node, que a lia como 19:55 UTC -- tres horas
 * de diferenca.
 *
 * O efeito era visivel: o catalogo anunciava "Inscricoes abertas" e mostrava o
 * botao, enquanto a rota de inscricao -- que sempre comparou via NOW() do MySQL
 * -- recusava com "as inscricoes nao estao abertas". Quem clicava nao conseguia
 * se inscrever.
 *
 * Com a decisao no SQL existe um relogio so, o do banco, e as duas rotas nunca
 * mais discordam.
 */
function traduzirSituacao(codigo) {
  const valores = ['aberto', 'em_breve', 'encerrado', 'fechado']
  return valores.includes(codigo) ? codigo : 'fechado'
}

/** Expressao SQL que decide a situacao da inscricao, usando o relogio do banco. */
const SQL_SITUACAO = `
  CASE
    WHEN c.enrollment_opens_at IS NULL OR c.enrollment_closes_at IS NULL THEN 'fechado'
    WHEN NOW() < c.enrollment_opens_at THEN 'em_breve'
    WHEN NOW() > c.enrollment_closes_at THEN 'encerrado'
    ELSE 'aberto'
  END`

module.exports = function criarRotasPublicas() {
  const router = express.Router()

  function tratar(handler) {
    return async (req, res) => {
      try {
        await handler(req, res)
      } catch (error) {
        const status = error.statusCode || 500
        if (status >= 500) console.error('[publico]', error)
        res.status(status).json({
          message: status >= 500 ? 'Erro interno do servidor.' : error.message,
        })
      }
    }
  }

  /**
   * Catalogo de cursos.
   *
   * O objetivo geral so sai quando a ementa foi validada pela coordenacao: ate
   * la e rascunho em construcao pelo professor, e rascunho nao vai para o site.
   *
   * A imagem NAO vem aqui. Sao data URIs de ~2 MB no banco; oito cursos seriam
   * ~18 MB de JSON a cada visita, numa VPS de 957 MB. A lista diz apenas se ha
   * imagem e o navegador busca cada uma pela rota abaixo, que tem cache.
   */
  router.get('/cursos', tratar(async (req, res) => {
    requireMysql()

    const [rows] = await getPool().query(
      `SELECT c.id, c.name, c.primary_trail, c.secondary_trail, c.total_sessions,
              c.workload_hours, c.enrollment_opens_at, c.enrollment_closes_at,
              -- Mesmo criterio da rota de imagem: se o data URI nao for de
              -- imagem, a rota recusa e o front mostraria capa quebrada.
              (c.image LIKE 'data:image/%') AS tem_imagem,
              -- Versao da capa. Ver o comentario de imageVersion abaixo.
              UNIX_TIMESTAMP(c.updated_at) AS versao,
              ${SQL_SITUACAO} AS situacao,
              CASE WHEN e.coordinator_status = 'valido' THEN e.general_objective END AS objetivo
         FROM courses c
         LEFT JOIN ementas e ON e.course_id = c.id
        ORDER BY c.primary_trail, c.name`
    )

    res.json(rows.map((row) => ({
      id: row.id,
      name: row.name,
      primaryTrail: row.primary_trail,
      trail: row.secondary_trail,
      totalSessions: row.total_sessions,
      workloadHours: row.workload_hours ?? null,
      objective: row.objetivo || null,
      hasImage: Boolean(Number(row.tem_imagem)),
      /**
       * Marca de versao da capa, para o front variar a URL da imagem.
       *
       * A rota da imagem manda cache de 24h, e o endereco dela depende so do id
       * do curso. Sem esta marca, trocar a capa nao mudava nada para quem ja
       * tinha visitado: o navegador continuava servindo a antiga do proprio
       * cache, sem nem perguntar ao servidor.
       *
       * Vem de `updated_at`, que ja existe e nao custa nada. Editar o nome do
       * curso tambem muda o valor e faz baixar a capa de novo -- uma requisicao
       * a mais, de vez em quando, em troca de a capa nova sempre aparecer.
       */
      imageVersion: Number(row.versao || 0),
      enrollmentOpensAt: row.enrollment_opens_at,
      enrollmentClosesAt: row.enrollment_closes_at,
      situacao: traduzirSituacao(row.situacao),
    })))
  }))

  /** Imagem de capa de um curso, decodificada do data URI guardado no banco. */
  router.get('/cursos/:id/imagem', tratar(async (req, res) => {
    requireMysql()

    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(404).end()

    const [[curso]] = await getPool().execute(
      'SELECT image FROM courses WHERE id = ?',
      [id]
    )
    if (!curso?.image) return res.status(404).end()

    const partes = /^data:([a-z0-9.+/-]+);base64,(.*)$/is.exec(String(curso.image))
    if (!partes) return res.status(404).end()

    const contentType = TIPOS_IMAGEM[partes[1].toLowerCase()]
    if (!contentType) return res.status(404).end()

    const bytes = Buffer.from(partes[2], 'base64')
    if (bytes.length === 0 || bytes.length > MAX_IMAGEM_BYTES) return res.status(404).end()

    res.set({
      'Content-Type': contentType,
      // A capa muda muito pouco e pesa alguns MB: sem cache, cada visita ao
      // catalogo puxaria tudo de novo do banco.
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    })
    res.send(bytes)
  }))

  return router
}
