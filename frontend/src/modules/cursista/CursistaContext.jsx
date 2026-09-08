import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import cursistaApi, {
  CURSISTA_TOKEN_KEY,
  CURSISTA_UNAUTHORIZED_EVENT,
  CURSISTA_SENHA_PENDENTE_EVENT,
  CURSISTA_CADASTRO_PENDENTE_EVENT,
  getCursistaErrorMessage,
  somenteDigitos,
} from './api'

const CursistaContext = createContext(null)

/**
 * Sessao do cursista.
 *
 * O acesso passa por duas etapas obrigatorias, nesta ordem: definir a senha
 * (a inicial e o CPF) e completar o cadastro. O backend e quem impoe as duas --
 * aqui so guardamos em que ponto a pessoa esta, para levar a tela certa.
 */
export function CursistaProvider({ children }) {
  const [cursista, setCursista] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [senhaPendente, setSenhaPendente] = useState(false)
  const [cadastroPendente, setCadastroPendente] = useState(false)

  const encerrar = useCallback(() => {
    localStorage.removeItem(CURSISTA_TOKEN_KEY)
    setCursista(null)
    setSenhaPendente(false)
    setCadastroPendente(false)
  }, [])

  const carregarPerfil = useCallback(async () => {
    const { data } = await cursistaApi.get('/me')
    setCursista(data)
    setCadastroPendente(!data.cadastroConfirmado)
    return data
  }, [])

  useEffect(() => {
    let ativo = true

    async function restaurar() {
      if (!localStorage.getItem(CURSISTA_TOKEN_KEY)) {
        if (ativo) setCarregando(false)
        return
      }
      try {
        await carregarPerfil()
      } catch (error) {
        // 428 com senha pendente e sessao valida, nao motivo para deslogar.
        if (ativo && error.response?.status === 428) setSenhaPendente(true)
        else if (ativo) encerrar()
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    restaurar()
    return () => { ativo = false }
  }, [encerrar, carregarPerfil])

  useEffect(() => {
    const aoPerderSessao = () => { setCursista(null); setSenhaPendente(false); setCadastroPendente(false) }
    const aoExigirSenha = () => setSenhaPendente(true)
    const aoExigirCadastro = () => setCadastroPendente(true)

    window.addEventListener(CURSISTA_UNAUTHORIZED_EVENT, aoPerderSessao)
    window.addEventListener(CURSISTA_SENHA_PENDENTE_EVENT, aoExigirSenha)
    window.addEventListener(CURSISTA_CADASTRO_PENDENTE_EVENT, aoExigirCadastro)
    return () => {
      window.removeEventListener(CURSISTA_UNAUTHORIZED_EVENT, aoPerderSessao)
      window.removeEventListener(CURSISTA_SENHA_PENDENTE_EVENT, aoExigirSenha)
      window.removeEventListener(CURSISTA_CADASTRO_PENDENTE_EVENT, aoExigirCadastro)
    }
  }, [])

  const entrar = async (cpf, senha) => {
    try {
      const { data } = await cursistaApi.post('/auth/login', {
        cpf: somenteDigitos(cpf),
        senha,
      })
      localStorage.setItem(CURSISTA_TOKEN_KEY, data.token)

      if (data.precisaDefinirSenha) {
        // No primeiro acesso o backend nao devolve o cadastro -- ele so vem
        // depois que a senha deixa de ser o CPF.
        setSenhaPendente(true)
        setCursista(null)
        return data
      }

      setSenhaPendente(false)
      setCursista(data.cursista)
      setCadastroPendente(!data.cursista?.cadastroConfirmado)
      return data
    } catch (error) {
      throw new Error(getCursistaErrorMessage(error, 'CPF ou senha incorretos.'))
    }
  }

  const definirSenha = async ({ senhaAtual, novaSenha }) => {
    try {
      const { data } = await cursistaApi.post('/auth/senha', { senhaAtual, novaSenha })
      localStorage.setItem(CURSISTA_TOKEN_KEY, data.token)
      setSenhaPendente(false)
      return carregarPerfil()
    } catch (error) {
      throw new Error(getCursistaErrorMessage(error, 'Não foi possível salvar a senha.'))
    }
  }

  const salvarCadastro = async (dados) => {
    try {
      const { data } = await cursistaApi.put('/me', dados)
      setCursista(data)
      setCadastroPendente(!data.cadastroConfirmado)
      return data
    } catch (error) {
      throw new Error(getCursistaErrorMessage(error, 'Não foi possível salvar seus dados.'))
    }
  }

  return (
    <CursistaContext.Provider
      value={{
        cursista,
        carregando,
        senhaPendente,
        cadastroPendente,
        entrar,
        definirSenha,
        salvarCadastro,
        recarregarPerfil: carregarPerfil,
        encerrar,
      }}
    >
      {children}
    </CursistaContext.Provider>
  )
}

export function useCursista() {
  const contexto = useContext(CursistaContext)
  if (!contexto) throw new Error('useCursista precisa estar dentro de CursistaProvider')
  return contexto
}
