import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Star } from 'lucide-react'
import { useMe } from '@/features/auth/AuthProvider'
import { toggleFavorite, updateProject, useMyRole, useProject } from '@/features/projects/api'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { can, effectiveRole, type EffectiveRole } from '@/lib/permissions'
import { ProjectContext } from './ProjectContext'

interface TabDef {
  path: string
  label: string
  visible: (r: EffectiveRole) => boolean
}

export const PROJECT_TABS: TabDef[] = [
  { path: 'brief', label: 'Brief', visible: can.viewBoard },
  { path: 'tablero', label: 'Tablero', visible: can.viewBoard },
  { path: 'por-revisar', label: 'Por revisar', visible: can.createObservations },
  { path: 'rounds', label: 'Rounds', visible: can.viewRounds },
  { path: 'testing', label: 'Testing', visible: can.runTests },
  { path: 'versiones', label: 'Versiones', visible: (r) => r !== null },
  { path: 'miembros', label: 'Miembros', visible: (r) => r !== null },
  { path: 'links', label: 'Links', visible: (r) => r !== null },
]

export function ProjectLayout() {
  const { pid } = useParams<{ pid: string }>()
  const me = useMe()
  const toast = useToast()
  const location = useLocation()
  const project = useProject(pid)
  const memberRole = useMyRole(pid, me.id)
  const [editing, setEditing] = useState(false)

  if (project === undefined || memberRole === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }
  if (project === null) {
    return <EmptyState title="Proyecto no encontrado" text="No existe o no tienes acceso." action={<Link className="btn-outline" to="/proyectos">Volver a proyectos</Link>} />
  }

  const role = effectiveRole(me, memberRole)
  const tabs = PROJECT_TABS.filter((t) => t.visible(role))
  const current = location.pathname.split('/')[3]
  if (!current || !tabs.some((t) => t.path === current)) {
    const first = tabs.find((t) => t.path === 'tablero') ?? tabs[0]
    if (first) return <Navigate to={`/proyectos/${project.id}/${first.path}`} replace />
  }
  const isFav = project.favoriteBy.includes(me.id)

  return (
    <ProjectContext.Provider value={{ project, me, role, memberRole }}>
      <Link to="/proyectos" className="inline-flex items-center gap-2 text-[15px] text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Atrás
      </Link>

      <div className="mt-5 flex items-center gap-3">
        <h1 className="truncate text-2xl font-bold">{project.name}</h1>
        <span className="text-sm text-gray-400">#{project.number}</span>
        <button
          aria-label={isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}
          aria-pressed={isFav}
          onClick={() => toggleFavorite(project.id, me.id, isFav).catch((e) => toast.error(errorMessage(e)))}
        >
          <Star className={`h-6 w-6 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-gray-300 hover:text-amber-300'}`} />
        </button>
        {can.manageProject(role) && (
          <button aria-label="Editar proyecto" className="text-gray-300 hover:text-gray-500" onClick={() => setEditing(true)}>
            <Pencil className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Secciones del proyecto">
        {tabs.map((t) => (
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
            await updateProject(project.id, v)
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
