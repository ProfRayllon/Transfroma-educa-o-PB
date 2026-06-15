import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import api, { getApiErrorMessage, USER_KEY } from '../lib/api'

const AvatarContext = createContext(null)

export function AvatarProvider({ children }) {
  const { user } = useAuth()
  const [photo, setPhotoState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPhotoState(user?.avatar || null)
    setError(null)
  }, [user?.id, user?.avatar])

  const setPhoto = async (url) => {
    if (!user?.id) return

    setSaving(true)
    setError(null)

    try {
      const { data } = await api.patch('/auth/me/avatar', { avatar: url || null })
      localStorage.setItem(USER_KEY, JSON.stringify(data))
      setPhotoState(data.avatar || null)
      localStorage.removeItem(`avatar_${user.id}`)
      window.dispatchEvent(new CustomEvent('transforma:user-updated', { detail: data }))
      return data.avatar || null
    } catch (err) {
      const message = getApiErrorMessage(err, 'Erro ao salvar foto.')
      setError(message)
      throw new Error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AvatarContext.Provider value={{ photo, setPhoto, saving, error }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() { return useContext(AvatarContext) }
