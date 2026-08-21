import axios from 'axios'

/**
 * Cliente HTTP da area do cursista.
 *
 * Separado do cliente da equipe (src/lib/api.js) de proposito: os dois tokens tem
 * audiencias diferentes e nao se substituem. Compartilhar a instancia faria uma
 * area mandar o token da outra e derrubar a sessao sem motivo aparente.
 */
export const CURSISTA_TOKEN_KEY = 'transforma_cursista_token'
export const CURSISTA_UNAUTHORIZED_EVENT = 'transforma:cursista-unauthorized'
export const CURSISTA_SENHA_PENDENTE_EVENT = 'transforma:cursista-senha-pendente'
export const CURSISTA_CADASTRO_PENDENTE_EVENT = 'transforma:cursista-cadastro-pendente'

const cursistaApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || '/api'}/cursistas`,
})

cursistaApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(CURSISTA_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

cursistaApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status

    if (status === 401) {
      localStorage.removeItem(CURSISTA_TOKEN_KEY)
      window.dispatchEvent(new Event(CURSISTA_UNAUTHORIZED_EVENT))
    }

    // 428: autenticado, mas falta concluir uma etapa obrigatoria. O backend
    // distingue qual delas; aqui so encaminhamos para a tela correspondente.
    if (status === 428) {
      const dados = error.response?.data || {}
      if (dados.precisaConfirmarCadastro) {
        window.dispatchEvent(new Event(CURSISTA_CADASTRO_PENDENTE_EVENT))
      } else {
        window.dispatchEvent(new Event(CURSISTA_SENHA_PENDENTE_EVENT))
      }
    }

    return Promise.reject(error)
  }
)

export function getCursistaErrorMessage(error, fallback = 'Não foi possível concluir a operação.') {
  return error.response?.data?.message || fallback
}

/** Formata CPF durante a digitacao: 123.456.789-01 */
export function formatarCpf(valor) {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 11)
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '')
}

export default cursistaApi
