import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { bootstrapAdmin } from '@/lib/users'
import { Logo, Spinner } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'

/** Alta del primer administrador. Solo funciona mientras no exista meta/bootstrap. */
export function SetupPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'open' | 'closed'>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'meta', 'bootstrap'))
      .then((s) => setState(s.exists() ? 'closed' : 'open'))
      .catch(() => setState('closed'))
  }, [])

  if (state === 'loading') return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (state === 'closed') return <Navigate to="/login" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      try {
        await bootstrapAdmin(cred.user.uid, name, email)
      } catch (err) {
        await deleteUser(cred.user)
        throw err
      }
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
        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <h1 className="text-lg font-semibold">Primer administrador</h1>
          <p className="text-sm text-gray-500">Esta pantalla solo está disponible una vez. Después, los usuarios los crea el administrador.</p>
          <div>
            <label className="label" htmlFor="name">Nombre</label>
            <input id="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">Correo</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" type="password" minLength={6} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creando…' : 'Crear administrador'}
          </button>
        </form>
      </div>
    </div>
  )
}
