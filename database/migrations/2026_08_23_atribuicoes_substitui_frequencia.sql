USE transforma_db;

-- ---------------------------------------------------------------------------
-- O modulo de Frequencia passa a girar em torno de ATRIBUICOES.
--
-- O modelo anterior media metas mensais por perfil: um "criterio" pertencia a
-- (perfil, mes) e cada pessoa daquele perfil ganhava um "lancamento" gerado a
-- partir dele. O que a coordenacao precisa e outra coisa -- atividades
-- atribuidas a pessoas, com um avaliador escolhido no ato e um check-in de quem
-- executa. Sao perguntas diferentes, e por isso o modelo muda em vez de ganhar
-- mais colunas.
--
-- O que sai junto com as tabelas antigas: os dois tipos de criterio
-- (quantitativo/qualitativo), a meta com unidade e realizado, o percentual
-- gravado, os pesos das atividades (que nunca entraram em nenhum calculo) e os
-- quatro status em lista unica.
--
-- A tabela nova tambem e criada no boot da API
-- (src/modules/atribuicoes/atribuicoes.schema.js), para o deploy nao depender
-- de alguem lembrar de rodar este arquivo. Ele fica como registro da mudanca e
-- para quem preferir aplicar o esquema a mao.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS atribuicoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(150) NOT NULL,
  descricao TEXT DEFAULT NULL,

  -- Quem executa. Qualquer perfil menos administrador.
  responsavel_id INT NOT NULL,
  -- Quem julga se cumpriu. Escolhido no ato da atribuicao.
  avaliador_id INT NOT NULL,
  criado_por INT DEFAULT NULL,

  mes_referencia CHAR(7) NOT NULL,
  -- Vazio significa "ate o fim do mes de referencia".
  prazo DATE DEFAULT NULL,

  -- Eixo 1: a pessoa responde "fiz?".
  checkin_em DATETIME DEFAULT NULL,
  checkin_obs TEXT DEFAULT NULL,

  -- Eixo 2: o avaliador responde "conta como cumprido?".
  -- Nulo com check-in preenchido = aguardando avaliacao.
  avaliacao ENUM('cumprido','nao_cumprido') DEFAULT NULL,
  avaliacao_obs TEXT DEFAULT NULL,
  avaliado_em DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_atribuicoes_responsavel
    FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_atribuicoes_avaliador
    FOREIGN KEY (avaliador_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_atribuicoes_criado_por
    FOREIGN KEY (criado_por) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_atribuicoes_responsavel (responsavel_id, mes_referencia),
  INDEX idx_atribuicoes_avaliador (avaliador_id, mes_referencia),
  INDEX idx_atribuicoes_mes (mes_referencia)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Limpeza do modulo antigo.
--
-- Sem conversao de dados: o modulo de Frequencia nunca chegou a ser
-- disponibilizado para a equipe e tudo que existe nessas tabelas e teste.
--
-- Rode esta parte SO depois de a API nova estar no ar -- ate la as tabelas
-- podem ficar onde estao sem incomodar ninguem, ja que nenhum codigo as
-- consulta mais. Lancamentos antes de criterios por causa da chave estrangeira.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS frequencia_lancamentos;
DROP TABLE IF EXISTS frequencia_criterios;
