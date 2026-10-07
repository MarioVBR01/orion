import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { SetupPage } from '@/features/auth/SetupPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { ComingSoon, ProjectLayout } from '@/features/project/ProjectLayout'
import { MembersTab } from '@/features/project/MembersTab'
import { UsersPage } from '@/features/users/UsersPage'
import { ToastProvider } from '@/components/Toast'
import { EmptyState } from '@/components/ui'
import { ProtectedLayout } from './Layout'

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route element={<ProtectedLayout />}>
              <Route index element={<Navigate to="/proyectos" replace />} />
              <Route path="/proyectos" element={<ProjectsPage />} />
              <Route path="/proyectos/:pid" element={<ProjectLayout />}>
                <Route path="brief" element={<ComingSoon title="Brief" phase={6} />} />
                <Route path="tablero" element={<ComingSoon title="Tablero" phase={2} />} />
                <Route path="por-revisar" element={<ComingSoon title="Por revisar" phase={3} />} />
                <Route path="rounds" element={<ComingSoon title="Rounds" phase={4} />} />
                <Route path="testing" element={<ComingSoon title="Testing" phase={6} />} />
                <Route path="versiones" element={<ComingSoon title="Versiones" phase={6} />} />
                <Route path="miembros" element={<MembersTab />} />
                <Route path="links" element={<ComingSoon title="Links" phase={6} />} />
              </Route>
              <Route path="/mensajes" element={<ComingSoon title="Mensajes" phase={6} />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/testers" element={<ComingSoon title="Testers" phase={6} />} />
              <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
              <Route path="*" element={<EmptyState title="Página no encontrada" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}
