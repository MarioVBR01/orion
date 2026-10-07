import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Star } from 'lucide-react'
import { useObservationCounts, useProject, useUpdateProject } from '@/lib/api'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { ProjectContext } from './ProjectContext'

const TABS = [
  { path: 'tablero', label: 'Tablero' },
  { path: 'por-revisar', label: 'Por revisar' },
  { path: 'testing', label: 'Testing' },
  { path: 'versiones', label: 'Versiones' },
  { path: 'miembros', label: 'Miembros' },
]

export function ProjectLayout() {
  const pid = Number(useParams<{ pid: string }>().pid)
  const toast = useToast()
  const location = useLocation()
  const { data: project, isPending, isError } = useProject(pid)
  const update = useUpdateProject()
  const [editing, setEditing] = useState(false)
  const { data: obsCounts } = useObservationCounts(pid)
  const pending = (obsCounts?.clientes ?? 0) + (obsCounts?.testers ?? 0)

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (isError || !project) {
    return <EmptyState title="Proyecto no encontrado" action={<Link className="btn-outline" to="/proyectos">Volver a proyectos</Link>} />
  }

  const current = location.pathname.split('/')[3]
  if (!current || !TABS.some((t) => t.path === current)) {
    return <Navigate to={`/proyectos/${project.id}/tablero`} replace />
  }

  const toggleFav = () =>
    update.mutate({ id: project.id, favorite: !project.favorite }, { onError: (e) => toast.error(errorMessage(e)) })

  return (
    <ProjectContext.Provider value={project}>
      <Link to="/proyectos" className="inline-flex items-center gap-2 text-[15px] text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Atrás
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <h1 className="truncate text-2xl font-bold">{project.name}</h1>
        <span className="text-sm text-gray-400">#{project.id}</span>
        <button aria-label={project.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'} aria-pressed={project.favorite} onClick={toggleFav}>
          <Star className={`h-6 w-6 ${project.favorite ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-300'}`} />
        </button>
        <button aria-label="Editar proyecto" className="text-gray-300 hover:text-gray-500" onClick={() => setEditing(true)}>
          <Pencil className="h-5 w-5" />
        </button>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Secciones del proyecto">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            className={({ isActive }) =>
              `-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[15px] font-medium whitespace-nowrap sm:px-5 ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`
            }
          >
            {t.label}
            {t.path === 'por-revisar' && pending > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-brand">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="pt-6">
        <Outlet />
      </div>

      <ProjectFormModal
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar proyecto"
        submitLabel="Guardar"
        initial={{ name: project.name, code: project.code, description: project.description, color: project.color }}
        onSubmit={async (v) => {
          try {
            await update.mutateAsync({ id: project.id, ...v })
            toast.success('Proyecto actualizado.')
            setEditing(false)
          } catch (e) {
            toast.error(errorMessage(e))
          }
        }}
      />
    </ProjectContext.Provider>
  )
}

export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return <EmptyState title={title} text={`Esta sección se implementa en la fase ${phase}.`} />
}
