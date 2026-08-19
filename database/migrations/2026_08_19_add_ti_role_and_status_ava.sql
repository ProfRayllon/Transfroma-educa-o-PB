USE transforma_db;

-- Novo perfil "TI": enxerga todos os cursos e e o unico que define o status no AVA.
ALTER TABLE users
  MODIFY role ENUM('administrador','coordenador','supervisor','professor','tutor','tecnico','gestao','revisor','supervisor_tutoria','ti') NOT NULL DEFAULT 'professor';

-- Status do curso no AVA (Ambiente Virtual de Aprendizagem), definido apenas pelo perfil TI.
ALTER TABLE courses
  ADD COLUMN status_ava ENUM('nao_publicado','publicado') NOT NULL DEFAULT 'nao_publicado' AFTER image;
