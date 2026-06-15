-- ============================================================
-- Transforma Educação PB 2026 — Esquema MySQL
-- ============================================================

CREATE DATABASE IF NOT EXISTS transforma_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE transforma_db;

-- Usuários do sistema
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150)    NOT NULL,
  email         VARCHAR(150)    NOT NULL UNIQUE,
  password_hash VARCHAR(255)    NOT NULL,
  registration  VARCHAR(30)     DEFAULT NULL,
  role          ENUM('administrador','supervisor','professor','tutor','tecnico','gestao') NOT NULL DEFAULT 'professor',
  function      VARCHAR(100)    DEFAULT NULL,
  status        ENUM('ativo','inativo','pendente','desligado','substituido') NOT NULL DEFAULT 'ativo',
  last_access   DATETIME        DEFAULT NULL,
  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Materiais de produção
CREATE TABLE IF NOT EXISTS materials (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  course           VARCHAR(200)    NOT NULL,
  session          INT             NOT NULL,
  theme            VARCHAR(255)    NOT NULL,
  objective        TEXT,
  type             ENUM('Aula','Atividade') NOT NULL DEFAULT 'Aula',
  duration         VARCHAR(20)     DEFAULT NULL,
  responsible_id   INT             REFERENCES users(id) ON DELETE SET NULL,
  status           ENUM('pendente','em_producao','em_revisao','concluido','aprovado','reprovado','ajuste_solicitado') NOT NULL DEFAULT 'pendente',
  delivery_date    DATE            DEFAULT NULL,
  original_file    VARCHAR(255)    DEFAULT NULL,
  original_file_size VARCHAR(20)   DEFAULT NULL,
  adjusted_file    VARCHAR(255)    DEFAULT NULL,
  adjusted_file_size VARCHAR(20)   DEFAULT NULL,
  review_status    ENUM('pendente','em_revisao','aprovado','reprovado','ajuste_solicitado') NOT NULL DEFAULT 'pendente',
  review_notes     TEXT            DEFAULT NULL,
  created_at       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Gestão de pessoas
CREATE TABLE IF NOT EXISTS people_management (
  id                              INT AUTO_INCREMENT PRIMARY KEY,
  user_id                         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supervisor_id                   INT REFERENCES users(id) ON DELETE SET NULL,
  function                        VARCHAR(100),
  attendance_status               ENUM('registrada','pendente','ausente','justificada') NOT NULL DEFAULT 'pendente',
  attendance_time                 VARCHAR(10) DEFAULT NULL,
  completed_activities_percentage INT DEFAULT 0 CHECK (completed_activities_percentage BETWEEN 0 AND 100),
  open_occurrences_count          INT DEFAULT 0,
  status                          ENUM('ativo','inativo','pendente','desligado','substituido') NOT NULL DEFAULT 'ativo',
  created_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Registros de frequência
CREATE TABLE IF NOT EXISTS attendance (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  status        ENUM('registrada','pendente','ausente','justificada') NOT NULL DEFAULT 'pendente',
  notes         TEXT DEFAULT NULL,
  registered_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_attendance (user_id, date)
);

-- Atividades dos profissionais
CREATE TABLE IF NOT EXISTS activities (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  percentage      INT DEFAULT 0 CHECK (percentage BETWEEN 0 AND 100),
  status          ENUM('pendente','em_andamento','concluida') NOT NULL DEFAULT 'pendente',
  reference_month VARCHAR(7) COMMENT 'Formato: YYYY-MM',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ocorrências
CREATE TABLE IF NOT EXISTS occurrences (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(150) NOT NULL,
  description TEXT,
  severity    ENUM('baixa','media','alta') NOT NULL DEFAULT 'baixa',
  status      ENUM('aberta','em_analise','resolvida','cancelada') NOT NULL DEFAULT 'aberta',
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  type       ENUM('success','warning','info','danger') NOT NULL DEFAULT 'info',
  read_at    DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Log de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(100) NOT NULL,
  entity_id   INT DEFAULT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices de performance
CREATE INDEX idx_materials_responsible ON materials(responsible_id);
CREATE INDEX idx_materials_status ON materials(status);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX idx_occurrences_user ON occurrences(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
