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
      -- Serve a duas contas do painel de concluintes: agrupar por escola e
      -- juntar com escola_municipio. Sem ele, as duas varrem as doze mil linhas.
      INDEX idx_consolidado_inep (course_id, inep),
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
   * Uma linha por RESPONDENTE da avaliacao.
   *
   * Convive com a tabela somada acima, e as duas nao podem divergir porque sao
   * gravadas na mesma transacao da mesma importacao.
   *
   * Por que agora existe: a tela pediu a evolucao das respostas no tempo e o
   * detalhamento resposta a resposta, e nenhuma das duas sai de contagens. A
   * objecao original -- 120 mil linhas por curso -- vinha de contar
   * pergunta x resposta; uma linha por respondente sao 9.974, dez vezes menos.
   *
   * O formulario e ANONIMO e continua sendo: nao ha CPF, nome nem e-mail aqui,
   * e nada nesta tabela reconstroi quem respondeu. As respostas ficam num JSON
   * indexado pela ordem da pergunta porque o questionario muda de um curso para
   * outro -- uma coluna por pergunta engessaria o formulario no formato de 2026.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS avaliacao_respondentes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      importacao_id INT NOT NULL,
      course_id INT NOT NULL,
      respondido_em DATETIME DEFAULT NULL,
      turma VARCHAR(40) DEFAULT NULL,
      componente VARCHAR(120) DEFAULT NULL,

      -- A nota de 1 a 5, destacada do JSON por ser a unica que a tela ordena,
      -- filtra e soma. Fica NULL se o formulario do curso nao tiver essa pergunta.
      nota TINYINT DEFAULT NULL,
      -- Quantas das perguntas respondidas cairam na banda positiva, e quantas
      -- foram respondidas. Guardados porque a "situacao" da linha sai deles, e
      -- recalcular a partir do JSON a cada leitura custaria caro.
      positivas TINYINT NOT NULL DEFAULT 0,
      respondidas TINYINT NOT NULL DEFAULT 0,
      respostas JSON DEFAULT NULL,

      INDEX idx_respondentes_curso (course_id, respondido_em),
      INDEX idx_respondentes_componente (course_id, componente),
      CONSTRAINT fk_respondentes_importacao
        FOREIGN KEY (importacao_id) REFERENCES resultado_importacoes(id) ON DELETE CASCADE
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
   * Colunas que vieram junto do de-para do Censo Escolar.
   *
   * Adicionadas depois da tabela existir, no padrao do resto do sistema
   * (ver cursistas.schema.js): confere o INFORMATION_SCHEMA e cria o que
   * faltar. Assim o deploy nao depende de alguem lembrar de rodar SQL.
   *
   * Latitude e longitude entram agora porque chegam na mesma linha e nao custam
   * nada -- o mapa da Paraiba, quando existir, ja encontra o dado gravado em
   * vez de exigir uma reimportacao da base inteira.
   */

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

      /**
       * Em que banda a resposta cai: positiva, neutra ou negativa.
       *
       * E o que torna as onze perguntas comparaveis entre si. A coluna topo nao:
       * acertar o topo de uma escala de tres opcoes e mais facil que o de uma de
       * cinco, e o mesmo entusiasmo produz percentuais diferentes so por causa
       * do tamanho da regua.
       *
       * A banda classifica pelo SIGNIFICADO da opcao. 'Parcialmente' e neutro em
       * qualquer escala onde apareca; 'Relevante' e positivo mesmo nao sendo o
       * topo. O indicador da tela e a fatia positiva sobre quem respondeu.
       */
      banda ENUM('positiva','neutra','negativa','indefinida') NOT NULL DEFAULT 'indefinida',
      turma VARCHAR(40) DEFAULT NULL,
      componente VARCHAR(120) DEFAULT NULL,
      total INT NOT NULL DEFAULT 0,

      INDEX idx_avaliacao_curso (course_id, ordem),
      INDEX idx_avaliacao_componente (course_id, componente),
      CONSTRAINT fk_avaliacao_importacao
        FOREIGN KEY (importacao_id) REFERENCES resultado_importacoes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `)
  /* Os ajustes em tabela que ja existe vem POR ULTIMO, depois de todos os
     CREATE TABLE. Antes o ALTER da coluna `banda` rodava antes do CREATE de
     avaliacao_respostas: numa instalacao nova ele batia em tabela inexistente,
     o boot falhava, e o Docker reiniciava o container em laco. */

  /* `banda` entrou depois de avaliacao_respostas existir. Mesmo padrao das
     demais: confere o INFORMATION_SCHEMA e adiciona se faltar. */
  const [colBanda] = await pool.query(
    `SELECT COUNT(*) AS existe FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'avaliacao_respostas'
        AND COLUMN_NAME = 'banda'`
  )
  if (!Number(colBanda[0].existe)) {
    await pool.execute(
      "ALTER TABLE avaliacao_respostas ADD COLUMN banda ENUM('positiva','neutra','negativa','indefinida') NOT NULL DEFAULT 'indefinida' AFTER topo"
    )
  }

  /* O indice por INEP entrou depois da tabela existir. CREATE INDEX nao aceita
     IF NOT EXISTS no MySQL 8, entao a checagem e explicita -- repetir o CREATE
     daria "Duplicate key name" e derrubaria o boot num laco de reinicializacao. */
  const [indices] = await pool.query(
    `SELECT COUNT(*) AS existe FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'consolidado_vinculos'
        AND INDEX_NAME = 'idx_consolidado_inep'`
  )
  if (!Number(indices[0].existe)) {
    await pool.execute('CREATE INDEX idx_consolidado_inep ON consolidado_vinculos (course_id, inep)')
  }

  const [colunas] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'escola_municipio'
        AND COLUMN_NAME IN ('localizacao', 'porte', 'latitude', 'longitude')`
  )
  const existentes = new Set(colunas.map((c) => c.COLUMN_NAME))

  if (!existentes.has('localizacao')) {
    await pool.execute(
      "ALTER TABLE escola_municipio ADD COLUMN localizacao ENUM('Urbana','Rural') DEFAULT NULL AFTER uf"
    )
  }
  if (!existentes.has('porte')) {
    await pool.execute('ALTER TABLE escola_municipio ADD COLUMN porte VARCHAR(60) DEFAULT NULL AFTER localizacao')
  }
  // DECIMAL, e nao FLOAT: coordenada e um valor exato de catalogo, e float
  // devolve 7.1195000000001 no lugar de 7.1195.
  if (!existentes.has('latitude')) {
    await pool.execute('ALTER TABLE escola_municipio ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL AFTER porte')
  }
  if (!existentes.has('longitude')) {
    await pool.execute('ALTER TABLE escola_municipio ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL AFTER latitude')
  }
}

module.exports = { garantirEsquema, aplicar }
