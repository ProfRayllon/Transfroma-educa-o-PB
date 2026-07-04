USE transforma_db;

-- A aprovacao passa a ser por conteudo (materials.supervisor_status / coordinator_status),
-- nao mais por modulo. Os valores antigos ('em_revisao','nao_validado','validado_com_ajustes',
-- 'valido') davam lugar ao novo vocabulario ('aguardando','aprovado','ajustes' para supervisor;
-- 'pendente','aprovado','ajustes','reprovado' para coordenacao). Convertido para VARCHAR para
-- nao travar em um ENUM fixo, no mesmo espirito da migracao que fez isso para materials.type.
ALTER TABLE materials
  MODIFY supervisor_status VARCHAR(20) NULL DEFAULT NULL,
  MODIFY coordinator_status VARCHAR(20) NULL DEFAULT NULL;
