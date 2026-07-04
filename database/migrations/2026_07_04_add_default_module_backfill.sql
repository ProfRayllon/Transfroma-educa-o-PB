USE transforma_db;

ALTER TABLE course_modules
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0;

-- O backfill de conteudos orfaos (module_id nulo) para um modulo padrao "Modulo 1"
-- roda automaticamente pelo backend (store.js -> ensureDefaultModuleIfNeeded), de
-- forma incremental por curso, na primeira vez que a producao daquele curso for
-- aberta. Nao apaga nem altera nenhum outro campo dos conteudos existentes.
