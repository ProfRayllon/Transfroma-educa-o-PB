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
import GestaoPessoas from './pages/GestaoPessoas'
import Acessos from './pages/Acessos'
import Notificacoes from './pages/Notificacoes'
import Perfil from './pages/Perfil'

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo-cursos" element={<PublicCourses />} />
          <Route path="/inscricoes" element={<Navigate to="/" replace />} />
          <Route path="/guia" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="painel" element={<Painel />} />
            <Route path="cursos" element={<Cursos />} />
            <Route path="cursos/:courseId/ementa" element={<Ementa />} />
            <Route path="producao" element={<Producao />} />
            <Route path="gestao-pessoas" element={<GestaoPessoas />} />
            <Route path="acessos" element={<Acessos />} />
            <Route path="notificacoes" element={<Notificacoes />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </DataProvider>
        </BrandingProvider>
        </AvatarProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
