'use strict'

const repo = require('./cursistas.repo')
const { getPool, requireMysql } = require('../../shared/db')
const { normalizeCpf, isValidCpf } = require('../../shared/cpf')
const { lerPlanilha, normalizarData } = require('../../shared/xlsx')
const { registrar, ACOES } = require('../../shared/audit')

const ABA_USUARIOS = 'USUARIOS'
const ABA_PERFIL = 'PERFIL_DOCENTE'
const MAX_REGISTROS = 20000
const MAX_VINCULOS = 4

// Lotes de 500 mantem cada consulta pequena o bastante para a VPS (que tem pouca
// RAM livre) e reduzem 13 mil idas ao banco para ~26.
const TAMANHO_DO_LOTE = 500

function erro(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

const texto = (valor, limite) => String(valor ?? '').trim().slice(0, limite) || null
const bandeira = (valor) => ['1', 'sim', 'true', 's'].includes(String(valor ?? '').trim().toLowerCase())

/** Le e valida o arquivo sem consultar nem alterar o banco. */
function lerRegistros(arquivo) {
  if (!Buffer.isBuffer(arquivo) || arquivo.length === 0) {
    throw erro(400, 'Envie o arquivo .xlsx da base.')
  }

  const abas = lerPlanilha(arquivo)

  const usuarios = abas.get(ABA_USUARIOS)
  if (!usuarios) {
    throw erro(400, `A planilha precisa ter a aba "${ABA_USUARIOS}". Abas encontradas: ${[...abas.keys()].join(', ') || 'nenhuma'}.`)
  }
  const perfis = abas.get(ABA_PERFIL)

  for (const coluna of ['CPF', 'NOME_COMPLETO']) {
    if (!usuarios.cabecalho.includes(coluna)) {
      throw erro(400, `A aba ${ABA_USUARIOS} precisa da coluna ${coluna}.`)
    }
  }
  if (usuarios.registros.length > MAX_REGISTROS) {
    throw erro(400, `A base tem ${usuarios.registros.length} registros; o limite e ${MAX_REGISTROS}.`)
  }

  // Perfil indexado por USUARIO_ID e, como reserva, por CPF -- se a coluna de
  // ligacao vier vazia numa das abas, o CPF ainda casa os dois lados.
  const perfilPorUsuario = new Map()
  const perfilPorCpf = new Map()
  for (const registro of perfis?.registros || []) {
    const chave = texto(registro.USUARIO_ID)
    if (chave) perfilPorUsuario.set(chave, registro)
    const cpf = normalizeCpf(registro.CPF)
    if (cpf) perfilPorCpf.set(cpf, registro)
  }

  const temColunaAtivo = usuarios.cabecalho.includes('ATIVO')

  const validos = []
  const rejeitados = []
  const cpfsVistos = new Map()
  let semPerfil = 0

  usuarios.registros.forEach((linha, posicao) => {
    const numeroDaLinha = posicao + 2 // +1 do cabecalho, +1 porque planilha comeca em 1
    const cpf = normalizeCpf(linha.CPF)
    const nome = texto(linha.NOME_COMPLETO, 150)

    if (!cpf || !isValidCpf(cpf)) {
      rejeitados.push({ tipo: 'invalido', linha: numeroDaLinha, cpf: String(linha.CPF || ''), name: nome || '', usuarioId: texto(linha.USUARIO_ID, 20) || '', motivo: 'CPF invalido' })
      return
    }
    if (!nome) {
      rejeitados.push({ tipo: 'invalido', linha: numeroDaLinha, cpf, name: '', usuarioId: texto(linha.USUARIO_ID, 20) || '', motivo: 'NOME_COMPLETO vazio' })
      return
    }
    if (cpfsVistos.has(cpf)) {
      rejeitados.push({ tipo: 'duplicado', linha: numeroDaLinha, cpf, name: nome, usuarioId: texto(linha.USUARIO_ID, 20) || '', motivo: `CPF repetido no arquivo (ja aparece na linha ${cpfsVistos.get(cpf)})` })
      return
    }
    cpfsVistos.set(cpf, numeroDaLinha)

    const usuarioId = texto(linha.USUARIO_ID, 20)
    // CPF e a referencia principal. USUARIO_ID so ajuda a ligar as abas quando
    // o CPF nao foi repetido no perfil.
    const perfil = perfilPorCpf.get(cpf) || (usuarioId && perfilPorUsuario.get(usuarioId)) || {}
    const semPerfilDoRegistro = !Object.keys(perfil).length
    if (semPerfilDoRegistro) semPerfil += 1

    const vinculos = []
    for (let ordem = 1; ordem <= MAX_VINCULOS; ordem += 1) {
      const inep = texto(perfil[`INEP_${ordem}`], 12)
      const gre = texto(perfil[`GRE_${ordem}`], 60)
      const escola = texto(perfil[`ESCOLA_${ordem}`], 200)
      if (inep || gre || escola) vinculos.push({ ordem, inep, gre, escola })
    }

    validos.push({
      linha: numeroDaLinha,
      semPerfil: semPerfilDoRegistro,
      usuarioId,
      cpf,
      name: nome,
      // Dados funcionais: vem da base e o cursista nao altera.
      funcao: texto(perfil.FUNCAO, 120),
      componenteCurricular: texto(perfil.COMPONENTE_CURRICULAR, 120),
      eixoTecnologico: texto(perfil.EIXO_TECNOLOGICO, 120),
      cursoTecnico: texto(perfil.CURSO_TECNICO, 120),
      formacaoEncontrada: bandeira(perfil.FORMACAO_ENCONTRADA),
      qtdeVinculos: Number(perfil.QTDE_VINCULOS || linha.QTDE_VINCULOS) || vinculos.length || 1,
      dataInicioRede: normalizarData(perfil.DATA_INICIO_REDE_ESTADUAL),
      // Dados de contato: a base preenche o que tem; o cursista completa depois.
      birthDate: normalizarData(perfil.DATA_NASCIMENTO),
      emailInstitucional: texto(String(perfil.EMAIL_INSTITUCIONAL || '').toLowerCase(), 150),
      emailPessoal: texto(String(perfil.EMAIL_PESSOAL || '').toLowerCase(), 150),
      genero: texto(perfil.GENERO, 40),
      // ATIVO define o estado inicial de contas novas. Cadastros existentes nem
      // chegam a gravacao e, portanto, conservam seu status atual.
      status: temColunaAtivo
        ? (bandeira(linha.ATIVO) ? 'ativo' : 'inativo')
        : null,
      vinculos,
    })
  })

  return {
    totalLinhas: usuarios.registros.length,
    validos,
    rejeitados,
    semPerfil,
  }
}

const resumoDoRegistro = (registro) => ({
  linha: registro.linha,
  cpf: registro.cpf,
  name: registro.name,
  usuarioId: registro.usuarioId || '',
})

/** Consulta o banco e devolve a previa; nenhuma linha e gravada nesta etapa. */
async function validar({ arquivo }) {
  requireMysql()
  const leitura = lerRegistros(arquivo)
  const novos = []
  const problemas = [...leitura.rejeitados]

  for (let i = 0; i < leitura.validos.length; i += TAMANHO_DO_LOTE) {
    const lote = leitura.validos.slice(i, i + TAMANHO_DO_LOTE)
    const classificacao = await repo.classificarParaImportacao(lote)
    novos.push(...classificacao.novos)
    classificacao.existentes.forEach((registro) => problemas.push({
      tipo: 'duplicado',
      ...resumoDoRegistro(registro),
      motivo: 'CPF ja cadastrado no sistema',
    }))
    classificacao.conflitos.forEach((registro) => problemas.push({
      tipo: 'duplicado',
      ...resumoDoRegistro(registro),
      motivo: registro.motivo,
    }))
  }

  return {
    totalLinhas: leitura.totalLinhas,
    novos: novos.length,
    invalidos: problemas.filter((item) => item.tipo === 'invalido').length,
    duplicados: problemas.filter((item) => item.tipo === 'duplicado').length,
    semPerfil: novos.filter((registro) => registro.semPerfil).length,
    comMultiplosVinculos: novos.filter((registro) => registro.vinculos.length > 1).length,
    novosDados: novos.map(resumoDoRegistro),
    problemas,
  }
}

/**
 * Confirma a importacao inserindo apenas CPFs novos. Registros existentes sao
 * ignorados por completo, portanto suas inscricoes e seus dados permanecem.
 */
async function importar({ arquivo, actor, req }) {
  requireMysql()
  const leitura = lerRegistros(arquivo)

  let inseridos = 0
  let ignoradosExistentes = 0
  let conflitos = 0
  let semPerfil = 0
  let comMultiplosVinculos = 0

  if (leitura.validos.length > 0) {
    const conexao = await getPool().getConnection()
    try {
      await conexao.beginTransaction()
      for (let i = 0; i < leitura.validos.length; i += TAMANHO_DO_LOTE) {
        const lote = leitura.validos.slice(i, i + TAMANHO_DO_LOTE)
        const classificacao = await repo.classificarParaImportacao(lote, conexao, { bloquear: true })
        ignoradosExistentes += classificacao.existentes.length
        conflitos += classificacao.conflitos.length
        if (classificacao.novos.length === 0) continue
        semPerfil += classificacao.novos.filter((registro) => registro.semPerfil).length
        comMultiplosVinculos += classificacao.novos.filter((registro) => registro.vinculos.length > 1).length

        const resultado = await repo.inserirLoteImportacao(classificacao.novos, conexao)
        inseridos += resultado.inseridos
        conflitos += resultado.conflitos.length
        const gravados = classificacao.novos.filter((registro) => (
          !resultado.conflitos.some((conflito) => conflito.cpf === registro.cpf)
        ))
        await repo.substituirVinculos(gravados, conexao)
      }
      await conexao.commit()
    } catch (error) {
      await conexao.rollback()
      throw error
    } finally {
      conexao.release()
    }
  }

  const resumo = {
    totalLinhas: leitura.totalLinhas,
    inseridos,
    atualizados: 0,
    ignoradosExistentes,
    rejeitados: leitura.rejeitados.length + conflitos,
    semPerfil,
    comMultiplosVinculos,
  }

  await registrar({
    actorType: 'admin',
    actorId: actor?.id || null,
    actorLabel: actor?.name || null,
    action: ACOES.BASE_IMPORTADA,
    req,
    details: {
      totalLinhas: resumo.totalLinhas,
      inseridos,
      atualizados: 0,
      ignoradosExistentes,
      rejeitados: resumo.rejeitados,
      semPerfil: resumo.semPerfil,
    },
  })

  return resumo
}

module.exports = { importar, validar, ABA_USUARIOS, ABA_PERFIL }
