import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Spinner } from '@/components/ui'
import { TopBar } from './TopBar'

export function ProtectedLayout() {
  const { firebaseUser, profile, logout } = useAuth()
  const location = useLocation()

  if (firebaseUser === undefined || (firebaseUser && profile === undefined)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!firebaseUser) return <Navigate to="/login" replace state={{ from: location }} />

  if (!profile || !profile.active) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
        <Lock className="h-10 w-10 text-gray-400" />
        <h1 className="text-xl font-semibold">Cuenta sin acceso</h1>
        <p className="max-w-sm text-sm text-gray-500">
          {profile ? 'Tu cuenta está desactivada.' : 'Tu cuenta no está registrada en ORION.'} Contacta al administrador.
        </p>
        <button className="btn-outline" onClick={logout}>Cerrar sesión</button>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <TopBar />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
