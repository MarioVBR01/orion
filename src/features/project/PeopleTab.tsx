import { useState, type FormEvent } from 'react'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { usePeople, usePeopleMutations } from '@/lib/api'
import { Avatar, EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { PERSON_ROLES, ROLE_LABEL, type PersonRole } from '@shared/types'
import { useCurrentProject } from './ProjectContext'

/**
 * Miembros del proyecto. Con un solo usuario local, son "personas" de referencia:
 * autores, asignados y remitentes de observaciones (clientes, testers…).
 */
export function PeopleTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: people, isPending } = usePeople(project.id)
  const m = usePeopleMutations(project.id)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PersonRole>('dev')

  async function add(e: FormEvent) {
    e.preventDefault()
    try {
      await m.add.mutateAsync({ name, email, role })
      toast.success(`${name} agregado.`)
      setName('')
      setEmail('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const run = (p: Promise<unknown>, ok: string) =>
    p.then(() => toast.success(ok)).catch((err: unknown) => toast.error(errorMessage(err)))

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="pp-name">Nombre</label>
          <input id="pp-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rodri BC" />
        </div>
        <div>
          <label className="label" htmlFor="pp-email">Correo (opcional)</label>
          <input id="pp-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pp-role">Rol</label>
          <select id="pp-role" className="input" value={role} onChange={(e) => setRole(e.target.value as PersonRole)}>
            {PERSON_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={m.add.isPending}><UserPlus className="h-4 w-4" /> Agregar</button>
      </form>

      {isPending ? (
        <Skeleton className="h-40" />
      ) : !people?.length ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Sin miembros" text="Agrega a las personas del proyecto para usarlas como autores, asignados o remitentes." />
      ) : (
        <ul className="card divide-y divide-gray-100">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={p.name} size="h-9 w-9 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                {p.email && <p className="truncate text-sm text-gray-500">{p.email}</p>}
              </div>
              <select
                aria-label={`Rol de ${p.name}`}
                className="input w-auto"
                value={p.role}
                onChange={(e) => run(m.update.mutateAsync({ id: p.id, role: e.target.value as PersonRole }), 'Rol actualizado.')}
              >
                {PERSON_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <button
                aria-label={`Quitar a ${p.name}`}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => confirm(`¿Quitar a ${p.name} del proyecto?`) && run(m.remove.mutateAsync(p.id), 'Miembro quitado.')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
