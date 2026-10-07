import { useState, type FormEvent } from 'react'
import { arrayRemove, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { db } from '@/lib/firebase'
import { useMembers } from '@/features/projects/api'
import { useUsers } from '@/features/users/useUsers'
import { Avatar, EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { can, ROLE_LABEL } from '@/lib/permissions'
import { PROJECT_ROLES, type ProjectRole } from '@/types'
import { useProjectCtx } from './ProjectContext'

export function MembersTab() {
  const { project, role, me } = useProjectCtx()
  const toast = useToast()
  const members = useMembers(project.id)
  const { users, byId } = useUsers()
  const manage = can.manageProject(role)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<ProjectRole>('dev')
  const [busy, setBusy] = useState(false)

  async function invite(e: FormEvent) {
    e.preventDefault()
    const user = users?.find((u) => u.email === email.trim().toLowerCase())
    if (!user) {
      toast.error('No existe un usuario con ese correo. Créalo primero en Usuarios o Testers.')
      return
    }
    if (members?.some((m) => m.id === user.id)) {
      toast.error('Ese usuario ya es miembro.')
      return
    }
    setBusy(true)
    try {
      const batch = writeBatch(db)
      batch.set(doc(db, 'projects', project.id, 'members', user.id), { role: newRole, addedAt: serverTimestamp() })
      batch.update(doc(db, 'projects', project.id), { memberIds: [...new Set([...project.memberIds, user.id])] })
      await batch.commit()
      toast.success(`${user.name} agregado al proyecto.`)
      setEmail('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(uid: string, r: ProjectRole) {
    try {
      await updateDoc(doc(db, 'projects', project.id, 'members', uid), { role: r })
      toast.success('Rol actualizado.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function remove(uid: string) {
    if (!confirm('¿Quitar a este miembro del proyecto?')) return
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'projects', project.id), { memberIds: arrayRemove(uid) })
      batch.delete(doc(db, 'projects', project.id, 'members', uid))
      await batch.commit()
      toast.success('Miembro quitado.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      {manage && (
        <form onSubmit={invite} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="inv-email">Invitar por correo</label>
            <input id="inv-email" type="email" required className="input" placeholder="persona@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} list="users-emails" />
            <datalist id="users-emails">
              {users?.filter((u) => u.active).map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="inv-role">Rol</label>
            <select id="inv-role" className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as ProjectRole)}>
              {PROJECT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <button className="btn-primary" disabled={busy}><UserPlus className="h-4 w-4" /> Agregar</button>
        </form>
      )}

      {members === undefined ? (
        <Skeleton className="h-40" />
      ) : members.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Sin miembros" />
      ) : (
        <ul className="card divide-y divide-gray-100">
          {members.map((m) => {
            const u = byId.get(m.id)
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={u?.name ?? '?'} size="h-9 w-9 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u?.name ?? m.id} {m.id === me.id && <span className="text-xs text-gray-400">(tú)</span>}</p>
                  <p className="truncate text-sm text-gray-500">{u?.email}</p>
                </div>
                {manage ? (
                  <select aria-label="Rol en el proyecto" className="input w-auto" value={m.role} onChange={(e) => changeRole(m.id, e.target.value as ProjectRole)}>
                    {PROJECT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                ) : (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{ROLE_LABEL[m.role]}</span>
                )}
                {manage && m.id !== me.id && (
                  <button aria-label="Quitar miembro" className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
