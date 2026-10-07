import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { Logo } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { firebaseUser } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'meta', 'bootstrap'))
      .then((s) => setNeedsSetup(!s.exists()))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (firebaseUser) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onReset() {
    if (!email.trim()) {
      toast.error('Escribe tu correo para enviarte el enlace.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      toast.success('Te enviamos un correo para restablecer la contraseña.')
    } catch (err) {
      toast.error(errorMessage(err))
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
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">Iniciar sesión</h1>
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button type="button" onClick={onReset} className="w-full text-center text-sm text-brand hover:underline">
            ¿Olvidaste tu contraseña?
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-gray-500">
          No hay registro público. Pide tu cuenta al administrador.
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
