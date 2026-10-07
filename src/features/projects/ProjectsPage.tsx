import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Star } from 'lucide-react'
import { useCreateProject, useProjects, useUpdateProject } from '@/lib/api'
import { Avatar, EmptyState, ProgressBar, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { percent } from '@/lib/format'
import { COLUMNS, type Project } from '@shared/types'
import { ProjectFormModal } from './ProjectFormModal'

export function ProjectsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: projects, isPending } = useProjects()
  const create = useCreateProject()
  const [showNew, setShowNew] = useState(false)

  const newButton = (
    <button className="btn-primary" onClick={() => setShowNew(true)}>
      <Plus className="h-4 w-4" /> Nuevo proyecto
    </button>
  )

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Proyectos</h1>
        {newButton}
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={<FolderKanban className="h-10 w-10" />}
          title="Aún no tienes proyectos"
          text="Crea el primero (por ejemplo LaGuardiaGO) para empezar a organizar el trabajo."
          action={newButton}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      <ProjectFormModal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Nuevo proyecto"
        submitLabel="Crear proyecto"
        onSubmit={async (v) => {
          try {
            const p = await create.mutateAsync(v)
            toast.success('Proyecto creado.')
            setShowNew(false)
            navigate(`/proyectos/${p.id}/tablero`)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const toast = useToast()
  const update = useUpdateProject()
  const total = Object.values(project.counts).reduce((a, b) => a + b, 0)
  const done = project.counts.hecho
  const pct = percent(done, total)

  return (
    <div className="card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-1.5" style={{ backgroundColor: project.color }} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-2">
          <Link to={`/proyectos/${project.id}/tablero`} className="min-w-0 flex-1 after:absolute after:inset-0">
            <h2 className="truncate text-lg font-bold">
              {project.name} <span className="text-sm font-normal text-gray-400">#{project.id}</span>
            </h2>
            <p className="text-xs font-medium text-gray-500">{project.code}</p>
          </Link>
          <button
            className="relative z-10 rounded p-1 hover:bg-gray-100"
            aria-label={project.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
            aria-pressed={project.favorite}
            onClick={() => update.mutate({ id: project.id, favorite: !project.favorite }, { onError: (e) => toast.error(errorMessage(e)) })}
          >
            <Star className={`h-5 w-5 ${project.favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        </div>
        {project.description && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{project.description}</p>}

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Progreso</span>
            <span>{done} de {total} · {pct}%</span>
          </div>
          <ProgressBar value={pct} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-gray-600 sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.id} className="flex items-center gap-1 truncate">
              <span className={`h-2 w-2 shrink-0 rounded-full ${c.bar}`} />
              <span className="truncate">{c.name}</span>
              <span className="ml-auto font-semibold">{project.counts[c.id]}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex -space-x-2 pt-4">
          {project.people.slice(0, 6).map((p) => <Avatar key={p.id} name={p.name} />)}
          {project.people.length > 6 && (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600 ring-2 ring-white">
              +{project.people.length - 6}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
