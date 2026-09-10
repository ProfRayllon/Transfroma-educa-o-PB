'use strict'

const { getPool, isMysqlMode } = require('../../shared/db')

/**
 * Tabelas dos resultados de curso que chegam por planilha.
 *
 * Duas entregas semanais por curso, produzidas fora do sistema:
 *   1. consolidado -- quem concluiu e quem nao concluiu, por vinculo escolar
 *   2. avaliacao   -- o formulario de satisfacao, ANONIMO
 *
 * O DDL mora aqui e nao em database/migrations/ porque o projeto nao tem
 * migration runner: o deploy nao roda SQL. Um arquivo .sql que ninguem executa
 * viraria a versao errada da verdade no primeiro ajuste. Aqui ele roda no boot,
 * e CREATE TABLE IF NOT EXISTS torna a repeticao inofensiva.
 */
async function garantirEsquema() {
  if (!isMysqlMode()) return
  await aplicar(getPool())
}

/**
 * O DDL propriamente dito, separado para aceitar uma conexao de fora.
 *
 * O importador de linha de comando roda sem passar pelo boot da API -- e sem
 * este ponto de entrada ele precisaria da propria copia do CREATE TABLE, que e
 * exatamente como duas versoes da mesma tabela comecam a divergir.
 */
async function aplicar(pool) {
  // Sem a tabela de cursos nao ha a que amarrar o resultado, e a FK falharia.
  const [[cursos]] = await pool.query(
    `SELECT COUNT(*) AS existe
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses'`
  )
  if (!Number(cursos.existe)) return

  /**
   * Cada envio e uma fotografia daquela semana, nao uma correcao da anterior.
   *
   * A coordenacao alimenta semanalmente. Se cada planilha substituisse a
   * anterior, o painel mostraria sempre o numero de hoje e a evolucao sumiria --
   * e "quantos concluiram na semana passada" e justamente o que responde se o
   * curso esta andando.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resultado_importacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      tipo ENUM('consolidado','avaliacao') NOT NULL,
      referencia DATE NOT NULL,
      arquivo VARCHAR(255) NOT NULL,
      linhas INT NOT NULL DEFAULT 0,
      importado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      importado_por VARCHAR(150) DEFAULT NULL,

      UNIQUE KEY uq_resultado_importacoes (course_id, tipo, referencia),
      CONSTRAINT fk_resultado_importacoes_course
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  /**
   * Consolidado: detalhe apenas da fotografia MAIS RECENTE de cada curso.
   *
   * A planilha traz uma linha por VINCULO (docente x escola), nao por pessoa: na
   * base do Google sao 12.786 linhas para 11.871 pessoas, porque 841 professores
   * lecionam em duas ou mais escolas. Quem contar linha e chamar de gente erra
   * por 915 pessoas -- por isso as duas leituras convivem, e a tela sempre diz
   * qual delas esta mostrando.
   *
   * Guardar so a foto atual e deliberado: dez cursos x 12 mil vinculos x uma
   * entrega por semana passariam de dois milhoes de linhas com CPF e nome em um
   * ano, numa VPS de 957 MB. A evolucao no tempo vive somada em
   * consolidado_historico, que nao carrega dado pessoal nenhum.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS consolidado_vinculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      importacao_id INT NOT NULL,
      course_id INT NOT NULL,
      cpf CHAR(11) NOT NULL,
      docente VARCHAR(150) DEFAULT NULL,
      gre VARCHAR(60) DEFAULT NULL,
      inep VARCHAR(12) DEFAULT NULL,
      escola VARCHAR(200) DEFAULT NULL,
      status ENUM('concluido','nao_concluido','em_andamento') NOT NULL,
      cursista_id INT DEFAULT NULL,

      INDEX idx_consolidado_curso (course_id, status),
      INDEX idx_consolidado_gre (course_id, gre),
      INDEX idx_consolidado_cpf (cpf),
      CONSTRAINT fk_consolidado_importacao
        FOREIGN KEY (importacao_id) REFERENCES resultado_importacoes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consolidado_historico (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      referencia DATE NOT NULL,
      gre VARCHAR(60) NOT NULL,
      vinculos INT NOT NULL DEFAULT 0,
      pessoas INT NOT NULL DEFAULT 0,
      concluidos INT NOT NULL DEFAULT 0,

      UNIQUE KEY uq_consolidado_historico (course_id, referencia, gre),
      INDEX idx_consolidado_historico_curso (course_id, referencia),
      CONSTRAINT fk_consolidado_historico_course
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)

  /**
   * De-para do codigo INEP da escola para o municipio.
   *
   * O municipio nao existe em nenhuma outra tabela do sistema, e o nome da
   * escola nao o carrega. O unico caminho e o INEP, que e o codigo oficial do
   * Censo Escolar e ja vem na planilha do consolidado -- falta so a lista que
   * diz onde cada codigo fica.
   *
   * Tabela separada, e nao uma coluna em consolidado_vinculos, porque o
   * municipio e um atributo da ESCOLA e nao da linha da planilha: repetido em
   * doze mil linhas, ele sairia errado em algumas delas na primeira correcao, e
   * a mesma escola apareceria em dois municipios.
   *
   * Enquanto estiver vazia, os graficos que dependem dela simplesmente nao
   * aparecem -- nunca aparecem zerados, que seria dizer que ninguem concluiu.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS escola_municipio (
      inep VARCHAR(12) PRIMARY KEY,
      municipio VARCHAR(120) NOT NULL,
      uf CHAR(2) NOT NULL DEFAULT 'PB',
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_escola_municipio_nome (municipio)
    ) ENGINE=InnoDB
  `)

  /**
   * Avaliacao: contagens, nunca respostas individuais.
   *
   * O formulario nao tem CPF, nome, GRE nem escola -- e isso nao e falha da
   * planilha, e a promessa feita a quem respondeu. Nenhuma coluna aqui tenta
   * reconstruir o respondente: as linhas chegam ja somadas.
   *
   * Somar na importacao e ao mesmo tempo a escolha de privacidade e a de
   * desempenho: 9.974 respostas x 11 perguntas seriam 110 mil linhas por curso, e
   * toda tela que elas alimentam e uma contagem. Somado por
   * (pergunta, resposta, turma, componente) sao ~3 mil linhas, e ainda permite
   * filtrar por turma ou componente somando as demais colunas.
   *
   * A granularidade para exatamente aqui: descer mais um nivel comecaria a
   * permitir isolar respondente em turma pequena.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS avaliacao_respostas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      importacao_id INT NOT NULL,
      course_id INT NOT NULL,
      ordem TINYINT NOT NULL,
      pergunta VARCHAR(255) NOT NULL,
      escala ENUM('relevancia4','clareza4','sim3','nota5','outra') NOT NULL,
      resposta VARCHAR(60) NOT NULL,
      topo TINYINT(1) NOT NULL DEFAULT 0,
      turma VARCHAR(40) DEFAULT NULL,
      componente VARCHAR(120) DEFAULT NULL,
      total INT NOT NULL DEFAULT 0,

      INDEX idx_avaliacao_curso (course_id, ordem),
      INDEX idx_avaliacao_componente (course_id, componente),
      CONSTRAINT fk_avaliacao_importacao
        FOREIGN KEY (importacao_id) REFERENCES resultado_importacoes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
}

module.exports = { garantirEsquema, aplicar }
