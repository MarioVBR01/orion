import { useState } from 'react'
import { CalendarRange, MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { EmptyState, Skeleton } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useSprintMutations, useSprints } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { daysBetween, formatRange, sprintDay, toIsoDate } from '@shared/sprintDates'
import { SPRINT_STATUS_LABEL, type Sprint, type SprintStatus } from '@shared/types'
import { CompleteSprintDialog, SprintFormDialog } from './SprintDialogs'

const STATUS_CLS: Record<SprintStatus, string> = {
  futuro: 'bg-gray-100 text-gray-700',
  activo: 'bg-blue-100 text-blue-700',
  completado: 'bg-green-100 text-green-700',
}

const duration = (s: Sprint) => (s.startDate && s.endDate ? daysBetween(s.startDate, s.endDate) + 1 : null)

/** Más recientes arriba; los que no tienen fechas, al final. */
const byDateDesc = (a: Sprint, b: Sprint) => {
  if (!a.startDate || !b.startDate) return a.startDate ? -1 : b.startDate ? 1 : b.number - a.number
  return a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.number - a.number
}

/**
 * Registro de sprints: nombre, fechas, objetivo y estado. Las tarjetas se gestionan en el tablero
 * Kanban; los sprints sirven para medir las fechas (y el Daily Scrum indica a qué sprint pertenece cada día).
 */
export function SprintsTab() {
  const project = useCurrentProject()
  const toast = useToast()
  const { data: sprints, isPending } = useSprints(project.id)
  const sm = useSprintMutations(project.id)
  const [dialog, setDialog] = useState<null | { kind: 'crear' } | { kind: 'editar' | 'iniciar' | 'completar'; sprint: Sprint }>(null)
  const [menu, setMenu] = useState<number | null>(null)

  const list = [...(sprints ?? [])].sort(byDateDesc)
  const active = list.find((s) => s.status === 'activo')
  const today = toIsoDate(new Date())
  const completed = list.filter((s) => s.status === 'completado')
  const totalDays = completed.reduce((acc, s) => acc + (duration(s) ?? 0), 0)

  const remove = (s: Sprint) => {
    if (!confirm(`¿Eliminar ${s.name} del registro?`)) return
    sm.remove.mutate(s.id, { onSuccess: () => toast.success('Sprint eliminado.'), onError: (e) => toast.error(errorMessage(e)) })
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-[15px] text-gray-500">
          Registro de los sprints del proyecto: nombre, fechas, objetivo y estado. Las tarjetas se trabajan en el tablero Kanban; cada Daily
          Scrum indica automáticamente a qué sprint pertenece su fecha. Puedes registrar sprints pasados y marcarlos como completados.
        </p>
        <button className="btn-primary px-5 py-3 text-[15px]" onClick={() => setDialog({ kind: 'crear' })}>
          <Plus className="h-4 w-4" /> Registrar sprint
        </button>
      </div>

      {isPending ? (
        <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
      ) : !list.length ? (
        <EmptyState
          icon={<CalendarRange className="h-10 w-10" />}
          title="Aún no hay sprints registrados"
          text="Registra el primero con sus fechas (por ejemplo, Sprint 0 del 14 al 28 de septiembre)."
          action={<button className="btn-primary" onClick={() => setDialog({ kind: 'crear' })}><Plus className="h-4 w-4" /> Registrar sprint</button>}
        />
      ) : (
        <div className="space-y-6">
          {active ? <ActiveSprint sprint={active} today={today} onEdit={() => setDialog({ kind: 'editar', sprint: active })} onComplete={() => setDialog({ kind: 'completar', sprint: active })} /> : (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
              No hay un sprint activo. Inicia uno desde la tabla.
            </p>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sprint</th>
                  <th className="px-4 py-3 font-semibold">Fechas</th>
                  <th className="px-4 py-3 font-semibold">Duración</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Objetivo</th>
                  <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => {
                  const d = duration(s)
                  return (
                    <tr key={s.id} className={s.status === 'activo' ? 'bg-blue-50/40' : ''}>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{s.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {s.startDate && s.endDate ? (
                          formatRange(s.startDate, s.endDate)
                        ) : (
                          <button className="text-brand hover:underline" onClick={() => setDialog({ kind: 'editar', sprint: s })}>Añadir fechas</button>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{d ? `${d} días` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_CLS[s.status]}`}>{SPRINT_STATUS_LABEL[s.status]}</span>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-gray-600" title={s.goal}>{s.goal || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === 'futuro' && (
                            <>
                              <button
                                className="btn-outline py-1 text-xs"
                                disabled={!!active}
                                title={active ? 'Ya hay un sprint activo' : undefined}
                                onClick={() => setDialog({ kind: 'iniciar', sprint: s })}
                              >
                                Iniciar
                              </button>
                              <button className="btn-outline py-1 text-xs" onClick={() => setDialog({ kind: 'completar', sprint: s })}>
                                Completar
                              </button>
                            </>
                          )}
                          {s.status === 'activo' && (
                            <button className="btn-outline py-1 text-xs" onClick={() => setDialog({ kind: 'completar', sprint: s })}>Completar</button>
                          )}
                          <span className="relative">
                            <button aria-label={`Opciones de ${s.name}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setMenu(menu === s.id ? null : s.id)}>
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                            {menu === s.id && (
                              <>
                                <span className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                                <span role="menu" className="absolute right-0 z-40 mt-1 block w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                                  <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50" onClick={() => { setMenu(null); setDialog({ kind: 'editar', sprint: s }) }}>
                                    <Pencil className="h-4 w-4" /> Editar
                                  </button>
                                  <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-gray-50" onClick={() => { setMenu(null); remove(s) }}>
                                    <Trash2 className="h-4 w-4" /> Eliminar
                                  </button>
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-right text-sm text-gray-500">
            {list.length} sprint(s) · {completed.length} completado(s){totalDays ? ` · ${totalDays} días de trabajo registrados` : ''}
          </p>
        </div>
      )}

      {dialog?.kind === 'crear' && <SprintFormDialog mode="crear" onClose={() => setDialog(null)} />}
      {(dialog?.kind === 'editar' || dialog?.kind === 'iniciar') && <SprintFormDialog mode={dialog.kind} sprint={dialog.sprint} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'completar' && <CompleteSprintDialog sprint={dialog.sprint} onClose={() => setDialog(null)} />}
    </div>
  )
}

function ActiveSprint({ sprint, today, onEdit, onComplete }: { sprint: Sprint; today: string; onEdit: () => void; onComplete: () => void }) {
  const day = sprintDay(sprint, today)
  const pct = day ? Math.min(100, Math.max(0, Math.round((day.day / day.total) * 100))) : 0
  const over = day ? day.day > day.total : false
  return (
    <section className="card border-blue-200 p-5" aria-label="Sprint activo">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">ACTIVO</span>
        <h3 className="text-lg font-bold">{sprint.name}</h3>
        {sprint.startDate && sprint.endDate && <span className="text-gray-500">{formatRange(sprint.startDate, sprint.endDate)}</span>}
        <span className="ml-auto flex gap-2">
          <button className="btn-outline py-1.5" onClick={onEdit}><Pencil className="h-4 w-4" /> Editar</button>
          <button className="btn-primary py-1.5" onClick={onComplete}>Completar sprint</button>
        </span>
      </div>
      {sprint.goal && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-700"><Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> {sprint.goal}</p>
      )}
      {day && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>{over ? `Terminó hace ${day.day - day.total} día(s): complétalo para cerrarlo` : day.day < 1 ? `Empieza en ${1 - day.day} día(s)` : `Día ${day.day} de ${day.total}`}</span>
            <span>{Math.max(0, day.total - Math.max(day.day, 0))} día(s) restantes</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}
