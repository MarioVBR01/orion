import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, UserCog } from 'lucide-react'
import { useMe } from '@/features/auth/AuthProvider'
import { Avatar, EmptyState, Modal, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { can, ROLE_LABEL } from '@/lib/permissions'
import { createAppUser, setUserActive, setUserRole } from '@/lib/users'
import { GLOBAL_ROLES, type AppUser, type GlobalRole } from '@/types'
import { useUsers } from './useUsers'

const LIMITED: GlobalRole[] = ['dev', 'qa', 'cliente', 'tester']

export function UsersPage() {
  const me = useMe()
  const toast = useToast()
  const { users } = useUsers()
  const [showNew, setShowNew] = useState(false)
  if (!can.manageUsers(me)) return <Navigate to="/proyectos" replace />

  const assignable = can.isAdmin(me) ? GLOBAL_ROLES : LIMITED
  const editable = (u: AppUser) => u.id !== me.id && (can.isAdmin(me) || LIMITED.includes(u.globalRole))

  async function run(p: Promise<unknown>, ok: string) {
    try {
      await p
      toast.success(ok)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Nuevo usuario</button>
      </div>

      {users === undefined ? (
        <Skeleton className="h-64" />
      ) : users.length === 0 ? (
        <EmptyState icon={<UserCog className="h-10 w-10" />} title="Sin usuarios" />
      ) : (
        <ul className="card divide-y divide-gray-100">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${u.active ? '' : 'opacity-60'}`}>
              <Avatar name={u.name} size="h-9 w-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.name} {!u.active && <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs">Desactivado</span>}</p>
                <p className="truncate text-sm text-gray-500">{u.email}</p>
              </div>
              {editable(u) ? (
                <>
                  <select
                    aria-label={`Rol global de ${u.name}`}
                    className="input w-auto"
                    value={u.globalRole}
                    onChange={(e) => run(setUserRole(u.id, e.target.value as GlobalRole), 'Rol actualizado.')}
                  >
                    {assignable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="btn-outline" onClick={() => run(setUserActive(u.id, !u.active), u.active ? 'Usuario desactivado.' : 'Usuario activado.')}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{ROLE_LABEL[u.globalRole]}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <NewUserModal open={showNew} onClose={() => setShowNew(false)} roles={assignable} />
    </div>
  )
}

export function NewUserModal({
  open,
  onClose,
  roles,
  fixedRole,
  extra,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  roles: GlobalRole[]
  fixedRole?: GlobalRole
  extra?: ReactNode
  onCreated?: (uid: string) => Promise<void>
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<GlobalRole>(fixedRole ?? 'dev')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const uid = await createAppUser({ name, email, password, globalRole: fixedRole ?? role })
      if (onCreated) await onCreated(uid)
      toast.success('Usuario creado. Compártele su correo y contraseña inicial.')
      setName('')
      setEmail('')
      setPassword('')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fixedRole === 'tester' ? 'Nuevo tester' : 'Nuevo usuario'}
      footer={
        <>
          <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" type="submit" form="new-user" disabled={busy}>{busy ? 'Creando…' : 'Crear'}</button>
        </>
      }
    >
      <form id="new-user" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="u-name">Nombre</label>
          <input id="u-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Correo</label>
          <input id="u-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="u-pass">Contraseña inicial</label>
          <input id="u-pass" type="text" minLength={6} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-gray-500">El usuario podrá cambiarla en "Cambiar contraseña".</p>
        </div>
        {!fixedRole && (
          <div>
            <label className="label" htmlFor="u-role">Rol global</label>
            <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as GlobalRole)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
        )}
        {extra}
      </form>
    </Modal>
  )
}
