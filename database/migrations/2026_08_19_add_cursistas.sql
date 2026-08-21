USE transforma_db;

-- ============================================================================
-- Modulo de cursistas
--
-- Tabela separada de `users` de proposito. Sao ~13 mil contas cuja senha inicial
-- e o proprio CPF; manter esse universo isolado da equipe interna garante que uma
-- falha aqui nao tenha caminho para virar acesso administrativo.
--
-- A estrutura acompanha a base oficial (BASE_SISTEMA_LOGIN_DOCENTES), que vem em
-- duas abas: USUARIOS (identificacao e estado de acesso) e PERFIL_DOCENTE (dados
-- funcionais). As colunas abaixo estao agrupadas pela ORIGEM do dado, porque e
-- isso que determina quem pode alterar cada uma.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cursistas (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- ---- Identificacao (base oficial, imutavel pelo cursista) ----
  -- Chave de negocio da base de origem (formato USR000001). Preservada para
  -- reconciliar reimportacoes e conversar com a planilha original.
  usuario_id VARCHAR(20) DEFAULT NULL,
  cpf CHAR(11) NOT NULL,
  name VARCHAR(150) NOT NULL,

  -- ---- Dados funcionais (base oficial, imutaveis pelo cursista) ----
  -- Alimentam o certificado e os relatorios da rede, entao correcao aqui passa
  -- pela coordenacao, nunca pela tela do cursista.
  funcao VARCHAR(120) DEFAULT NULL,
  componente_curricular VARCHAR(120) DEFAULT NULL,
  eixo_tecnologico VARCHAR(120) DEFAULT NULL,
  curso_tecnico VARCHAR(120) DEFAULT NULL,
  formacao_encontrada TINYINT(1) NOT NULL DEFAULT 0,
  qtde_vinculos INT NOT NULL DEFAULT 1,
  data_inicio_rede DATE DEFAULT NULL,

  -- ---- Preenchidos pelo proprio cursista no primeiro acesso ----
  -- ATENCAO: por virem do proprio usuario, estes campos NAO servem para
  -- verificar identidade (ex.: recuperar senha). Quem tomasse a conta seria
  -- exatamente quem os preencheu.
  birth_date DATE DEFAULT NULL,
  email_institucional VARCHAR(150) DEFAULT NULL,
  email_pessoal VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  genero VARCHAR(40) DEFAULT NULL,

  -- ---- Acesso ----
  -- NULL = senha ainda nao definida, e o CPF vale como senha de primeiro acesso.
  -- Assim que o cursista define a senha, o CPF deixa de autenticar -- a regra e
  -- estrutural, nao depende de um flag ser conferido corretamente.
  password_hash VARCHAR(255) DEFAULT NULL,

  -- Segundo portao: mesmo com a senha definida, o cursista so passa das telas de
  -- cadastro depois de completar e confirmar os dados. A base chega com
  -- STATUS_CADASTRO = PENDENTE_CONFIRMACAO para todo mundo.
  cadastro_confirmado TINYINT(1) NOT NULL DEFAULT 0,
  data_confirmacao DATETIME DEFAULT NULL,

  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  first_access_at DATETIME DEFAULT NULL,
  last_access_at DATETIME DEFAULT NULL,

  -- Freio contra varredura da base de CPFs.
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_cursistas_cpf (cpf),
  UNIQUE KEY uq_cursistas_usuario_id (usuario_id),
  INDEX idx_cursistas_name (name),
  INDEX idx_cursistas_status (status),
  INDEX idx_cursistas_confirmado (cadastro_confirmado)
) ENGINE=InnoDB;

-- Vinculo do docente com a escola. Tabela separada porque a base traz ate quatro
-- (INEP_1..4 / GRE_1..4 / ESCOLA_1..4): repetir quatro jogos de colunas na tabela
-- principal engessaria o limite e deixaria a maioria das linhas vazia -- na
-- amostra, 93% tem um unico vinculo.
CREATE TABLE IF NOT EXISTS cursista_vinculos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cursista_id INT NOT NULL,
  ordem TINYINT NOT NULL,
  inep VARCHAR(12) DEFAULT NULL,
  gre VARCHAR(60) DEFAULT NULL,
  escola VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_cursista_vinculos (cursista_id, ordem),
  INDEX idx_cursista_vinculos_gre (gre),
  INDEX idx_cursista_vinculos_inep (inep),
  CONSTRAINT fk_cursista_vinculos_cursista
    FOREIGN KEY (cursista_id) REFERENCES cursistas(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Inscricao do cursista no curso. `edition` permite importar concluintes de
-- edicoes anteriores para montar o historico do profissional no programa.
CREATE TABLE IF NOT EXISTS inscricoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cursista_id INT NOT NULL,
  course_id INT NOT NULL,
  edition VARCHAR(9) NOT NULL DEFAULT '2026',
  status ENUM('inscrito','cancelado','concluido') NOT NULL DEFAULT 'inscrito',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  exported_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_inscricoes_cursista_curso_edicao (cursista_id, course_id, edition),
  INDEX idx_inscricoes_course (course_id, status),
  INDEX idx_inscricoes_export (course_id, exported_at),
  CONSTRAINT fk_inscricoes_cursista
    FOREIGN KEY (cursista_id) REFERENCES cursistas(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_inscricoes_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Trilha de auditoria (LGPD). Sem FK em cursista_id de proposito: o registro do
-- que foi feito precisa sobreviver a exclusao do cadastro.
CREATE TABLE IF NOT EXISTS cursista_auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_type ENUM('cursista','admin','sistema') NOT NULL,
  actor_id INT DEFAULT NULL,
  actor_label VARCHAR(150) DEFAULT NULL,
  action VARCHAR(60) NOT NULL,
  cursista_id INT DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  details TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_cursista_auditoria_cursista (cursista_id, created_at),
  INDEX idx_cursista_auditoria_action (action, created_at)
) ENGINE=InnoDB;

-- Janela de inscricao por curso. Com as duas datas nulas, o curso nao aceita
-- inscricao -- o padrao e fechado, para nenhum curso abrir por descuido.
ALTER TABLE courses
  ADD COLUMN enrollment_opens_at DATETIME DEFAULT NULL AFTER deadline,
  ADD COLUMN enrollment_closes_at DATETIME DEFAULT NULL AFTER enrollment_opens_at;
