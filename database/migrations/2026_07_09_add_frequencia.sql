USE transforma_db;

-- Novo perfil "Supervisor de tutoria", separado do Supervisor de producao de conteudo.
ALTER TABLE users
  MODIFY role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao','revisor','supervisor_tutoria') NOT NULL DEFAULT 'professor';

-- Modulo "Frequencia": criterios mensais por perfil avaliado + lancamentos por usuario.
-- Um criterio vale para (perfil, mes) e passa a valer automaticamente para todo usuario
-- ativo daquele perfil no mes -- nao ha vinculo criterio-usuario manual.
CREATE TABLE IF NOT EXISTS frequencia_criterios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(30) NOT NULL,
  title VARCHAR(150) NOT NULL,
  type ENUM('quantitativo','qualitativo') NOT NULL DEFAULT 'quantitativo',
  unit VARCHAR(40) DEFAULT NULL,
  target DECIMAL(10,2) DEFAULT NULL,
  reference_month VARCHAR(7) NOT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_frequencia_criterios_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS frequencia_lancamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  criterio_id INT NOT NULL,
  user_id INT NOT NULL,
  target DECIMAL(10,2) DEFAULT NULL,
  realized DECIMAL(10,2) DEFAULT NULL,
  frequency_pct DECIMAL(5,2) DEFAULT NULL,
  status ENUM('pendente','em_andamento','concluido','em_revisao') NOT NULL DEFAULT 'pendente',
  notes TEXT DEFAULT NULL,
  attachment_note VARCHAR(255) DEFAULT NULL,
  registered_by INT DEFAULT NULL,
  registered_at DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_frequencia_lancamentos_criterio_user (criterio_id, user_id),
  CONSTRAINT fk_frequencia_lancamentos_criterio
    FOREIGN KEY (criterio_id) REFERENCES frequencia_criterios(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_frequencia_lancamentos_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_frequencia_lancamentos_registered_by
    FOREIGN KEY (registered_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_frequencia_criterios_role_month ON frequencia_criterios(role, reference_month);
CREATE INDEX idx_frequencia_lancamentos_user ON frequencia_lancamentos(user_id);
