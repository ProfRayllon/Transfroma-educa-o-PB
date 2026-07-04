USE transforma_db;

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

ALTER TABLE materials
  ADD COLUMN module_id INT DEFAULT NULL;

CREATE INDEX idx_materials_module_id ON materials(module_id);
