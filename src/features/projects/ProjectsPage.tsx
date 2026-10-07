import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Star } from 'lucide-react'
import { useMe } from '@/features/auth/AuthProvider'
import { useUsers } from '@/features/users/useUsers'
import { Avatar, EmptyState, ProgressBar, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { can } from '@/lib/permissions'
import { percent } from '@/lib/format'
import { COLUMNS, type AppUser, type Project } from '@/types'
import { createProject, toggleFavorite, useColumnCounts, useProjects } from './api'
import { ProjectFormModal } from './ProjectFormModal'

export function ProjectsPage() {
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const { projects } = useProjects(me)
  const { byId } = useUsers()
  const [showNew, setShowNew] = useState(false)

  const sorted = useMemo(() => {
    const list = (projects ?? []).filter((p) => !p.archived)
    return list.sort((a, b) => {
      const fa = a.favoriteBy.includes(me.id) ? 0 : 1
      const fb = b.favoriteBy.includes(me.id) ? 0 : 1
      return fa - fb || a.number - b.number
    })
  }, [projects, me.id])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        {can.createProjects(me) && (
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nuevo proyecto
          </button>
        )}
      </div>

      {projects === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-10 w-10" />}
          title="Aún no tienes proyectos"
          text={can.createProjects(me) ? 'Crea el primero para empezar a organizar el trabajo.' : 'Pide a tu project manager que te agregue a un proyecto.'}
          action={can.createProjects(me) && <button className="btn-primary" onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Nuevo proyecto</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <ProjectCard key={p.id} project={p} me={me} usersById={byId} />
          ))}
        </div>
      )}

      <ProjectFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Nuevo proyecto"
        submitLabel="Crear proyecto"
        onSubmit={async (v) => {
          try {
            const id = await createProject(me, v)
            toast.success('Proyecto creado.')
            setShowNew(false)
            navigate(`/proyectos/${id}/tablero`)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </div>
  )
}

function ProjectCard({ project, me, usersById }: { project: Project; me: AppUser; usersById: Map<string, AppUser> }) {
  const toast = useToast()
  const counts = useColumnCounts(project.id, true)
  const isFav = project.favoriteBy.includes(me.id)
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const done = counts?.hecho ?? 0
  const pct = percent(done, total)

  return (
    <div className="card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5" style={{ backgroundColor: project.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-2">
          <Link to={`/proyectos/${project.id}/tablero`} className="min-w-0 flex-1 after:absolute after:inset-0">
            <h2 className="truncate text-lg font-bold">
              {project.name} <span className="text-sm font-normal text-gray-400">#{project.number}</span>
            </h2>
            <p className="text-xs font-medium text-gray-500">{project.code}</p>
          </Link>
          <button
            className="relative z-10 rounded p-1 hover:bg-gray-100"
            aria-label={isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}
            aria-pressed={isFav}
            onClick={() => toggleFavorite(project.id, me.id, isFav).catch((e) => toast.error(errorMessage(e)))}
          >
            <Star className={`h-5 w-5 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        </div>
        {project.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{project.description}</p>}

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Progreso</span>
            <span>{counts ? `${done} de ${total} · ${pct}%` : '—'}</span>
          </div>
          <ProgressBar value={pct} />
        </div>

        {counts && (
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] text-gray-600">
            {COLUMNS.map((c) => (
              <div key={c.id} className="flex items-center gap-1 truncate">
                <span className={`h-2 w-2 shrink-0 rounded-full ${c.bar}`} />
                <span className="truncate">{c.name}</span>
                <span className="ml-auto font-semibold">{counts[c.id]}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex -space-x-2 pt-4">
          {project.memberIds.slice(0, 6).map((uid) => (
            <Avatar key={uid} name={usersById.get(uid)?.name ?? '?'} />
          ))}
          {project.memberIds.length > 6 && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 ring-2 ring-white">
              +{project.memberIds.length - 6}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
