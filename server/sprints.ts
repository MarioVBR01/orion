import type { CompleteSprintInput, Sprint, SprintInput, SprintStatus } from '../shared/types'
import { createCardsRepo } from './cards'
import { now, tx, type Db } from './db'
import { NotFoundError, RuleError } from './errors'

interface SprintRow {
  id: number
  project_id: number
  number: number
  name: string
  goal: string
  start_date: string | null
  end_date: string | null
  status: string
  completed_at: string | null
  created_at: string
}

const toSprint = (r: SprintRow): Sprint => ({
  id: r.id,
  projectId: r.project_id,
  number: r.number,
  name: r.name,
  goal: r.goal,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status as SprintStatus,
  completedAt: r.completed_at,
  createdAt: r.created_at,
})

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function checkDates(start: string | null | undefined, end: string | null | undefined) {
  if (start && !DATE_RE.test(start)) throw new RuleError('Fecha de inicio inválida.')
  if (end && !DATE_RE.test(end)) throw new RuleError('Fecha de fin inválida.')
  if (start && end && end < start) throw new RuleError('La fecha de fin no puede ser anterior a la de inicio.')
}

export function createSprintsRepo(db: Db) {
  const cards = createCardsRepo(db)

  function ensureProject(projectId: number) {
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw new NotFoundError(`Proyecto #${projectId} no existe`)
  }

  function row(projectId: number, id: number): SprintRow {
    const r = db.prepare('SELECT * FROM sprints WHERE project_id = ? AND id = ?').get(projectId, id) as SprintRow | undefined
    if (!r) throw new NotFoundError('Sprint no encontrado')
    return r
  }

  const repo = {
    /** Orden estilo Jira: completados (antiguos) arriba, luego activo, luego futuros por número. */
    list(projectId: number): Sprint[] {
      ensureProject(projectId)
      const rows = db.prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY number').all(projectId) as unknown as SprintRow[]
      return rows.map(toSprint)
    },

    get(projectId: number, id: number): Sprint {
      return toSprint(row(projectId, id))
    },

    active(projectId: number): Sprint | null {
      const r = db.prepare("SELECT * FROM sprints WHERE project_id = ? AND status = 'activo'").get(projectId) as SprintRow | undefined
      return r ? toSprint(r) : null
    },

    create(projectId: number, input: SprintInput): Sprint {
      ensureProject(projectId)
      checkDates(input.startDate, input.endDate)
      return tx(db, () => {
        const { n } = db.prepare('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM sprints WHERE project_id = ?').get(projectId) as { n: number }
        const { code } = db.prepare('SELECT code FROM projects WHERE id = ?').get(projectId) as { code: string }
        const res = db
          .prepare('INSERT INTO sprints (project_id, number, name, goal, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(projectId, n, input.name?.trim() || `${code} Sprint ${n}`, (input.goal ?? '').trim(), input.startDate || null, input.endDate || null, now())
        return repo.get(projectId, Number(res.lastInsertRowid))
      })
    },

    update(projectId: number, id: number, input: SprintInput): Sprint {
      const r = row(projectId, id)
      const start = input.startDate !== undefined ? input.startDate || null : r.start_date
      const end = input.endDate !== undefined ? input.endDate || null : r.end_date
      checkDates(start, end)
      if (r.status === 'activo' && (!start || !end)) throw new RuleError('Un sprint activo necesita fechas de inicio y fin.')
      db.prepare('UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ? WHERE id = ?').run(
        input.name !== undefined ? input.name.trim() || r.name : r.name,
        input.goal !== undefined ? input.goal.trim() : r.goal,
        start,
        end,
        id,
      )
      return repo.get(projectId, id)
    },

    start(projectId: number, id: number, input: SprintInput): Sprint {
      return tx(db, () => {
        const r = row(projectId, id)
        if (r.status !== 'futuro') throw new RuleError(r.status === 'activo' ? 'El sprint ya está activo.' : 'El sprint ya fue completado.')
        const other = repo.active(projectId)
        if (other) throw new RuleError(`Ya hay un sprint activo (${other.name}). Complétalo antes de iniciar otro.`)
        const start = input.startDate ?? r.start_date
        const end = input.endDate ?? r.end_date
        if (!start || !end) throw new RuleError('Indica las fechas de inicio y fin del sprint.')
        checkDates(start, end)
        db.prepare("UPDATE sprints SET status = 'activo', start_date = ?, end_date = ?, name = ?, goal = ? WHERE id = ?").run(
          start,
          end,
          input.name?.trim() || r.name,
          input.goal !== undefined ? input.goal.trim() : r.goal,
          id,
        )
        return repo.get(projectId, id)
      })
    },

    /** Completa el sprint; las tarjetas no terminadas van al Backlog o a otro sprint (no completado). */
    complete(projectId: number, id: number, input: CompleteSprintInput, actor: string): Sprint {
      return tx(db, () => {
        const r = row(projectId, id)
        if (r.status !== 'activo') throw new RuleError('Solo se puede completar el sprint activo.')
        const target = input.moveTo === 'backlog' ? null : input.moveTo
        if (target !== null) {
          if (target === id) throw new RuleError('Elige otro sprint para las tarjetas sin terminar.')
          const t = row(projectId, target)
          if (t.status === 'completado') throw new RuleError(`El sprint "${t.name}" ya está completado.`)
        }
        const open = db
          .prepare("SELECT number FROM cards WHERE project_id = ? AND sprint_id = ? AND archived = 0 AND column_id <> 'hecho'")
          .all(projectId, id) as Array<{ number: number }>
        if (open.length) cards.bulk(projectId, open.map((o) => o.number), { action: 'sprint', sprintId: target }, actor)
        db.prepare("UPDATE sprints SET status = 'completado', completed_at = ? WHERE id = ?").run(now(), id)
        return repo.get(projectId, id)
      })
    },

    /** Elimina el sprint; sus tarjetas vuelven al Backlog (sin sprint). */
    remove(projectId: number, id: number) {
      tx(db, () => {
        const r = row(projectId, id)
        if (r.status === 'completado') throw new RuleError('Un sprint completado se conserva como evidencia; no se puede eliminar.')
        db.prepare('UPDATE cards SET sprint_id = NULL WHERE project_id = ? AND sprint_id = ?').run(projectId, id)
        db.prepare('DELETE FROM sprints WHERE id = ?').run(id)
      })
    },
  }
  return repo
}
