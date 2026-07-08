import { createContext, useContext, useEffect, useState } from 'react'
import api, { getApiErrorMessage, TOKEN_KEY, UNAUTHORIZED_EVENT, USER_KEY } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const storedUser = localStorage.getItem(USER_KEY)
      const storedToken = localStorage.getItem(TOKEN_KEY)

      if (!storedUser || !storedToken) {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(TOKEN_KEY)
        if (active) setLoading(false)
        return
      }

      try {
        const parsedUser = JSON.parse(storedUser)
        if (active) setUser(parsedUser)

        const { data } = await api.get('/auth/me')
        localStorage.setItem(USER_KEY, JSON.stringify(data))

        if (active) setUser(data)
      } catch {
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(TOKEN_KEY)
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      setUser(null)
    }

    const handleUserUpdated = (event) => {
      if (!event.detail) return
      localStorage.setItem(USER_KEY, JSON.stringify(event.detail))
      setUser(event.detail)
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    window.addEventListener('transforma:user-updated', handleUserUpdated)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
      window.removeEventListener('transforma:user-updated', handleUserUpdated)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'E-mail ou senha incorretos.'))
    }
  }

  const logout = () => {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  const can = (action) => {
    if (!user) return false
    const perms = PERMISSIONS[user.role] || []
    return perms.includes('all') || perms.includes(action)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

const PERMISSIONS = {
  administrador: ['all'],
  supervisor: [
    'view_producao', 'edit_producao', 'approve_material',
    'view_pessoas', 'edit_frequencia', 'edit_ocorrencias',
    'view_relatorios', 'view_acessos',
  ],
  coordenador: [
    'view_producao', 'edit_producao', 'approve_material',
    'view_cursos', 'edit_cursos',
  ],
  professor: [
    'view_producao', 'create_material', 'edit_own_material', 'view_review_status',
  ],
  tutor: [
    'view_pessoas', 'update_atividades', 'view_ocorrencias',
  ],
  tecnico: [
    'view_pessoas', 'view_frequencia', 'view_atividades', 'view_ocorrencias', 'view_producao', 'view_cursos',
  ],
  gestao: [
    'view_pessoas', 'edit_frequencia', 'update_funcional', 'view_ocorrencias',
  ],
  revisor: [
    'view_producao', 'view_review_status',
  ],
}
