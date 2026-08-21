import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { BrandingProvider } from './context/BrandingContext'
import { ThemeProvider } from './context/ThemeContext'
import { AvatarProvider } from './context/AvatarContext'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import PublicCourses from './pages/PublicCourses'
import Login from './pages/Login'
import Painel from './pages/Painel'
import Cursos from './pages/Cursos'
import Producao from './pages/Producao'
import Ementa from './pages/Ementa'
import Frequencia from './pages/Frequencia'
import Acessos from './pages/Acessos'
import CursistasAdmin from './pages/Cursistas'
import Notificacoes from './pages/Notificacoes'
import Perfil from './pages/Perfil'
import CursistaRoutes from './modules/cursista/CursistaRoutes'
import { CursistaProvider } from './modules/cursista/CursistaContext'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-700 border-t-transparent" /></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/painel" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <AvatarProvider>
        <BrandingProvider>
        <DataProvider>
        {/* Sessao do cursista no nivel do app, e nao so dentro de
            /area-do-cursista: o topo e a home precisam saber quem entrou para
            trocar o botao de login pelo nome da pessoa. Continua separada da
            sessao da equipe -- outro token, outra audiencia. */}
        <CursistaProvider>
        <Routes>
          {/* Site publico: qualquer visitante ve. O que exige sessao e a inscricao,
              nao a leitura -- por isso a home e o catalogo ficam fora dos guards. */}
          <Route path="/" element={<Home />} />
          <Route path="/catalogo-cursos" element={<PublicCourses />} />
          <Route path="/inscricoes" element={<Navigate to="/" replace />} />
          <Route path="/guia" element={<Navigate to="/" replace />} />
          {/* Login da equipe interna. Alcancado pelo rodape do site, nao pelo menu:
              o publico do portal e o cursista, nao quem administra o programa. */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          {/* Area do cursista: publica e com sessao propria, fora dos guards da
              equipe interna -- cursista nao e usuario do sistema administrativo. */}
          <Route path="/area-do-cursista/*" element={<CursistaRoutes />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="painel" element={<Painel />} />
            <Route path="cursos" element={<Cursos />} />
            <Route path="cursos/:courseId/ementa" element={<Ementa />} />
            <Route path="producao" element={<Producao />} />
            <Route path="frequencia" element={<Frequencia />} />
            <Route path="acessos" element={<Acessos />} />
            <Route path="cursistas" element={<CursistasAdmin />} />
            <Route path="notificacoes" element={<Notificacoes />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
          {/* Rota desconhecida cai no site publico, nao no login: quem digita
              errado uma URL do portal e visitante, nao alguem da equipe. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </CursistaProvider>
        </DataProvider>
        </BrandingProvider>
        </AvatarProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
