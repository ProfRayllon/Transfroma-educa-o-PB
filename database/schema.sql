CREATE DATABASE IF NOT EXISTS transforma_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE transforma_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  registration VARCHAR(30) DEFAULT NULL,
  role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao','revisor','supervisor_tutoria','ti') NOT NULL DEFAULT 'professor',
  `function` VARCHAR(100) DEFAULT NULL,
  area VARCHAR(150) DEFAULT NULL,
  avatar MEDIUMTEXT DEFAULT NULL,
  status ENUM('ativo','inativo','pendente','desligado','substituido') NOT NULL DEFAULT 'ativo',
  last_access DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  primary_trail ENUM('TRILHAS TRANSVERSAIS','TRILHAS DA FORMACAO GERAL BASICA') NOT NULL,
  secondary_trail VARCHAR(150) NOT NULL,
  total_sessions INT NOT NULL DEFAULT 0,
  supervisor_id INT DEFAULT NULL,
  supervisor_name VARCHAR(150) NOT NULL,
  coordinator_id INT DEFAULT NULL,
  coordinator_name VARCHAR(150) NOT NULL,
  start_date DATE DEFAULT NULL,
  deadline DATE DEFAULT NULL,
  image MEDIUMTEXT DEFAULT NULL,
  status_ava ENUM('nao_publicado','publicado') NOT NULL DEFAULT 'nao_publicado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_courses_name (name),
  INDEX idx_courses_primary_trail (primary_trail),
  INDEX idx_courses_secondary_trail (secondary_trail),
  INDEX idx_courses_supervisor_id (supervisor_id),
  INDEX idx_courses_coordinator_id (coordinator_id),
  INDEX idx_courses_supervisor (supervisor_name),
  INDEX idx_courses_coordinator (coordinator_name),
  CONSTRAINT chk_courses_total_sessions
    CHECK (total_sessions >= 0),
  CONSTRAINT fk_courses_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_courses_coordinator
    FOREIGN KEY (coordinator_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  workload VARCHAR(20) DEFAULT NULL,
  order_index INT NOT NULL DEFAULT 1,
  teacher_id INT DEFAULT NULL,
  teacher_name VARCHAR(150) DEFAULT NULL,
  supervisor_id INT DEFAULT NULL,
  supervisor_name VARCHAR(150) DEFAULT NULL,
  coordinator_id INT DEFAULT NULL,
  coordinator_name VARCHAR(150) DEFAULT NULL,
  deadline DATE DEFAULT NULL,
  stage ENUM('producao','supervisao','coordenacao','publicado') NOT NULL DEFAULT 'producao',
  professor_status ENUM('rascunho','em_producao','concluido') NOT NULL DEFAULT 'rascunho',
  supervisor_status ENUM('aguardando','aprovado','ajustes') NOT NULL DEFAULT 'aguardando',
  coordinator_status ENUM('pendente','aprovado','ajustes','reprovado') NOT NULL DEFAULT 'pendente',
  created_by INT DEFAULT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_course_modules_course (course_id),
  CONSTRAINT fk_course_modules_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS module_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_id INT NOT NULL,
  author_id INT DEFAULT NULL,
  author_name VARCHAR(150) DEFAULT NULL,
  author_role VARCHAR(50) DEFAULT NULL,
  type ENUM('comment','history') NOT NULL DEFAULT 'comment',
  action VARCHAR(50) DEFAULT NULL,
  message TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module_events_module (module_id),
  CONSTRAINT fk_module_events_module
    FOREIGN KEY (module_id) REFERENCES course_modules(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course VARCHAR(200) NOT NULL,
  course_id INT DEFAULT NULL,
  session INT NOT NULL,
  module INT NOT NULL DEFAULT 1,
  module_id INT DEFAULT NULL,
  theme VARCHAR(255) NOT NULL,
  objective TEXT,
  description TEXT DEFAULT NULL,
  type ENUM('Aula','Atividade','videoaula','apresentacao','atividade_escrita','material_complementar','atividade_interativa','outro','ebook','avaliacao_final','atividade_objetiva','pdf') NOT NULL DEFAULT 'videoaula',
  duration VARCHAR(20) DEFAULT NULL,
  responsible_id INT DEFAULT NULL,
  responsible_name VARCHAR(150) DEFAULT NULL,
  responsible_role VARCHAR(100) DEFAULT NULL,
  status ENUM('pendente','em_producao','em_revisao','concluido','aprovado','reprovado','ajuste_solicitado','em_execucao','validado','em_ajustes','revisao_linguistica','edicao','nao_iniciado') NULL DEFAULT NULL,
  delivery_date DATE DEFAULT NULL,
  original_link VARCHAR(255) DEFAULT NULL,
  adjusted_link VARCHAR(255) DEFAULT NULL,
  review_status ENUM('pendente','em_revisao','aprovado','reprovado','ajuste_solicitado','em_execucao','validado','em_ajustes','revisao_linguistica','edicao','concluido','esperando_material') NOT NULL DEFAULT 'em_execucao',
  supervisor_status VARCHAR(20) NULL DEFAULT NULL,
  coordinator_status VARCHAR(20) NULL DEFAULT NULL,
  revisor_id INT DEFAULT NULL,
  revisor_name VARCHAR(150) DEFAULT NULL,
  revisor_status VARCHAR(20) NULL DEFAULT NULL,
  responsibles TEXT DEFAULT NULL,
  review_notes TEXT DEFAULT NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_materials_responsible
    FOREIGN KEY (responsible_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_materials_revisor
    FOREIGN KEY (revisor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_producers (
  course_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, user_id),
  CONSTRAINT fk_course_producers_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_course_producers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_revisors (
  course_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, user_id),
  CONSTRAINT fk_course_revisors_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_course_revisors_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS people_management (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  supervisor_id INT DEFAULT NULL,
  `function` VARCHAR(100) DEFAULT NULL,
  attendance_status ENUM('registrada','pendente','ausente','justificada') NOT NULL DEFAULT 'pendente',
  attendance_time VARCHAR(10) DEFAULT NULL,
  completed_activities_percentage INT NOT NULL DEFAULT 0,
  open_occurrences_count INT NOT NULL DEFAULT 0,
  status ENUM('ativo','inativo','pendente','desligado','substituido') NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_people_management_completed
    CHECK (completed_activities_percentage BETWEEN 0 AND 100),
  CONSTRAINT fk_people_management_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_people_management_supervisor
    FOREIGN KEY (supervisor_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  `date` DATE NOT NULL,
  status ENUM('registrada','pendente','ausente','justificada') NOT NULL DEFAULT 'pendente',
  notes TEXT DEFAULT NULL,
  registered_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_attendance (user_id, `date`),
  CONSTRAINT fk_attendance_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_registered_by
    FOREIGN KEY (registered_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  percentage INT NOT NULL DEFAULT 0,
  status ENUM('pendente','em_andamento','concluida') NOT NULL DEFAULT 'pendente',
  reference_month VARCHAR(7) DEFAULT NULL COMMENT 'Formato: YYYY-MM',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_activities_percentage
    CHECK (percentage BETWEEN 0 AND 100),
  CONSTRAINT fk_activities_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS occurrences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  severity ENUM('baixa','media','alta') NOT NULL DEFAULT 'baixa',
  status ENUM('aberta','em_analise','resolvida','cancelada') NOT NULL DEFAULT 'aberta',
  created_by INT DEFAULT NULL,
  resolved_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_occurrences_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_occurrences_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_occurrences_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT DEFAULT NULL,
  type ENUM('success','warning','info','danger') NOT NULL DEFAULT 'info',
  read_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id INT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- Modulo de Atribuicoes -- o que a equipe chama de "Frequencia".
--
-- UMA tabela: a unidade e a atribuicao, uma linha por pessoa, por atividade,
-- por mes. Substitui frequencia_criterios + frequencia_lancamentos, que
-- separavam a regra (ligada a um perfil e um mes) da linha de cada pessoa e
-- precisavam ser mantidas em sincronia.
CREATE TABLE IF NOT EXISTS atribuicoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  descricao TEXT DEFAULT NULL,

  -- Quem executa. Qualquer perfil menos administrador.
  responsavel_id INT NOT NULL,
  -- Quem julga se cumpriu. Escolhido no ato da atribuicao.
  avaliador_id INT NOT NULL,
  criado_por INT DEFAULT NULL,

  mes_referencia CHAR(7) NOT NULL,
  -- Vazio significa "ate o fim do mes de referencia".
  prazo DATE DEFAULT NULL,

  -- Eixo 1: a pessoa responde "fiz?".
  checkin_em DATETIME DEFAULT NULL,
  checkin_obs TEXT DEFAULT NULL,

  -- Eixo 2: o avaliador responde "conta como cumprido?".
  -- Nulo com check-in preenchido = aguardando avaliacao.
  avaliacao ENUM('cumprido','nao_cumprido') DEFAULT NULL,
  avaliacao_obs TEXT DEFAULT NULL,
  avaliado_em DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_atribuicoes_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_atribuicoes_avaliador
    FOREIGN KEY (avaliador_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_atribuicoes_criado_por
    FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_atribuicoes_responsavel (responsavel_id, mes_referencia),
  INDEX idx_atribuicoes_avaliador (avaliador_id, mes_referencia),
  INDEX idx_atribuicoes_mes (mes_referencia)
) ENGINE=InnoDB;
