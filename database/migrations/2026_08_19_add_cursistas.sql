USE transforma_db;

-- ============================================================================
-- Modulo de cursistas
--
-- Tabela separada de `users` de proposito. Sao ~13 mil contas cuja senha inicial
-- e o proprio CPF; manter esse universo isolado da equipe interna garante que uma
-- falha aqui nao tenha caminho para virar acesso administrativo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cursistas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cpf CHAR(11) NOT NULL,
  name VARCHAR(150) NOT NULL,
  birth_date DATE DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  registration VARCHAR(30) DEFAULT NULL,
  position VARCHAR(120) DEFAULT NULL,
  school VARCHAR(200) DEFAULT NULL,
  municipality VARCHAR(120) DEFAULT NULL,
  regional VARCHAR(120) DEFAULT NULL,

  -- NULL = senha ainda nao definida, e o CPF vale como senha de primeiro acesso.
  -- Assim que o cursista define a senha, o CPF deixa de autenticar -- a regra e
  -- estrutural, nao depende de um flag ser conferido corretamente.
  password_hash VARCHAR(255) DEFAULT NULL,

  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  first_access_at DATETIME DEFAULT NULL,
  last_access_at DATETIME DEFAULT NULL,

  -- Freio contra varredura da base de CPFs.
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_cursistas_cpf (cpf),
  INDEX idx_cursistas_name (name),
  INDEX idx_cursistas_municipality (municipality),
  INDEX idx_cursistas_status (status)
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
