import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CursistaProvider, useCursista } from './CursistaContext'
import LoginCursista from './pages/LoginCursista'
import DefinirSenha from './pages/DefinirSenha'
import CompletarCadastro from './pages/CompletarCadastro'
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
 * O acesso tem quatro estados, nesta ordem: sem sessao -> senha pendente ->
 * cadastro pendente -> liberado. Cada tela declara ate onde aceita ser aberta.
 * O backend impoe as mesmas regras (428) -- aqui e so navegacao, nunca
 * autorizacao.
 */
function ExigirCursista({ children, aceita = 'liberado' }) {
  const { cursista, carregando, senhaPendente, cadastroPendente } = useCursista()
  const location = useLocation()

  if (carregando) return <Carregando />

  if (!cursista && !senhaPendente) {
    return <Navigate to="/area-do-cursista/entrar" replace state={{ de: location.pathname }} />
  }

  if (senhaPendente && aceita !== 'senha') {
    return <Navigate to="/area-do-cursista/senha" replace />
  }

  if (cadastroPendente && aceita === 'liberado') {
    return <Navigate to="/area-do-cursista/cadastro" replace />
  }

  return children
}

function RedirecionarSeLogado({ children }) {
  const { cursista, carregando, senhaPendente, cadastroPendente } = useCursista()
  if (carregando) return <Carregando />
  if (senhaPendente) return <Navigate to="/area-do-cursista/senha" replace />
  if (cadastroPendente) return <Navigate to="/area-do-cursista/cadastro" replace />
  if (cursista) return <Navigate to="/area-do-cursista" replace />
  return children
}

export default function CursistaRoutes() {
  return (
    <CursistaProvider>
      <Routes>
        <Route path="entrar" element={<RedirecionarSeLogado><LoginCursista /></RedirecionarSeLogado>} />
        <Route path="senha" element={<ExigirCursista aceita="senha"><DefinirSenha /></ExigirCursista>} />
        <Route path="cadastro" element={<ExigirCursista aceita="cadastro"><CompletarCadastro /></ExigirCursista>} />
        <Route index element={<ExigirCursista><AreaCursista /></ExigirCursista>} />
        <Route path="*" element={<Navigate to="/area-do-cursista" replace />} />
      </Routes>
    </CursistaProvider>
  )
}
