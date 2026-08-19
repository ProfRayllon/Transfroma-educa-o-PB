import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CursistaProvider, useCursista } from './CursistaContext'
import LoginCursista from './pages/LoginCursista'
import DefinirSenha from './pages/DefinirSenha'
import AreaCursista from './pages/AreaCursista'

function Carregando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa]">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-700 border-t-transparent" />
    </div>
  )
}

/**
 * Protege a area do cursista.
 *
 * Tres estados: sem sessao (vai para o login), sessao com senha ainda nao trocada
 * (so a tela de senha) e sessao completa. O backend aplica as mesmas regras -- aqui
 * e so a navegacao, nunca a autorizacao.
 */
function ExigirCursista({ children, permitirSenhaPendente = false }) {
  const { cursista, carregando, senhaPendente } = useCursista()
  const location = useLocation()

  if (carregando) return <Carregando />

  if (!cursista && !senhaPendente) {
    return <Navigate to="/area-do-cursista/entrar" replace state={{ de: location.pathname }} />
  }

  if (senhaPendente && !permitirSenhaPendente) {
    return <Navigate to="/area-do-cursista/senha" replace />
  }

  return children
}

function RedirecionarSeLogado({ children }) {
  const { cursista, carregando, senhaPendente } = useCursista()
  if (carregando) return <Carregando />
  if (senhaPendente) return <Navigate to="/area-do-cursista/senha" replace />
  if (cursista) return <Navigate to="/area-do-cursista" replace />
  return children
}

export default function CursistaRoutes() {
  return (
    <CursistaProvider>
      <Routes>
        <Route
          path="entrar"
          element={<RedirecionarSeLogado><LoginCursista /></RedirecionarSeLogado>}
        />
        <Route
          path="senha"
          element={<ExigirCursista permitirSenhaPendente><DefinirSenha /></ExigirCursista>}
        />
        <Route
          index
          element={<ExigirCursista><AreaCursista /></ExigirCursista>}
        />
        <Route path="*" element={<Navigate to="/area-do-cursista" replace />} />
      </Routes>
    </CursistaProvider>
  )
}
