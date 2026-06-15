import axios from 'axios'

const USER_KEY = 'transforma_user'
const TOKEN_KEY = 'transforma_token'
const UNAUTHORIZED_EVENT = 'transforma:unauthorized'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }

    return Promise.reject(error)
  }
)

export function getApiErrorMessage(error, fallback = 'Erro ao processar a requisição.') {
  return error.response?.data?.message || fallback
}

export { USER_KEY, TOKEN_KEY, UNAUTHORIZED_EVENT }
export default api
