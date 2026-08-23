'use strict'

const { getPool, isMysqlMode } = require('../../shared/db')

/**
 * Esquema do modulo de Atribuicoes, garantido no boot.
 *
 * A tabela nasce aqui e nao so na migracao porque o deploy nao deve depender de
 * alguem lembrar de rodar SQL no servidor -- esquecer seria a API subir e
 * quebrar na primeira consulta. O boot dos processos e serializado em
 * server.js, entao dois trabalhadores nao disputam a criacao.
 *
 * UMA tabela, e nao duas. O modulo antigo separava "criterio" (a regra, ligada a
 * um perfil e um mes) de "lancamento" (a linha de cada pessoa, gerada a partir
 * da regra), e as duas pontas precisavam ser mantidas em sincronia -- era dai
 * que vinha a trava de um criterio por pessoa por mes. Aqui a unidade e a
 * propria atribuicao: uma linha por pessoa, por atividade, por mes. Atribuir a
 * mesma atividade a dez pessoas grava dez linhas independentes.
 */
async function garantirEsquema() {
  if (!isMysqlMode()) return

  const pool = getPool()

  // `query` e nao `execute`: DDL sem nenhum parametro nao ganha nada em ser
  // preparada, e o caminho sem prepare e o que o resto do sistema ja usa para
  // criar tabela.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atribuicoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(150) NOT NULL,
      descricao TEXT DEFAULT NULL,

      -- Quem executa. Qualquer perfil menos administrador.
      responsavel_id INT NOT NULL,
      -- Quem julga se cumpriu. Escolhido no ato da atribuicao: sem este campo
      -- a avaliacao nao tem dono e vira "quem tiver permissao no perfil".
      avaliador_id INT NOT NULL,
      criado_por INT DEFAULT NULL,

      mes_referencia CHAR(7) NOT NULL,
      -- Vazio significa "ate o fim do mes de referencia".
      prazo DATE DEFAULT NULL,

      -- Eixo 1: a pessoa responde "fiz?". A data e o proprio fato -- nulo e
      -- "ainda nao marcou", e nao existe estado intermediario para inventar.
      checkin_em DATETIME DEFAULT NULL,
      checkin_obs TEXT DEFAULT NULL,

      -- Eixo 2: o avaliador responde "conta como cumprido?". Nulo e "aguardando
      -- avaliacao". Separado do check-in de proposito: misturar os dois foi o
      -- que produziu os quatro status do modulo antigo, em que ninguem sabia se
      -- "em revisao" era coisa de quem faz ou de quem avalia.
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

      -- As tres leituras do modulo: a lista da pessoa, a fila do avaliador e o
      -- acompanhamento do mes.
      INDEX idx_atribuicoes_responsavel (responsavel_id, mes_referencia),
      INDEX idx_atribuicoes_avaliador (avaliador_id, mes_referencia),
      INDEX idx_atribuicoes_mes (mes_referencia)
    ) ENGINE=InnoDB
  `)
}

module.exports = { garantirEsquema }
