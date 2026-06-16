USE transforma_db;

ALTER TABLE users
  MODIFY role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao') NOT NULL DEFAULT 'professor';

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
