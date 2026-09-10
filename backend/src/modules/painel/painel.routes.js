'use strict'

const express = require('express')
const repo = require('./painel.repo')
const resultados = require('../resultados/resultados.repo')
const { montarCsv } = require('../../shared/csv')

/**
 * O painel institucional, numa chamada so.
 *
 * Sao onze consultas agregadas. Vem todas juntas porque o painel e um deck que
 * troca de cena a cada poucos segundos: buscar cena a cena faria cada virada
 * esperar a rede, e no modo automatico a tela piscaria a cada rotacao. Buscar
 * tudo de uma vez tambem garante que os numeros das cenas sejam do MESMO
 * instante -- um total de cursistas na cena 1 que nao fecha com a soma das GREs
 * na cena 2 destroi a confianca de quem esta assistindo.
 *
 * As consultas rodam em paralelo: sao independentes entre si e o pool aguenta.
 */

const PERFIS_COM_ACESSO = ['administrador', 'gerencia']

// Cache curto em memoria, por combinacao de filtros. O dashboard fica aberto e
// se atualiza; sem isso, cada atualizacao bateria as onze consultas de novo para
// devolver numeros que mudam em escala de horas.
//
// O limite existe porque a chave inclui o curso: sem ele, uma sessao clicando em
// curso por curso faria o cache crescer sem fim dentro do processo.
const CACHE_MS = 60 * 1000
const CACHE_MAX = 24
const cache = new Map()

function doCache(chave) {
  const item = cache.get(chave)
  if (!item) return null
  if (Date.now() - item.em > CACHE_MS) { cache.delete(chave); return null }
  return item.dados
}

function guardar(chave, dados) {
  // Map preserva a ordem de insercao: a primeira chave e a mais antiga.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value)
  cache.set(chave, { em: Date.now(), dados })
}

const DIAS_ACEITOS = [7, 15, 30]

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function normalizarMes(valor) {
  return /^\d{4}-\d{2}$/.test(String(valor || '')) ? valor : mesAtual()
}

function normalizarDias(valor) {
  const n = Number(valor)
  return DIAS_ACEITOS.includes(n) ? n : 30
}

// Curso invalido vira "sem filtro", e nao erro: o dashboard e uma tela de
// leitura, e derrubar o painel inteiro porque um id veio torto seria pior do
// que mostrar o retrato geral.
function normalizarCurso(valor) {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * A GRE aceita so o formato que existe no banco.
 *
 * Nao e defesa contra injecao -- o valor vai como parametro ligado de qualquer
 * jeito. E para o texto virar chave de cache: sem o recorte, uma consulta com
 * "1a GRE  " e outra com "1ª GRE" ocupariam duas entradas para o mesmo
 * resultado, e vinte variacoes esvaziariam o cache inteiro.
 */
const ROTULOS_STATUS = {
  concluido: 'Concluido',
  nao_concluido: 'Nao concluido',
  em_andamento: 'Em andamento',
}

/**
 * O componente curricular filtra a AVALIACAO, e nada mais.
 *
 * Ele existe no cadastro do cursista e nas respostas do formulario, mas nao no
 * consolidado -- entao um filtro de componente nao recorta conclusao. A tela
 * so o oferece no painel do consolidado por isso.
 *
 * Recortado em 120 caracteres, o tamanho da coluna: alem de nao casar com nada,
 * texto longo entraria na chave do cache e a encheria.
 */
function normalizarComponente(valor) {
  const texto = String(valor || '').trim().slice(0, 120)
  return texto || null
}

function normalizarStatus(valor) {
  return Object.keys(ROTULOS_STATUS).includes(String(valor)) ? String(valor) : null
}

const formatarCpf = (cpf) => {
  const d = String(cpf || '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d
}

function normalizarGre(valor) {
  const texto = String(valor || '').trim()
  return /^\d{1,2}ª GRE$/.test(texto) ? texto : null
}

module.exports = function criarRotasPainel({ authInterna, requireRole }) {
  const router = express.Router()
  router.use(authInterna)

  router.get('/', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const mes = normalizarMes(req.query.mes)
      const dias = normalizarDias(req.query.dias)
      const cursoId = normalizarCurso(req.query.curso)
      const gre = normalizarGre(req.query.gre)
      const componente = normalizarComponente(req.query.componente)
      const chave = `${mes}|${dias}|${cursoId || 0}|${gre || '-'}|${componente || '-'}`

      const guardado = doCache(chave)
      if (guardado) return res.json({ ...guardado, doCache: true })

      /* Tres listas sairam daqui e continuam no repo, testadas: `acessosPorHora`,
         `escolasComMaisCursistas` e o bloco operacional (`equipe`, `producao`,
         `frequenciaDaEquipe`). A coordenacao pediu foco no painel institucional,
         e agregar 40 mil linhas de auditoria por hora para ninguem ler e
         trabalho jogado fora. Devolver qualquer uma e uma linha nesta lista mais
         uma no payload. */
      const [
        totais, porGre, funil, perfil, inscricoes, serie,
        conclusao, conclusaoPorGre, avaliacao, nota, evolucao, opcoes,
        escolasConcluintes, porFuncao, porComponente, porMunicipio,
        evolucaoRespostas, componentes,
      ] = await Promise.all([
        repo.totais({ cursoId, dias, gre }),
        repo.porGre({ cursoId }),
        repo.funil(),
        repo.perfilDaRede({ cursoId, gre }),
        repo.inscricoesPorCurso({ gre }),
        repo.serie({ cursoId, dias, gre }),

        /* A avaliacao nao recebe `gre`: ela e anonima e nao carrega regional.
           Nao e esquecimento -- e o motivo de a tela precisar dizer, quando ha
           filtro de regional ativo, que este bloco continua sendo da rede
           inteira. Filtro que a metade dos numeros ignora em silencio e pior
           que filtro nenhum. */
        resultados.conclusao({ cursoId, gre }),
        resultados.conclusaoPorGre({ cursoId }),
        /* A avaliacao aceita `componente`, e nao `gre`: o formulario e anonimo
           e registra o componente de quem respondeu, mas nao a regional. */
        resultados.avaliacaoPorPergunta({ cursoId, componente }),
        resultados.avaliacaoNota({ cursoId, componente }),
        resultados.evolucaoDaConclusao({ cursoId }),
        resultados.opcoesDeFiltro(),

        /* Escolas e funcao pertencem ao painel de concluintes. Vem no mesmo
           pacote porque sao agregados de poucos bytes -- o que NAO vem aqui e a
           lista de gente, que tem rota propria e paginacao. */
        resultados.escolasDoConsolidado({ cursoId, gre }),
        resultados.concluintesPorFuncao({ cursoId, gre }),

        /* Os tres rankings lado a lado do painel de concluintes. Cada um chega
           por um caminho diferente: escola vem da propria planilha, componente
           vem do cadastro pelo CPF, e municipio vem da escola pelo INEP. */
        resultados.concluintesPorComponente({ cursoId, gre }),
        resultados.concluintesPorMunicipio({ cursoId, gre }),

        resultados.avaliacaoEvolucao({ cursoId, componente }),
        resultados.componentesAvaliadores({ cursoId }),
      ])

      const dados = {
        geradoEm: new Date().toISOString(),
        mes,
        dias,
        // Devolvido de volta para a tela nao precisar confiar no proprio estado:
        // se o servidor recusou o filtro, o rotulo mostra o que ele realmente usou.
        cursoId,
        gre,
        componente,
        // O que existe para filtrar sai do banco, e nao de uma lista fixa na
        // tela: oferecer um curso sem planilha importada faria a pessoa
        // selecionar, ver tudo zerar, e concluir que o curso fracassou em vez de
        // que a planilha ainda nao chegou.
        opcoes,
        institucional: {
          totais, porGre, funil, perfil, inscricoes, serie,
          resultados: {
            conclusao, porGre: conclusaoPorGre, avaliacao, nota, evolucao,
            escolas: escolasConcluintes, porFuncao, porComponente, porMunicipio,
            evolucaoRespostas, componentes,
          },
        },
      }

      guardar(chave, dados)
      res.json(dados)
    } catch (erro) {
      // A mensagem do 503 e informativa (falta MySQL) e passa; qualquer outra
      // vira texto generico, para detalhe de banco nao vazar para a tela.
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel montar o dashboard.',
      })
    }
  })

  /**
   * A lista de docentes do consolidado.
   *
   * Rota separada, e sem o cache de um minuto que o dashboard usa: aqui a
   * resposta muda a cada busca digitada e a cada pagina virada, e guardar isso
   * encheria o cache de combinacoes que ninguem repete -- alem de deixar dado
   * pessoal parado na memoria do processo.
   *
   * O CPF sai mascarado do repositorio. Quem precisa do numero inteiro usa a
   * exportacao, que e um ato deliberado.
   */
  router.get('/concluintes/lista', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const dados = await resultados.listaDeConcluintes({
        cursoId: normalizarCurso(req.query.curso),
        gre: normalizarGre(req.query.gre),
        status: normalizarStatus(req.query.status),
        busca: String(req.query.busca || '').slice(0, 80),
        pagina: Number(req.query.pagina) || 1,
        porPagina: Number(req.query.porPagina) || 25,
      })
      res.json(dados)
    } catch (erro) {
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel carregar a lista.',
      })
    }
  })

  /**
   * A mesma lista em CSV, com o CPF completo.
   *
   * Aqui o numero inteiro sai, porque a planilha existe para cruzar com outros
   * sistemas e CPF pela metade nao cruza com nada. O que separa isto da tela e
   * que baixar um arquivo e uma acao deliberada, feita por alguem que ja passou
   * pelo login e pelo perfil.
   */
  router.get('/concluintes/exportar', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const linhas = await resultados.listaParaExportar({
        cursoId: normalizarCurso(req.query.curso),
        gre: normalizarGre(req.query.gre),
        status: normalizarStatus(req.query.status),
      })

      const csv = montarCsv([
        { titulo: 'Docente', valor: (l) => l.docente },
        // O CPF vai com pontuacao para o Excel nao tratar como numero e comer o
        // zero a esquerda -- que e como o CPF chega torto de volta na proxima
        // planilha.
        { titulo: 'CPF', valor: (l) => formatarCpf(l.cpf) },
        { titulo: 'GRE', valor: (l) => l.gre },
        { titulo: 'INEP', valor: (l) => l.inep },
        { titulo: 'Escola', valor: (l) => l.escola },
        { titulo: 'Curso', valor: (l) => l.curso },
        { titulo: 'Situacao', valor: (l) => ROTULOS_STATUS[l.status] || l.status },
      ], linhas)

      const hoje = new Date().toISOString().slice(0, 10)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="docentes-concluintes-${hoje}.csv"`)
      res.send(csv)
    } catch (erro) {
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel exportar a lista.',
      })
    }
  })

  /**
   * O detalhamento da avaliacao, resposta a resposta.
   *
   * Rota separada e sem cache, pelo mesmo motivo da lista de concluintes: a
   * resposta muda a cada busca e a cada pagina, e guardar isso encheria o cache
   * de combinacoes que ninguem repete.
   */
  router.get('/avaliacao/detalhe', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const dados = await resultados.avaliacaoDetalhe({
        cursoId: normalizarCurso(req.query.curso),
        componente: normalizarComponente(req.query.componente),
        situacao: ['positiva', 'neutra', 'negativa'].includes(req.query.situacao)
          ? req.query.situacao : null,
        busca: String(req.query.busca || '').slice(0, 80),
        pagina: Number(req.query.pagina) || 1,
        porPagina: Number(req.query.porPagina) || 25,
      })
      res.json(dados)
    } catch (erro) {
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel carregar o detalhamento.',
      })
    }
  })

  /**
   * A avaliacao em CSV.
   *
   * Sem paginacao e com todas as perguntas em colunas -- e o formato que serve
   * para cruzar com outra coisa, que e para o que a planilha existe. Continua
   * sem identificar ninguem: o formulario e anonimo na origem.
   */
  router.get('/avaliacao/exportar', requireRole(...PERFIS_COM_ACESSO), async (req, res) => {
    try {
      const cursoId = normalizarCurso(req.query.curso)
      const componente = normalizarComponente(req.query.componente)

      const perguntas = await resultados.avaliacaoPorPergunta({ cursoId })
      const itens = await resultados.avaliacaoParaExportar({ cursoId, componente })

      const csv = montarCsv([
        { titulo: 'Data', valor: (l) => (l.quando || '').slice(0, 10).split('-').reverse().join('/') },
        { titulo: 'Hora', valor: (l) => (l.quando || '').slice(11) },
        { titulo: 'Turma', valor: (l) => l.turma || '' },
        { titulo: 'Componente curricular', valor: (l) => l.componente || '' },
        { titulo: 'Respostas positivas', valor: (l) => `${l.positivas} de ${l.respondidas}` },
        // Uma coluna por pergunta, com o texto que a pessoa marcou. O cabecalho
        // e a pergunta inteira: quem abre a planilha meses depois nao tem a tela
        // do lado para lembrar o que era "item 7".
        ...perguntas.map((q) => ({
          titulo: q.pergunta,
          valor: (l) => l.respostas[String(q.ordem)] || '',
        })),
      ], itens)

      const hoje = new Date().toISOString().slice(0, 10)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="avaliacao-do-curso-${hoje}.csv"`)
      res.send(csv)
    } catch (erro) {
      const status = erro.statusCode || 500
      res.status(status).json({
        message: status === 503 ? erro.message : 'Nao foi possivel exportar a avaliacao.',
      })
    }
  })

  return router
}
