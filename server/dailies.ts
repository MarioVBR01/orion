import { COLUMN_IDS, type ColumnCounts, type DailyActivity, type DailyInput, type DailyScrum, type HistoryEntry } from '../shared/types'
import { now, type Db } from './db'
import { NotFoundError, RuleError } from './errors'

interface DailyRow {
  id: number
  project_id: number
  date: string
  notes: string
  entries: string
  board_snapshot: string
  created_at: string
  updated_at: string
}

const toDaily = (r: DailyRow): DailyScrum => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  notes: r.notes,
  entries: JSON.parse(r.entries) as DailyScrum['entries'],
  boardSnapshot: JSON.parse(r.board_snapshot) as ColumnCounts,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

/** Medianoche local del día AAAA-MM-DD. */
function localMidnight(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function createDailiesRepo(db: Db) {
  function ensureProject(projectId: number) {
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw new NotFoundError(`Proyecto #${projectId} no existe`)
  }

  function row(projectId: number, id: number): DailyRow {
    const r = db.prepare('SELECT * FROM daily_scrums WHERE project_id = ? AND id = ?').get(projectId, id) as DailyRow | undefined
    if (!r) throw new NotFoundError('Daily no encontrado')
    return r
  }

  /**
   * Tarjetas por columna al final del día del daily (o ahora, si el día no terminó),
   * reconstruido con el historial: así un daily con fecha pasada muestra el tablero de esa fecha.
   */
  function snapshot(projectId: number, date: string): ColumnCounts {
    const counts = Object.fromEntries(COLUMN_IDS.map((c) => [c, 0])) as ColumnCounts
    const endOfDay = localMidnight(date)
    endOfDay.setDate(endOfDay.getDate() + 1)
    const end = (endOfDay.getTime() > Date.now() ? new Date() : endOfDay).toISOString()
    const rows = db
      .prepare(
        `SELECT c.column_id AS current,
           (SELECT h.to_value FROM history h
             WHERE h.card_id = c.id AND h.action IN ('creada', 'movida') AND h.at < ?
             ORDER BY h.id DESC LIMIT 1) AS at_date
         FROM cards c WHERE c.project_id = ? AND c.archived = 0 AND c.created_at < ?`,
      )
      .all(end, projectId, end) as Array<{ current: string; at_date: string | null }>
    for (const r of rows) {
      const col = (r.at_date ?? r.current) as keyof ColumnCounts
      if (col in counts) counts[col]++
    }
    return counts
  }

  function clean(input: DailyInput) {
    if (!DATE_RE.test(input.date)) throw new RuleError('Fecha inválida (usa AAAA-MM-DD).')
    const entries = input.entries
      .map((e) => ({ person: e.person.trim(), yesterday: e.yesterday.trim(), today: e.today.trim(), blockers: e.blockers.trim() }))
      .filter((e) => e.person)
    const names = entries.map((e) => e.person.toLowerCase())
    if (new Set(names).size !== names.length) throw new RuleError('Hay participantes repetidos.')
    return { date: input.date, notes: (input.notes ?? '').trim(), entries }
  }

  const repo = {
    list(projectId: number): DailyScrum[] {
      ensureProject(projectId)
      const rows = db.prepare('SELECT * FROM daily_scrums WHERE project_id = ? ORDER BY date DESC').all(projectId) as unknown as DailyRow[]
      return rows.map(toDaily)
    },

    get(projectId: number, id: number): DailyScrum {
      return toDaily(row(projectId, id))
    },

    create(projectId: number, input: DailyInput): DailyScrum {
      ensureProject(projectId)
      const c = clean(input)
      if (db.prepare('SELECT 1 FROM daily_scrums WHERE project_id = ? AND date = ?').get(projectId, c.date)) {
        throw new RuleError(`Ya existe un Daily Scrum para el ${c.date.split('-').reverse().join('/')}.`)
      }
      const at = now()
      const res = db
        .prepare('INSERT INTO daily_scrums (project_id, date, notes, entries, board_snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(projectId, c.date, c.notes, JSON.stringify(c.entries), JSON.stringify(snapshot(projectId, c.date)), at, at)
      return repo.get(projectId, Number(res.lastInsertRowid))
    },

    update(projectId: number, id: number, input: DailyInput): DailyScrum {
      const current = row(projectId, id)
      const c = clean(input)
      if (c.date !== current.date && db.prepare('SELECT 1 FROM daily_scrums WHERE project_id = ? AND date = ?').get(projectId, c.date)) {
        throw new RuleError(`Ya existe un Daily Scrum para el ${c.date.split('-').reverse().join('/')}.`)
      }
      db.prepare('UPDATE daily_scrums SET date = ?, notes = ?, entries = ?, board_snapshot = ?, updated_at = ? WHERE id = ?').run(
        c.date,
        c.notes,
        JSON.stringify(c.entries),
        JSON.stringify(snapshot(projectId, c.date)),
        now(),
        id,
      )
      return repo.get(projectId, id)
    },

    remove(projectId: number, id: number) {
      row(projectId, id)
      db.prepare('DELETE FROM daily_scrums WHERE id = ?').run(id)
    },

    /**
     * Actividad del tablero para un daily: desde el día siguiente al daily anterior
     * (o desde el día previo si es el primero) hasta el final del día del daily.
     */
    activity(projectId: number, date: string): DailyActivity {
      ensureProject(projectId)
      if (!DATE_RE.test(date)) throw new RuleError('Fecha inválida (usa AAAA-MM-DD).')
      const prev = db
        .prepare('SELECT date FROM daily_scrums WHERE project_id = ? AND date < ? ORDER BY date DESC LIMIT 1')
        .get(projectId, date) as { date: string } | undefined
      const end = localMidnight(date)
      end.setDate(end.getDate() + 1)
      const start = prev ? localMidnight(prev.date) : localMidnight(date)
      start.setDate(start.getDate() + (prev ? 1 : -1))
      const rows = db
        .prepare(
          `SELECT h.*, c.number, c.title FROM history h JOIN cards c ON c.id = h.card_id
           WHERE h.project_id = ? AND h.at >= ? AND h.at < ? AND h.action IN ('creada', 'movida')
           ORDER BY h.id`,
        )
        .all(projectId, start.toISOString(), end.toISOString()) as Array<{
        id: number
        card_id: number
        number: number
        title: string
        actor: string
        action: string
        from_value: string | null
        to_value: string | null
        detail: string | null
        at: string
      }>
      const moves: HistoryEntry[] = rows.map((r) => ({
        id: r.id,
        cardId: r.card_id,
        cardNumber: r.number,
        cardTitle: r.title,
        actor: r.actor,
        action: r.action as HistoryEntry['action'],
        from: r.from_value,
        to: r.to_value,
        detail: r.detail,
        at: r.at,
      }))
      return { from: start.toISOString(), to: end.toISOString(), moves }
    },
  }
  return repo
}
