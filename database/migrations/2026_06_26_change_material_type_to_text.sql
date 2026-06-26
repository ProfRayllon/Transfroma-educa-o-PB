-- Converte a coluna type de ENUM para VARCHAR para suportar múltiplos tipos em JSON
ALTER TABLE materials
  MODIFY COLUMN type VARCHAR(500) NOT NULL DEFAULT 'videoaula';
