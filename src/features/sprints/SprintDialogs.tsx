import { useState, type FormEvent } from 'react'
import { Modal } from '@/components/ui'
import { errorMessage, useToast } from '@/components/Toast'
import { useSprintMutations } from '@/lib/api'
import { useCurrentProject } from '@/features/project/ProjectContext'
import { addDays, daysBetween, toIsoDate } from '@shared/sprintDates'
import type { Card, Sprint } from '@shared/types'

/** Crear, editar o iniciar un sprint (nombre, fechas y objetivo). */
export function SprintFormDialog({ mode, sprint, onClose }: { mode: 'crear' | 'editar' | 'iniciar'; sprint?: Sprint; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const m = useSprintMutations(project.id)
  const today = toIsoDate(new Date())
  const defaultStart = sprint?.startDate ?? (mode === 'iniciar' ? today : '')
  const [name, setName] = useState(sprint?.name ?? '')
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [startDate, setStart] = useState(defaultStart)
  const [endDate, setEnd] = useState(sprint?.endDate ?? (defaultStart ? addDays(defaultStart, 13) : ''))
  const days = startDate && endDate && endDate >= startDate ? daysBetween(startDate, endDate) + 1 : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input = { name, goal, startDate: startDate || null, endDate: endDate || null }
    try {
      if (mode === 'crear') await m.create.mutateAsync(input)
      else if (mode === 'editar') await m.update.mutateAsync({ id: sprint!.id, ...input })
      else await m.start.mutateAsync({ id: sprint!.id, ...input })
      toast.success(mode === 'crear' ? 'Sprint creado.' : mode === 'editar' ? 'Sprint actualizado.' : 'Sprint iniciado.')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const title = mode === 'crear' ? 'Crear sprint' : mode === 'editar' ? `Editar ${sprint?.name}` : `Iniciar ${sprint?.name}`
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-outline" type="button" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" type="submit" form="sprint-form">
            {mode === 'iniciar' ? 'Iniciar sprint' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="sprint-form" onSubmit={submit} className="space-y-4">
        {mode === 'iniciar' && (
          <p className="text-sm text-gray-600">Las tarjetas de este sprint pasan a ser el trabajo comprometido; Claude las tomará primero.</p>
        )}
        <div>
          <label className="label" htmlFor="sp-name">Nombre del sprint</label>
          <input id="sp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${project.code} Sprint N`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-start">Fecha de inicio</label>
            <input
              id="sp-start"
              type="date"
              required={mode === 'iniciar'}
              className="input"
              value={startDate}
              onChange={(e) => {
                setStart(e.target.value)
                if (e.target.value && (!endDate || endDate < e.target.value)) setEnd(addDays(e.target.value, 13))
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="sp-end">Fecha de fin</label>
            <input id="sp-end" type="date" required={mode === 'iniciar'} min={startDate || undefined} className="input" value={endDate} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-gray-500">Duración:</span>
          {[1, 2, 3, 4].map((w) => (
            <button
              key={w}
              type="button"
              className="rounded-full border border-gray-200 px-2 py-0.5 hover:border-brand hover:text-brand"
              onClick={() => setEnd(addDays(startDate || today, w * 7 - 1))}
            >
              {w} {w === 1 ? 'semana' : 'semanas'}
            </button>
          ))}
          {days && <span className="ml-auto text-gray-500">{days} días</span>}
        </div>
        <div>
          <label className="label" htmlFor="sp-goal">Objetivo del sprint <span className="font-normal text-gray-400">(opcional)</span></label>
          <textarea id="sp-goal" rows={3} className="input" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}

/** Completar el sprint activo: elegir a dónde van las tarjetas sin terminar. */
export function CompleteSprintDialog({ sprint, cards, sprints, onClose }: { sprint: Sprint; cards: Card[]; sprints: Sprint[]; onClose: () => void }) {
  const project = useCurrentProject()
  const toast = useToast()
  const m = useSprintMutations(project.id)
  const done = cards.filter((c) => c.column === 'hecho').length
  const open = cards.length - done
  const targets = sprints.filter((s) => s.status === 'futuro')
  const [moveTo, setMoveTo] = useState<string>('backlog')

  async function submit() {
    try {
      await m.complete.mutateAsync({ id: sprint.id, moveTo: moveTo === 'backlog' ? 'backlog' : Number(moveTo) })
      toast.success(`${sprint.name} completado.`)
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Completar ${sprint.name}`}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={() => void submit()}>Completar sprint</button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          Este sprint contiene <strong>{done}</strong> actividad(es) terminada(s) y <strong>{open}</strong> sin terminar.
        </p>
        {open > 0 ? (
          <div>
            <label className="label" htmlFor="sp-move">Mover las actividades sin terminar a</label>
            <select id="sp-move" className="input" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="backlog">Backlog</option>
              {targets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : (
          <p className="text-green-700">¡Todas las actividades están terminadas!</p>
        )}
        <p className="text-xs text-gray-500">El sprint completado se conserva como evidencia con sus tarjetas terminadas.</p>
      </div>
    </Modal>
  )
}
