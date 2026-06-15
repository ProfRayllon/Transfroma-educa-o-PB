import { createContext, useContext, useState, useEffect } from 'react'
import { mockUsers } from '../data/mockData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('transforma_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('transforma_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const found = mockUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!found) throw new Error('E-mail ou senha incorretos.')

    const { password: _, ...safeUser } = found
    localStorage.setItem('transforma_user', JSON.stringify(safeUser))
    setUser(safeUser)
    return safeUser
  }

  const logout = () => {
    localStorage.removeItem('transforma_user')
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
    'view_relatorios',
  ],
  professor: [
    'view_producao', 'create_material', 'edit_own_material', 'view_review_status',
  ],
  tutor: [
    'view_pessoas', 'update_atividades', 'view_ocorrencias',
  ],
  tecnico: [
    'view_pessoas', 'view_frequencia', 'view_atividades', 'view_ocorrencias', 'update_atividades',
  ],
  gestao: [
    'view_pessoas', 'edit_frequencia', 'update_funcional', 'view_ocorrencias',
  ],
}
