import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ProjectsPage } from '@/features/projects/ProjectsPage'
import { ComingSoon, ProjectLayout } from '@/features/project/ProjectLayout'
import { PeopleTab } from '@/features/project/PeopleTab'
import { BoardTab } from '@/features/board/BoardTab'
import { InboxTab } from '@/features/inbox/InboxTab'
import { DailyTab } from '@/features/daily/DailyTab'
import { ToastProvider } from '@/components/Toast'
import { EmptyState } from '@/components/ui'
import { queryClient } from '@/lib/api'
import { AppLayout } from './Layout'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/proyectos" replace />} />
              <Route path="/proyectos" element={<ProjectsPage />} />
              <Route path="/proyectos/:pid" element={<ProjectLayout />}>
                <Route path="tablero" element={<BoardTab />} />
                <Route path="por-revisar" element={<InboxTab />} />
                <Route path="daily" element={<DailyTab />} />
                <Route path="versiones" element={<ComingSoon title="Versiones" phase={6} />} />
                <Route path="miembros" element={<PeopleTab />} />
              </Route>
              <Route path="*" element={<EmptyState title="Página no encontrada" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
