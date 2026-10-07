import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { signInWithGoogle } from '@/lib/users'
import { Logo } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useAuth } from './AuthProvider'
import { GoogleButton } from './GoogleButton'

export function LoginPage() {
  const { firebaseUser } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'meta', 'bootstrap'))
      .then((s) => setNeedsSetup(!s.exists()))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (firebaseUser) return <Navigate to="/" replace />

  async function login() {
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-2xl font-bold">
            ORION <span className="text-brand">Manager</span>
          </span>
        </div>
        <div className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">Iniciar sesión</h1>
          <GoogleButton onClick={login} busy={busy} label="Continuar con Google" />
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">
          No hay registro público. Pide al administrador que invite tu correo de Google.
        </p>
        {needsSetup && (
          <p className="mt-2 text-center text-sm">
            <Link to="/setup" className="text-brand hover:underline">Configurar el primer administrador</Link>
          </p>
        )}
      </div>
    </div>
  )
}
