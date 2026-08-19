USE transforma_db;

-- Marcacao "Publicado" por conteudo, preenchida exclusivamente pelo perfil TI
-- quando o material ja foi publicado no AVA (Moodle).
ALTER TABLE materials
  ADD COLUMN published TINYINT(1) NOT NULL DEFAULT 0 AFTER review_notes;
