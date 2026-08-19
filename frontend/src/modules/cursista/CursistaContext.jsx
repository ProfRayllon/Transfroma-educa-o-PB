import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import cursistaApi, {
  CURSISTA_TOKEN_KEY,
  CURSISTA_UNAUTHORIZED_EVENT,
  CURSISTA_SENHA_PENDENTE_EVENT,
  getCursistaErrorMessage,
  somenteDigitos,
} from './api'

const CursistaContext = createContext(null)

export function CursistaProvider({ children }) {
  const [cursista, setCursista] = useState(null)
  const [carregando, setCarregando] = useState(true)
  // Enquanto verdadeiro, o cursista esta autenticado mas so pode trocar a senha.
  const [senhaPendente, setSenhaPendente] = useState(false)

  const encerrar = useCallback(() => {
    localStorage.removeItem(CURSISTA_TOKEN_KEY)
    setCursista(null)
    setSenhaPendente(false)
  }, [])

  useEffect(() => {
    let ativo = true

    async function restaurar() {
      if (!localStorage.getItem(CURSISTA_TOKEN_KEY)) {
        if (ativo) setCarregando(false)
        return
      }
      try {
        const { data } = await cursistaApi.get('/me')
        if (ativo) setCursista(data)
      } catch (error) {
        // 428 significa sessao valida com senha pendente -- nao e motivo para deslogar.
        if (ativo && error.response?.status === 428) setSenhaPendente(true)
        else if (ativo) encerrar()
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    restaurar()
    return () => { ativo = false }
  }, [encerrar])

  useEffect(() => {
    const aoPerderSessao = () => { setCursista(null); setSenhaPendente(false) }
    const aoExigirSenha = () => setSenhaPendente(true)

    window.addEventListener(CURSISTA_UNAUTHORIZED_EVENT, aoPerderSessao)
    window.addEventListener(CURSISTA_SENHA_PENDENTE_EVENT, aoExigirSenha)
    return () => {
      window.removeEventListener(CURSISTA_UNAUTHORIZED_EVENT, aoPerderSessao)
      window.removeEventListener(CURSISTA_SENHA_PENDENTE_EVENT, aoExigirSenha)
    }
  }, [])

  const entrar = async (cpf, senha) => {
    try {
      const { data } = await cursistaApi.post('/auth/login', {
        cpf: somenteDigitos(cpf),
        senha,
      })
      localStorage.setItem(CURSISTA_TOKEN_KEY, data.token)
      setSenhaPendente(Boolean(data.precisaDefinirSenha))
      setCursista(data.precisaDefinirSenha ? null : data.cursista)
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
      const { data: perfil } = await cursistaApi.get('/me')
      setCursista(perfil)
      return perfil
    } catch (error) {
      throw new Error(getCursistaErrorMessage(error, 'Não foi possível salvar a senha.'))
    }
  }

  const atualizarContato = async ({ email, phone }) => {
    try {
      const { data } = await cursistaApi.put('/me', { email, phone })
      setCursista(data)
      return data
    } catch (error) {
      throw new Error(getCursistaErrorMessage(error, 'Não foi possível salvar seus dados.'))
    }
  }

  return (
    <CursistaContext.Provider
      value={{ cursista, carregando, senhaPendente, entrar, definirSenha, atualizarContato, encerrar }}
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
