USE transforma_db;

ALTER TABLE materials
  MODIFY type ENUM(
    'Aula',
    'Atividade',
    'videoaula',
    'apresentacao',
    'atividade_escrita',
    'material_complementar',
    'atividade_interativa',
    'outro',
    'ebook',
    'avaliacao_final',
    'atividade_objetiva',
    'pdf'
  ) NOT NULL DEFAULT 'videoaula';

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
    'edicao'
  ) NOT NULL DEFAULT 'em_execucao';

ALTER TABLE materials
  MODIFY review_status ENUM(
    'pendente',
    'em_revisao',
    'aprovado',
    'reprovado',
    'ajuste_solicitado',
    'em_execucao',
    'validado',
    'em_ajustes',
    'revisao_linguistica',
    'edicao',
    'concluido',
    'esperando_material'
  ) NOT NULL DEFAULT 'em_execucao';
