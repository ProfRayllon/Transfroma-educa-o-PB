import { createContext, useContext, useState } from 'react'

const BrandingContext = createContext(null)

function loadStored(key) {
  try { return localStorage.getItem(key) || null } catch { return null }
}

export function BrandingProvider({ children }) {
  const [loginBg, setLoginBgState] = useState(() => loadStored('branding_loginBg'))
  const [logo, setLogoState] = useState(() => loadStored('branding_logo'))

  const setLoginBg = (url) => {
    setLoginBgState(url)
    try {
      if (url) localStorage.setItem('branding_loginBg', url)
      else localStorage.removeItem('branding_loginBg')
    } catch {}
  }

  const setLogo = (url) => {
    setLogoState(url)
    try {
      if (url) localStorage.setItem('branding_logo', url)
      else localStorage.removeItem('branding_logo')
    } catch {}
  }

  return (
    <BrandingContext.Provider value={{ loginBg, setLoginBg, logo, setLogo }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
