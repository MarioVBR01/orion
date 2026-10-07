import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { bootstrapAdmin, signInWithGoogle } from '@/lib/users'
import { Logo, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { GoogleButton } from './GoogleButton'

/** Alta del primer administrador. Solo funciona mientras no exista meta/bootstrap. */
export function SetupPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'open' | 'closed'>('loading')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'meta', 'bootstrap'))
      .then((s) => setState(s.exists() ? 'closed' : 'open'))
      .catch(() => setState('closed'))
  }, [])

  if (state === 'loading') return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (state === 'closed') return <Navigate to="/login" replace />

  async function setup() {
    setBusy(true)
    try {
      const cred = await signInWithGoogle()
      await bootstrapAdmin(cred.user)
      toast.success('Administrador creado.')
      navigate('/', { replace: true })
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
          <span className="text-2xl font-bold">ORION <span className="text-brand">Manager</span></span>
        </div>
        <div className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">Primer administrador</h1>
          <p className="text-sm text-gray-500">
            La cuenta de Google que uses aquí será el administrador. Esta pantalla solo está disponible una vez; después, el
            administrador invita a los demás por correo.
          </p>
          <GoogleButton onClick={setup} busy={busy} label="Ser administrador con Google" />
        </div>
      </div>
    </div>
  )
}
