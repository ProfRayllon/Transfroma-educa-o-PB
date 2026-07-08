USE transforma_db;

-- Novo papel "revisor(a)": etapa final de aprovacao de conteudo, depois do coordenador.
ALTER TABLE users
  MODIFY role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao','revisor') NOT NULL DEFAULT 'professor';

ALTER TABLE materials
  ADD COLUMN revisor_id INT NULL DEFAULT NULL AFTER coordinator_status,
  ADD COLUMN revisor_name VARCHAR(150) NULL DEFAULT NULL AFTER revisor_id,
  ADD COLUMN revisor_status VARCHAR(20) NULL DEFAULT NULL AFTER revisor_name,
  ADD CONSTRAINT fk_materials_revisor
    FOREIGN KEY (revisor_id) REFERENCES users(id)
    ON DELETE SET NULL;

-- Pool de revisores por curso (varios possiveis, um so e escolhido por conteudo),
-- mesmo padrao de course_producers.
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
