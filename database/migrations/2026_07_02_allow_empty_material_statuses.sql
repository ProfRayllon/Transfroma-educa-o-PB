USE transforma_db;

ALTER TABLE materials
  MODIFY status ENUM(
    'pendente',
    'em_producao',
    'em_revisao',
    'concluido',
    'aprovado',
    'reprovado',
    'ajuste_solicitado',
    'em_execucao',
    'validado',
    'em_ajustes',
    'revisao_linguistica',
    'edicao',
    'nao_iniciado'
  ) NULL DEFAULT NULL;

ALTER TABLE materials
  MODIFY supervisor_status ENUM(
    'em_revisao',
    'nao_validado',
    'validado_com_ajustes',
    'valido'
  ) NULL DEFAULT NULL;

ALTER TABLE materials
  MODIFY coordinator_status ENUM(
    'em_revisao',
    'nao_validado',
    'validado_com_ajustes',
    'valido'
  ) NULL DEFAULT NULL;
