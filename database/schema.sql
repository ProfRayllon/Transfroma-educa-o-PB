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
  role ENUM('administrador','supervisor','professor','tutor','tecnico','gestao') NOT NULL DEFAULT 'professor',
  `function` VARCHAR(100) DEFAULT NULL,
  status ENUM('ativo','inativo','pendente','desligado','substituido') NOT NULL DEFAULT 'ativo',
  last_access DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course VARCHAR(200) NOT NULL,
  session INT NOT NULL,
  theme VARCHAR(255) NOT NULL,
  objective TEXT,
  type ENUM('Aula','Atividade') NOT NULL DEFAULT 'Aula',
  duration VARCHAR(20) DEFAULT NULL,
  responsible_id INT DEFAULT NULL,
  responsible_name VARCHAR(150) DEFAULT NULL,
  responsible_role VARCHAR(100) DEFAULT NULL,
  status ENUM('pendente','em_producao','em_revisao','concluido','aprovado','reprovado','ajuste_solicitado') NOT NULL DEFAULT 'pendente',
  delivery_date DATE DEFAULT NULL,
  original_link VARCHAR(255) DEFAULT NULL,
  adjusted_link VARCHAR(255) DEFAULT NULL,
  review_status ENUM('pendente','em_revisao','aprovado','reprovado','ajuste_solicitado') NOT NULL DEFAULT 'pendente',
  review_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_materials_responsible
    FOREIGN KEY (responsible_id) REFERENCES users(id)
    ON DELETE SET NULL
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

CREATE INDEX idx_materials_responsible ON materials(responsible_id);
CREATE INDEX idx_materials_status ON materials(status);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, `date`);
CREATE INDEX idx_occurrences_user ON occurrences(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
