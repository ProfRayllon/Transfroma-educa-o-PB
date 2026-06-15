import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const AvatarContext = createContext(null)

export function AvatarProvider({ children }) {
  const { user } = useAuth()
  const [photo, setPhotoState] = useState(null)

  useEffect(() => {
    setPhotoState(user?.id ? localStorage.getItem(`avatar_${user.id}`) || null : null)
  }, [user?.id])

  const setPhoto = (url) => {
    setPhotoState(url)
    if (user?.id) {
      if (url) localStorage.setItem(`avatar_${user.id}`, url)
      else localStorage.removeItem(`avatar_${user.id}`)
    }
  }

  return (
    <AvatarContext.Provider value={{ photo, setPhoto }}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatar() { return useContext(AvatarContext) }
