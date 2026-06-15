USE transforma_db;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  primary_trail ENUM('TRILHAS TRANSVERSAIS','TRILHAS DA FORMACAO GERAL BASICA') NOT NULL,
  secondary_trail VARCHAR(150) NOT NULL,
  total_sessions INT NOT NULL DEFAULT 0,
  supervisor_name VARCHAR(150) NOT NULL,
  coordinator_name VARCHAR(150) NOT NULL,
  start_date DATE DEFAULT NULL,
  deadline DATE DEFAULT NULL,
  image MEDIUMTEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_courses_name (name),
  INDEX idx_courses_primary_trail (primary_trail),
  INDEX idx_courses_secondary_trail (secondary_trail),
  INDEX idx_courses_supervisor (supervisor_name),
  INDEX idx_courses_coordinator (coordinator_name),
  CONSTRAINT chk_courses_total_sessions
    CHECK (total_sessions >= 0)
) ENGINE=InnoDB;
