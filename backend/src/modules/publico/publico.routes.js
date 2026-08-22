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
   * O texto da ementa so sai quando ela foi validada pela coordenacao: ate la e
   * rascunho em construcao pelo professor, e rascunho nao vai para o site.
   *
   * Nem a imagem nem a ementa inteira vem aqui:
   * - a capa e um data URI de ~2 MB por curso;
   * - as ementas somam ~68 KB de texto, e a maioria das visitas nem abre o
   *   detalhe de um curso.
   * A lista traz so um resumo curto para o card; o resto vem sob demanda pelas
   * rotas de imagem e de ementa.
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
              -- Resumo do card: a contextualizacao situa o curso melhor do que o
              -- objetivo geral, que e escrito na linguagem do documento. Cortado
              -- no SQL para o texto longo nao trafegar inteiro.
              CASE WHEN e.coordinator_status = 'valido'
                   THEN LEFT(COALESCE(NULLIF(TRIM(e.contextualization), ''), e.general_objective), 400)
              END AS resumo,
              -- Se ha ementa publicavel, para o front so oferecer "Saber mais"
              -- quando existe algo para mostrar.
              (e.coordinator_status = 'valido') AS tem_ementa
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
      resumo: row.resumo || null,
      hasEmenta: Boolean(Number(row.tem_ementa)),
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

  /**
   * Ementa publica de um curso, por secao.
   *
   * Devolvida so quando a coordenacao validou. As secoes vem numa lista ordenada
   * em vez de um objeto de campos: e ela que define a ordem das abas na tela, e
   * assim uma secao nova entra aqui sem o front precisar saber o nome da coluna.
   *
   * Secao vazia nao entra -- aba clicavel que abre em branco e pior do que aba
   * que nao existe. Hoje `programmatic_content` esta vazio em todos os cursos.
   */
  router.get('/cursos/:id/ementa', tratar(async (req, res) => {
    requireMysql()

    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ message: 'Curso nao encontrado.' })

    const [[linha]] = await getPool().execute(
      `SELECT e.contextualization, e.justification, e.relevance,
              e.general_objective, e.specific_objectives,
              e.technical_competencies, e.pedagogical_competencies, e.socioemotional_competencies,
              e.syllabus_description, e.programmatic_content, e.educational_resources,
              e.evaluation_criteria, e.evaluation_instruments, e.references_list
         FROM ementas e
        WHERE e.course_id = ? AND e.coordinator_status = 'valido'
        LIMIT 1`,
      [id]
    )

    if (!linha) return res.status(404).json({ message: 'Ementa nao disponivel para este curso.' })

    const SECOES = [
      ['contextualizacao', 'Contextualização', linha.contextualization],
      ['justificativa', 'Justificativa', linha.justification],
      ['relevancia', 'Relevância', linha.relevance],
      ['objetivo-geral', 'Objetivo geral', linha.general_objective],
      ['objetivos-especificos', 'Objetivos específicos', linha.specific_objectives],
      ['competencias-tecnicas', 'Competências técnicas', linha.technical_competencies],
      ['competencias-pedagogicas', 'Competências pedagógicas', linha.pedagogical_competencies],
      ['competencias-socioemocionais', 'Competências socioemocionais', linha.socioemotional_competencies],
      ['ementa', 'Ementa', linha.syllabus_description],
      ['conteudo-programatico', 'Conteúdo programático', linha.programmatic_content],
      ['recursos', 'Recursos educacionais', linha.educational_resources],
      ['criterios-avaliacao', 'Critérios de avaliação', linha.evaluation_criteria],
      ['instrumentos-avaliacao', 'Instrumentos de avaliação', linha.evaluation_instruments],
      ['referencias', 'Referências', linha.references_list],
    ]

    res.json({
      courseId: id,
      secoes: SECOES
        .filter(([, , texto]) => String(texto || '').trim())
        .map(([chave, titulo, texto]) => ({ id: chave, titulo, texto: String(texto).trim() })),
    })
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
