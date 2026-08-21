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

/**
 * Importa a base oficial de docentes (.xlsx com as abas USUARIOS e
 * PERFIL_DOCENTE), unindo as duas por USUARIO_ID.
 *
 * A planilha nao e a fonte da senha nem do estado de acesso: PRIMEIRO_ACESSO e
 * CADASTRO_CONFIRMADO da origem sao ignorados de proposito, porque quem manda
 * neles e o que o cursista ja fez NESTE sistema. Reimportar a base atualiza
 * cadastro, nunca derruba acesso.
 */
async function importar({ arquivo, actor, req }) {
  requireMysql()

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

  const validos = []
  const rejeitados = []
  const cpfsVistos = new Map()
  let semPerfil = 0

  usuarios.registros.forEach((linha, posicao) => {
    const numeroDaLinha = posicao + 2 // +1 do cabecalho, +1 porque planilha comeca em 1
    const cpf = normalizeCpf(linha.CPF)
    const nome = texto(linha.NOME_COMPLETO, 150)

    if (!cpf || !isValidCpf(cpf)) {
      rejeitados.push({ linha: numeroDaLinha, motivo: 'CPF invalido' })
      return
    }
    if (!nome) {
      rejeitados.push({ linha: numeroDaLinha, motivo: 'NOME_COMPLETO vazio' })
      return
    }
    if (cpfsVistos.has(cpf)) {
      rejeitados.push({ linha: numeroDaLinha, motivo: `CPF repetido (ja aparece na linha ${cpfsVistos.get(cpf)})` })
      return
    }
    cpfsVistos.set(cpf, numeroDaLinha)

    const usuarioId = texto(linha.USUARIO_ID, 20)
    const perfil = (usuarioId && perfilPorUsuario.get(usuarioId)) || perfilPorCpf.get(cpf) || {}
    if (!Object.keys(perfil).length) semPerfil += 1

    const vinculos = []
    for (let ordem = 1; ordem <= MAX_VINCULOS; ordem += 1) {
      const inep = texto(perfil[`INEP_${ordem}`], 12)
      const gre = texto(perfil[`GRE_${ordem}`], 60)
      const escola = texto(perfil[`ESCOLA_${ordem}`], 200)
      if (inep || gre || escola) vinculos.push({ ordem, inep, gre, escola })
    }

    validos.push({
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
      // ATIVO da base controla se a conta pode entrar; os demais estados de
      // acesso sao deste sistema, nao da planilha.
      status: Object.prototype.hasOwnProperty.call(linha, 'ATIVO') && !bandeira(linha.ATIVO) ? 'inativo' : 'ativo',
      vinculos,
    })
  })

  let inseridos = 0
  let atualizados = 0

  if (validos.length > 0) {
    const conexao = await getPool().getConnection()
    try {
      await conexao.beginTransaction()
      for (let i = 0; i < validos.length; i += TAMANHO_DO_LOTE) {
        const lote = validos.slice(i, i + TAMANHO_DO_LOTE)
        const resultado = await repo.upsertLoteFromImport(lote, conexao)
        inseridos += resultado.inseridos
        atualizados += resultado.atualizados
        await repo.substituirVinculos(lote, conexao)
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
    totalLinhas: usuarios.registros.length,
    inseridos,
    atualizados,
    rejeitados: rejeitados.length,
    semPerfil,
    comMultiplosVinculos: validos.filter((v) => v.vinculos.length > 1).length,
    // Amostra para o admin corrigir a origem sem despejar o arquivo inteiro na tela.
    exemplosRejeitados: rejeitados.slice(0, 50),
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
      atualizados,
      rejeitados: rejeitados.length,
      semPerfil,
    },
  })

  return resumo
}

module.exports = { importar, ABA_USUARIOS, ABA_PERFIL }
