'use strict'

const { getPool, isMysqlMode } = require('../../shared/db')

/**
 * Tabelas dos certificados: a configuracao de cada curso e quem tem direito.
 *
 * O PDF nao e guardado em lugar nenhum -- nasce a cada download a partir
 * destas duas tabelas. O DDL roda no boot, como nos outros modulos.
 */
async function garantirEsquema() {
  if (!isMysqlMode()) return
  const pool = getPool()

  /**
   * Um certificado por curso: a arte de fundo e os textos.
   *
   * A arte fica no banco (1-2 MB por curso, poucas dezenas de cursos) e nao no
   * disco do container, que e recriado a cada deploy. `liberado` e o que abre o
   * download para os cursistas -- da para enviar a base e conferir antes.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificado_config (
      course_id INT PRIMARY KEY,
      liberado TINYINT(1) NOT NULL DEFAULT 0,
      nome_curso VARCHAR(255) DEFAULT NULL,
      periodo VARCHAR(150) DEFAULT NULL,
      carga_horaria SMALLINT DEFAULT NULL,
      texto TEXT DEFAULT NULL,
      arte LONGBLOB DEFAULT NULL,
      arte_tipo VARCHAR(40) DEFAULT NULL,
      arte_nome VARCHAR(255) DEFAULT NULL,
      arte_tamanho INT DEFAULT NULL,
      atualizado_por VARCHAR(150) DEFAULT NULL,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_certificado_config_course
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  /**
   * Quem tem direito ao certificado de cada curso, vindo da base enviada.
   *
   * Pelo CPF, e nao pelo id do cursista: a base de conclusao vem de fora e pode
   * trazer quem ainda nao tem cadastro -- o certificado aparece assim que a
   * pessoa entrar. O codigo nunca muda depois de criado, porque ja pode estar
   * impresso; quem sai da base vira 'revogado', e a validacao diz isso.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS certificados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      cpf CHAR(11) NOT NULL,
      nome VARCHAR(200) NOT NULL,
      codigo CHAR(14) NOT NULL,
      status ENUM('valido','revogado') NOT NULL DEFAULT 'valido',
      downloads INT NOT NULL DEFAULT 0,
      primeiro_download_em DATETIME DEFAULT NULL,
      emitido_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_certificados_codigo (codigo),
      UNIQUE KEY uq_certificados_curso_cpf (course_id, cpf),
      KEY ix_certificados_cpf (cpf),
      CONSTRAINT fk_certificados_course
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  /**
   * Codigo com letras do curso (LEG-A7K9-X2M4), alem do numerico dos
   * certificados antigos (9999-9999-9999). VARCHAR(20) cabe os dois; o
   * MODIFY roda a cada boot e e inofensivo depois da primeira vez.
   */
  await pool.query('ALTER TABLE certificados MODIFY codigo VARCHAR(20) NOT NULL')
  await garantirColuna(pool, 'certificado_config', 'prefixo_codigo', 'VARCHAR(4) DEFAULT NULL AFTER texto')
}

/** Coluna nova em tabela que ja existe: o CREATE TABLE IF NOT EXISTS nao a cria. */
async function garantirColuna(pool, tabela, coluna, definicao) {
  const [[c]] = await pool.query(
    `SELECT COUNT(*) AS existe FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabela, coluna]
  )
  if (!Number(c.existe)) await pool.execute(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`)
}

module.exports = { garantirEsquema }
