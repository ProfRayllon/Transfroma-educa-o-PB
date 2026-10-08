'use strict'

/**
 * Gera os modelos das planilhas dos paineis em frontend/public/modelos/.
 *
 *   node scripts/gerar-modelos-planilhas.js
 *
 * As colunas seguem o que backend/src/modules/resultados/resultados.import.js
 * procura. Se o importador passar a ler uma coluna nova, rode este script de
 * novo para o modelo acompanhar. Os dados de exemplo sao ficticios.
 */

const fs = require('fs')
const path = require('path')
const { criarPlanilha } = require('../src/shared/xlsx')

const DESTINO = path.resolve(__dirname, '../../frontend/public/modelos')

function gravar(nome, colunas, linhas, nomeAba) {
  const buffer = criarPlanilha({
    nomeAba,
    colunas: colunas.map((titulo, i) => ({
      titulo,
      valor: (linha) => linha[i],
      // Coordenada vai como numero: como texto, o "-" do inicio ganharia um
      // apostrofo de protecao e o importador nao leria a coordenada.
      numerica: linhas.some((linha) => typeof linha[i] === 'number'),
    })),
    linhas,
  })
  fs.writeFileSync(path.join(DESTINO, nome), buffer)
  console.log(`gerado ${nome} (${buffer.length} bytes)`)
}

// Consolidado: uma linha por docente. Quem leciona em duas escolas pode vir
// numa linha so, com GRE, INEP e escola separados por " | ".
gravar('modelo-consolidado-curso.xlsx',
  ['CPF', 'Docente', 'GRE', 'INEP', 'Escola', 'Status'],
  [
    ['111.111.111-11', 'Maria Exemplo da Silva', '1ª GRE', '25000001', 'EEEF Escola Exemplo', 'CONCLUÍDO'],
    ['222.222.222-22', 'João Exemplo Souza', '3ª GRE', '25000002', 'ECIT Escola Modelo', 'NÃO CONCLUÍDO'],
    ['333.333.333-33', 'Ana Exemplo Lima', '16ª GRE', '25000003', 'EEEFM Escola Teste', 'EM ANDAMENTO'],
    ['444.444.444-44', 'Pedro Exemplo Costa', '2ª GRE', '25000004', 'EEEF Escola Amostra', 'NÃO INICIADO'],
    ['555.555.555-55', 'Lúcia Exemplo Rocha', '1ª GRE | 1ª GRE', '25000001 | 25000005', 'EEEF Escola Exemplo | EEEF Outra Escola', 'CONCLUÍDO'],
  ],
  'Consolidado')

// Avaliacao: a exportacao do formulario (Google Forms). Anonima: sem CPF, nome
// ou e-mail. Toda coluna que nao e carimbo, turma, componente ou curso e lida
// como pergunta; a escala de cada uma e deduzida pelas respostas.
gravar('modelo-avaliacao-curso.xlsx',
  [
    'Carimbo de data/hora',
    'Turma',
    'Componente curricular',
    'Curso que está avaliando',
    'De 1 a 5, qual nota você dá ao curso?',
    'O conteúdo foi relevante para a sua prática?',
    'As orientações das atividades foram claras?',
    'Você recomendaria este curso a um colega?',
  ],
  [
    ['10/09/2026 14:32:10', 'Turma 01', 'Língua Portuguesa', 'Nome do curso', '5', 'Muito relevante', 'Totalmente', 'Sim'],
    ['10/09/2026 15:01:44', 'Turma 01', 'Matemática', 'Nome do curso', '4', 'Relevante', 'Parcialmente', 'Sim'],
    ['11/09/2026 09:12:03', 'Turma 02', 'História', 'Nome do curso', '3', 'Pouco relevante', 'Pouco', 'Não'],
    ['11/09/2026 10:40:27', 'Turma 02', 'Biologia', 'Nome do curso', '2', 'Irrelevante', 'Nada', 'Não'],
  ],
  'Respostas')

// Escolas e municipios: o de-para INEP -> municipio do Censo Escolar. So INEP e
// municipio sao obrigatorios; as demais colunas enriquecem o mapa.
gravar('modelo-escolas-municipios.xlsx',
  ['INEP', 'Escola', 'Município', 'UF', 'Localização', 'Porte', 'Latitude', 'Longitude'],
  [
    ['25000001', 'EEEF Escola Exemplo', 'João Pessoa', 'PB', 'Urbana', 'Médio', -7.1195, -34.845],
    ['25000002', 'ECIT Escola Modelo', 'Campina Grande', 'PB', 'Urbana', 'Grande', -7.2307, -35.8817],
    ['25000003', 'EEEFM Escola Teste', 'Sousa', 'PB', 'Rural', 'Pequeno', -6.7593, -38.2316],
  ],
  'Escolas')
