USE transforma_db;

-- "details" (texto livre sobre o criterio, opcional) e "activities" (lista de atividades com
-- peso percentual, usada nos criterios qualitativos) para o modulo de Frequencia.
ALTER TABLE frequencia_criterios
  ADD COLUMN details TEXT DEFAULT NULL AFTER title,
  ADD COLUMN activities TEXT DEFAULT NULL AFTER unit;
