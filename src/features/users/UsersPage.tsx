import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { collection, onSnapshot } from 'firebase/firestore'
import { Mail, Plus, Trash2, UserCog } from 'lucide-react'
import { useMe } from '@/features/auth/AuthProvider'
import { Avatar, EmptyState, Modal, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { db } from '@/lib/firebase'
import { can, ROLE_LABEL } from '@/lib/permissions'
import { deleteInvite, setUserActive, setUserRole, upsertInvite, type Invite } from '@/lib/users'
import { GLOBAL_ROLES, type AppUser, type GlobalRole, type ProjectRole } from '@/types'
import { useUsers } from './useUsers'

export const LIMITED_ROLES: GlobalRole[] = ['dev', 'qa', 'cliente', 'tester']

export function useInvites() {
  const [invites, setInvites] = useState<Invite[] | undefined>(undefined)
  useEffect(
    () =>
      onSnapshot(
        collection(db, 'invites'),
        (s) => setInvites(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Invite)),
        () => setInvites([]),
      ),
    [],
  )
  return invites
}

export function UsersPage() {
  const me = useMe()
  const toast = useToast()
  const { users } = useUsers()
  const invites = useInvites()
  const [showNew, setShowNew] = useState(false)
  if (!can.manageUsers(me)) return <Navigate to="/proyectos" replace />

  const assignable = can.isAdmin(me) ? GLOBAL_ROLES : LIMITED_ROLES
  const editable = (u: AppUser) => u.id !== me.id && (can.isAdmin(me) || LIMITED_ROLES.includes(u.globalRole))

  async function run(p: Promise<unknown>, ok: string) {
    try {
      await p
      toast.success(ok)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Invitar usuario</button>
      </div>

      {!!invites?.length && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-500">Invitaciones pendientes</h2>
          <ul className="card divide-y divide-gray-100">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-brand"><Mail className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.name || i.email}</p>
                  <p className="truncate text-sm text-gray-500">{i.email} · {Object.keys(i.projects ?? {}).length} proyecto(s)</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{ROLE_LABEL[i.globalRole]}</span>
                <button aria-label="Cancelar invitación" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => run(deleteInvite(i.email), 'Invitación cancelada.')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
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
      </section>

      <InviteModal open={showNew} onClose={() => setShowNew(false)} roles={assignable} />
    </div>
  )
}

/** Invitar por correo de Google. Al entrar por primera vez, el invitado queda dado de alta. */
export function InviteModal({
  open,
  onClose,
  roles,
  fixedRole,
  extra,
  projects,
}: {
  open: boolean
  onClose: () => void
  roles: GlobalRole[]
  fixedRole?: GlobalRole
  extra?: ReactNode
  projects?: Record<string, ProjectRole>
}) {
  const me = useMe()
  const toast = useToast()
  const { users } = useUsers()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<GlobalRole>(fixedRole ?? 'dev')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (users?.some((u) => u.email === email.trim().toLowerCase())) {
      toast.error('Ese correo ya tiene cuenta. Agrégalo desde Miembros del proyecto.')
      return
    }
    setBusy(true)
    try {
      await upsertInvite({ email, name, globalRole: fixedRole ?? role, projects, createdBy: me.id })
      toast.success('Invitación creada. Dile que entre con Google usando ese correo.')
      setName('')
      setEmail('')
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
      title={fixedRole === 'tester' ? 'Invitar tester' : 'Invitar usuario'}
      footer={
        <>
          <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" type="submit" form="invite-form" disabled={busy}>{busy ? 'Guardando…' : 'Invitar'}</button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="u-name">Nombre</label>
          <input id="u-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Opcional: si no, se usa el de Google" />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Correo de Google</label>
          <input id="u-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
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
