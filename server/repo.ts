import { COLUMN_IDS, type ColumnCounts, type Person, type PersonRole, type Project, type ProjectInput, type Settings } from '../shared/types'
import { now, type Db } from './db'
import { NotFoundError } from './errors'

export { NotFoundError }

interface ProjectRow {
  id: number
  name: string
  code: string
  description: string
  color: string
  favorite: number
  archived: number
  brief_md: string
  created_at: string
}

interface PersonRow {
  id: number
  project_id: number
  name: string
  email: string
  role: string
  created_at: string
}

const emptyCounts = (): ColumnCounts => Object.fromEntries(COLUMN_IDS.map((c) => [c, 0])) as ColumnCounts

function toPerson(r: PersonRow): Person {
  return { id: r.id, projectId: r.project_id, name: r.name, email: r.email, role: r.role as PersonRole, createdAt: r.created_at }
}

export function createRepo(db: Db) {
  function countsFor(projectId: number): ColumnCounts {
    const counts = emptyCounts()
    const rows = db
      .prepare('SELECT column_id, COUNT(*) AS n FROM cards WHERE project_id = ? AND archived = 0 GROUP BY column_id')
      .all(projectId) as Array<{ column_id: string; n: number }>
    for (const r of rows) if (r.column_id in counts) counts[r.column_id as keyof ColumnCounts] = r.n
    return counts
  }

  function toProject(r: ProjectRow): Project {
    const people = db.prepare('SELECT id, name FROM people WHERE project_id = ? ORDER BY name').all(r.id) as Array<{ id: number; name: string }>
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      color: r.color,
      favorite: r.favorite === 1,
      archived: r.archived === 1,
      briefMd: r.brief_md,
      createdAt: r.created_at,
      counts: countsFor(r.id),
      people,
    }
  }

  const repo = {
    // ---------- Ajustes ----------
    getSettings(): Settings {
      const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
      const map = new Map(rows.map((r) => [r.key, r.value]))
      return { userName: map.get('userName') ?? 'Yo' }
    },

    updateSettings(patch: Partial<Settings>): Settings {
      const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) stmt.run(k, String(v))
      return repo.getSettings()
    },

    // ---------- Proyectos ----------
    listProjects(opts: { includeArchived?: boolean } = {}): Project[] {
      const rows = db
        .prepare(`SELECT * FROM projects ${opts.includeArchived ? '' : 'WHERE archived = 0'} ORDER BY favorite DESC, id ASC`)
        .all() as unknown as ProjectRow[]
      return rows.map(toProject)
    },

    getProject(id: number): Project {
      const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
      if (!row) throw new NotFoundError(`Proyecto #${id} no existe`)
      return toProject(row)
    },

    createProject(input: ProjectInput): Project {
      const res = db
        .prepare('INSERT INTO projects (name, code, description, color, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(input.name.trim(), input.code.trim().toUpperCase(), input.description.trim(), input.color, now())
      return repo.getProject(Number(res.lastInsertRowid))
    },

    updateProject(id: number, patch: Partial<ProjectInput & { favorite: boolean; archived: boolean; briefMd: string }>): Project {
      repo.getProject(id)
      const map: Record<string, [string, unknown]> = {
        name: ['name', patch.name?.trim()],
        code: ['code', patch.code?.trim().toUpperCase()],
        description: ['description', patch.description?.trim()],
        color: ['color', patch.color],
        favorite: ['favorite', patch.favorite === undefined ? undefined : patch.favorite ? 1 : 0],
        archived: ['archived', patch.archived === undefined ? undefined : patch.archived ? 1 : 0],
        briefMd: ['brief_md', patch.briefMd],
      }
      const sets: string[] = []
      const values: Array<string | number> = []
      for (const [col, val] of Object.values(map)) {
        if (val === undefined) continue
        sets.push(`${col} = ?`)
        values.push(val as string | number)
      }
      if (sets.length) db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
      return repo.getProject(id)
    },

    deleteProject(id: number) {
      repo.getProject(id)
      db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    },

    // ---------- Personas del proyecto ----------
    listPeople(projectId: number): Person[] {
      repo.getProject(projectId)
      const rows = db.prepare('SELECT * FROM people WHERE project_id = ? ORDER BY name').all(projectId) as unknown as PersonRow[]
      return rows.map(toPerson)
    },

    addPerson(projectId: number, input: { name: string; email?: string; role: PersonRole }): Person {
      repo.getProject(projectId)
      const res = db
        .prepare('INSERT INTO people (project_id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(projectId, input.name.trim(), (input.email ?? '').trim().toLowerCase(), input.role, now())
      return toPerson(db.prepare('SELECT * FROM people WHERE id = ?').get(Number(res.lastInsertRowid)) as unknown as PersonRow)
    },

    updatePerson(projectId: number, personId: number, patch: { name?: string; email?: string; role?: PersonRole }): Person {
      const row = db.prepare('SELECT * FROM people WHERE id = ? AND project_id = ?').get(personId, projectId) as PersonRow | undefined
      if (!row) throw new NotFoundError('Persona no encontrada')
      db.prepare('UPDATE people SET name = ?, email = ?, role = ? WHERE id = ?').run(
        patch.name?.trim() ?? row.name,
        patch.email?.trim().toLowerCase() ?? row.email,
        patch.role ?? row.role,
        personId,
      )
      return toPerson(db.prepare('SELECT * FROM people WHERE id = ?').get(personId) as unknown as PersonRow)
    },

    removePerson(projectId: number, personId: number) {
      const res = db.prepare('DELETE FROM people WHERE id = ? AND project_id = ?').run(personId, projectId)
      if (res.changes === 0) throw new NotFoundError('Persona no encontrada')
    },
  }
  return repo
}

export type Repo = ReturnType<typeof createRepo>
