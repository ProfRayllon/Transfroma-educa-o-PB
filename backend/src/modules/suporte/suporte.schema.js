'use strict'

const { getPool, isMysqlMode } = require('../../shared/db')

/**
 * Tabelas do Suporte: os chamados e o historico de cada um.
 *
 * O DDL roda no boot, como nos outros modulos -- o projeto nao tem migration
 * runner, e CREATE TABLE IF NOT EXISTS torna a repeticao inofensiva.
 */
async function garantirEsquema() {
  if (!isMysqlMode()) return
  const pool = getPool()

  /**
   * Um chamado aberto por qualquer pessoa, logada ou nao.
   *
   * Nome, CPF e e-mail ficam no proprio chamado, e nao numa FK para cursistas:
   * quem mais precisa de suporte e justamente quem nao consegue entrar, e muitas
   * vezes nem esta na base. O CPF e o que permite consultar o protocolo depois
   * sem conta nenhuma.
   *
   * `encaminhado_perfil` e `responsavel_id` sao os dois jeitos de delegar: para
   * um perfil inteiro (qualquer pessoa dele pode assumir) ou para uma pessoa.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suporte_chamados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      protocolo VARCHAR(20) DEFAULT NULL,
      nome VARCHAR(150) NOT NULL,
      cpf CHAR(11) NOT NULL,
      email VARCHAR(190) NOT NULL,
      categoria ENUM('sistema','ava','certificado','dados','duvida','outro') NOT NULL,
      descricao TEXT NOT NULL,
      status ENUM('aberto','em_andamento','aguardando_solicitante','resolvido','cancelado') NOT NULL DEFAULT 'aberto',
      encaminhado_perfil VARCHAR(30) DEFAULT NULL,
      responsavel_id INT DEFAULT NULL,
      resolucao TEXT DEFAULT NULL,
      resolvido_em DATETIME DEFAULT NULL,
      ip VARCHAR(45) DEFAULT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uq_suporte_protocolo (protocolo),
      KEY ix_suporte_status (status),
      KEY ix_suporte_cpf (cpf),
      KEY ix_suporte_responsavel (responsavel_id),
      KEY ix_suporte_perfil (encaminhado_perfil),
      CONSTRAINT fk_suporte_responsavel
        FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  /**
   * Tudo o que aconteceu com o chamado, em ordem.
   *
   * `publico` separa o que o solicitante enxerga na consulta do protocolo (as
   * respostas e a resolucao) do que e conversa interna da equipe (notas,
   * encaminhamentos). A consulta publica so le linhas com publico = 1.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suporte_historico (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chamado_id INT NOT NULL,
      autor_id INT DEFAULT NULL,
      autor_nome VARCHAR(150) DEFAULT NULL,
      tipo ENUM('abertura','status','encaminhamento','nota','resposta','email') NOT NULL,
      mensagem TEXT DEFAULT NULL,
      publico TINYINT(1) NOT NULL DEFAULT 0,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      KEY ix_suporte_historico_chamado (chamado_id),
      CONSTRAINT fk_suporte_historico_chamado
        FOREIGN KEY (chamado_id) REFERENCES suporte_chamados(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

module.exports = { garantirEsquema }
