USE transforma_db;

-- Limpa os dados operacionais e remove usuarios seed,
-- preservando apenas o administrador de id 1 para nao perder acesso.
-- Depois da limpeza, edite esse admin pelo painel com os dados reais.

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE attendance;
TRUNCATE TABLE activities;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE materials;
TRUNCATE TABLE notifications;
TRUNCATE TABLE occurrences;
TRUNCATE TABLE people_management;

DELETE FROM users WHERE id <> 1;
ALTER TABLE users AUTO_INCREMENT = 2;

SET FOREIGN_KEY_CHECKS = 1;
