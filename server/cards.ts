import { buildExportMarkdown, exportFilename } from '../shared/exportMd'
import { moveError } from '../shared/flow'
import { keyBetween } from '../shared/order'
import {
  COLUMN_IDS,
  type ExportInput,
  type ExportResult,
  type Attachment,
  type BulkAction,
  type Card,
  type CardInput,
  type CardPatch,
  type ColumnId,
  type Comment,
  type HistoryAction,
  type HistoryEntry,
  type MoveInput,
} from '../shared/types'
import { now, tx, type Db } from './db'
import { NotFoundError, RuleError } from './errors'

interface CardRow {
  id: number
  project_id: number
  number: number
  title: string
  type: string
  priority: string
  column_id: string
  ord: string
  labels: string
  assignee: string | null
  description_md: string
  report: string | null
  acceptance: string
  attachments: string
  sprint_id: number | null
  version_id: number | null
  branch: string | null
  pr_url: string | null
  commit_sha: string | null
  source_observation_ids: string
  created_by: string
  created_at: string
  updated_at: string
  archived: number
  exported_at: string | null
}

interface HistoryRow {
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
}

function toCard(r: CardRow): Card {
  return {
    id: r.id,
    projectId: r.project_id,
    number: r.number,
    title: r.title,
    type: r.type as Card['type'],
    priority: r.priority as Card['priority'],
    column: r.column_id as ColumnId,
    order: r.ord,
    labels: JSON.parse(r.labels) as string[],
    assignee: r.assignee,
    descriptionMd: r.description_md,
    report: r.report ? (JSON.parse(r.report) as Card['report']) : null,
    acceptance: JSON.parse(r.acceptance) as Card['acceptance'],
    attachments: JSON.parse(r.attachments) as Card['attachments'],
    sprintId: r.sprint_id,
    versionId: r.version_id,
    branch: r.branch,
    prUrl: r.pr_url,
    commitSha: r.commit_sha,
    sourceObservationIds: JSON.parse(r.source_observation_ids) as number[],
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archived: r.archived === 1,
    exportedAt: r.exported_at,
  }
}

const toHistory = (r: HistoryRow): HistoryEntry => ({
  id: r.id,
  cardId: r.card_id,
  cardNumber: r.number,
  cardTitle: r.title,
  actor: r.actor,
  action: r.action as HistoryAction,
  from: r.from_value,
  to: r.to_value,
  detail: r.detail,
  at: r.at,
})

const cleanLabels = (labels: string[]) => [...new Set(labels.map((l) => l.trim()).filter(Boolean))]

export function createCardsRepo(db: Db) {
  function ensureProject(projectId: number) {
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw new NotFoundError(`Proyecto #${projectId} no existe`)
  }

  function row(projectId: number, number: number): CardRow {
    const r = db.prepare('SELECT * FROM cards WHERE project_id = ? AND number = ?').get(projectId, number) as CardRow | undefined
    if (!r) throw new NotFoundError(`Tarjeta #${number} no existe`)
    return r
  }

  /** Nombre del sprint (para el historial); valida que exista en el proyecto y no esté completado. */
  function sprintName(projectId: number, sprintId: number | null | undefined, opts: { allowCompleted?: boolean } = {}): string | null {
    if (sprintId === null || sprintId === undefined) return null
    const s = db.prepare('SELECT name, status FROM sprints WHERE id = ? AND project_id = ?').get(sprintId, projectId) as
      | { name: string; status: string }
      | undefined
    if (!s) throw new RuleError('El sprint no existe en este proyecto.')
    if (s.status === 'completado' && !opts.allowCompleted) throw new RuleError(`El sprint "${s.name}" ya está completado.`)
    return s.name
  }

  function currentSprintName(projectId: number, sprintId: number | null): string | null {
    return sprintId === null ? null : sprintName(projectId, sprintId, { allowCompleted: true })
  }

  function lastOrder(projectId: number, column: ColumnId): string | null {
    const r = db
      .prepare('SELECT ord FROM cards WHERE project_id = ? AND column_id = ? AND archived = 0 ORDER BY ord DESC LIMIT 1')
      .get(projectId, column) as { ord: string } | undefined
    return r?.ord ?? null
  }

  function log(card: CardRow, actor: string, action: HistoryAction, from?: string | null, to?: string | null, detail?: string | null) {
    db.prepare(
      'INSERT INTO history (project_id, card_id, actor, action, from_value, to_value, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(card.project_id, card.id, actor, action, from ?? null, to ?? null, detail ?? null, now())
  }

  function addComment(card: CardRow, author: string, text: string): Comment {
    const at = now()
    const res = db.prepare('INSERT INTO comments (card_id, author, text, created_at) VALUES (?, ?, ?, ?)').run(card.id, author, text.trim(), at)
    return { id: Number(res.lastInsertRowid), cardId: card.id, author, text: text.trim(), createdAt: at }
  }

  /** Mueve sin abrir transacción (la abre quien llama). */
  function moveRow(card: CardRow, actor: string, input: MoveInput) {
    const from = card.column_id as ColumnId
    const err = moveError(actor, from, input.column, input.comment)
    if (err) throw new RuleError(err)
    const order = input.order ?? keyBetween(lastOrder(card.project_id, input.column), null)
    db.prepare('UPDATE cards SET column_id = ?, ord = ?, updated_at = ? WHERE id = ?').run(input.column, order, now(), card.id)
    if (from !== input.column) {
      log(card, actor, 'movida', from, input.column, input.comment?.trim() || null)
      if (input.comment?.trim()) addComment(card, actor, input.comment)
    }
  }

  const repo = {
    list(projectId: number, opts: { archived?: boolean; column?: ColumnId; assignee?: string } = {}): Card[] {
      ensureProject(projectId)
      const where = ['project_id = ?', 'archived = ?']
      const params: Array<string | number> = [projectId, opts.archived ? 1 : 0]
      if (opts.column) {
        where.push('column_id = ?')
        params.push(opts.column)
      }
      if (opts.assignee) {
        where.push('assignee = ?')
        params.push(opts.assignee)
      }
      const rows = db.prepare(`SELECT * FROM cards WHERE ${where.join(' AND ')} ORDER BY column_id, ord`).all(...params) as unknown as CardRow[]
      return rows.map(toCard)
    },

    get(projectId: number, number: number): Card {
      return toCard(row(projectId, number))
    },

    /**
     * Crea una tarjeta. `extra` lo usa la conversión de observaciones:
     * conserva autor original, adjuntos y la observación de origen.
     */
    create(
      projectId: number,
      input: CardInput,
      actor: string,
      extra: { createdBy?: string; attachments?: Attachment[]; sourceObservationIds?: number[] } = {},
    ): Card {
      ensureProject(projectId)
      return tx(db, () => {
        db.prepare('UPDATE projects SET card_counter = card_counter + 1 WHERE id = ?').run(projectId)
        const { card_counter: number } = db.prepare('SELECT card_counter FROM projects WHERE id = ?').get(projectId) as { card_counter: number }
        const column = input.column ?? 'backlog'
        const err = moveError(actor, 'backlog', column)
        if (err) throw new RuleError(err)
        sprintName(projectId, input.sprintId)
        const at = now()
        db.prepare(
          `INSERT INTO cards (project_id, number, title, type, priority, column_id, ord, labels, assignee, description_md,
             report, acceptance, attachments, source_observation_ids, sprint_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          projectId,
          number,
          input.title.trim(),
          input.type,
          input.priority,
          column,
          keyBetween(lastOrder(projectId, column), null),
          JSON.stringify(cleanLabels(input.labels ?? [])),
          input.assignee ?? null,
          input.descriptionMd ?? '',
          input.report ? JSON.stringify(input.report) : null,
          JSON.stringify(input.acceptance ?? []),
          JSON.stringify(extra.attachments ?? []),
          JSON.stringify(extra.sourceObservationIds ?? []),
          input.sprintId ?? null,
          extra.createdBy ?? actor,
          at,
          at,
        )
        const card = row(projectId, number)
        log(card, actor, 'creada', null, column)
        return toCard(card)
      })
    },

    update(projectId: number, number: number, patch: CardPatch, actor: string): Card {
      return tx(db, () => {
        const card = row(projectId, number)
        const cols: Record<keyof CardPatch, [string, (v: never) => string | number | null]> = {
          title: ['title', (v: string) => v.trim()],
          type: ['type', (v: string) => v],
          priority: ['priority', (v: string) => v],
          labels: ['labels', (v: string[]) => JSON.stringify(cleanLabels(v))],
          assignee: ['assignee', (v: string | null) => v],
          descriptionMd: ['description_md', (v: string) => v],
          report: ['report', (v: unknown) => (v ? JSON.stringify(v) : null)],
          acceptance: ['acceptance', (v: unknown) => JSON.stringify(v)],
          branch: ['branch', (v: string | null) => v || null],
          prUrl: ['pr_url', (v: string | null) => v || null],
          commitSha: ['commit_sha', (v: string | null) => v || null],
          archived: ['archived', (v: boolean) => (v ? 1 : 0)],
          sprintId: ['sprint_id', (v: number | null) => v],
        }
        const newSprint = patch.sprintId !== undefined ? sprintName(projectId, patch.sprintId) : undefined
        const sets: string[] = []
        const values: Array<string | number | null> = []
        const changed: string[] = []
        for (const [key, value] of Object.entries(patch) as Array<[keyof CardPatch, unknown]>) {
          if (value === undefined || !(key in cols)) continue
          const [col, conv] = cols[key]
          sets.push(`${col} = ?`)
          values.push(conv(value as never))
          changed.push(key)
        }
        if (!sets.length) return toCard(card)
        sets.push('updated_at = ?')
        values.push(now())
        db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).run(...values, card.id)

        if (patch.archived !== undefined && changed.length === 1) {
          log(card, actor, patch.archived ? 'archivada' : 'restaurada')
        } else if (changed.length === 1 && patch.sprintId !== undefined) {
          log(card, actor, 'editada', currentSprintName(projectId, card.sprint_id), newSprint ?? null, 'sprint')
        } else if (changed.length === 1 && patch.assignee !== undefined) {
          log(card, actor, 'editada', card.assignee, patch.assignee, 'asignado')
        } else {
          log(card, actor, 'editada', null, null, changed.join(', '))
        }
        return toCard(row(projectId, number))
      })
    },

    move(projectId: number, number: number, input: MoveInput, actor: string): Card {
      return tx(db, () => {
        moveRow(row(projectId, number), actor, input)
        return toCard(row(projectId, number))
      })
    },

    bulk(projectId: number, numbers: number[], op: BulkAction, actor: string): Card[] {
      return tx(db, () => {
        const cards = numbers.map((n) => row(projectId, n))
        for (const card of cards) {
          if (op.action === 'move') {
            moveRow(card, actor, { column: op.column })
          } else if (op.action === 'assign') {
            db.prepare('UPDATE cards SET assignee = ?, updated_at = ? WHERE id = ?').run(op.assignee, now(), card.id)
            log(card, actor, 'editada', card.assignee, op.assignee, 'asignado')
          } else if (op.action === 'sprint') {
            const name = sprintName(projectId, op.sprintId)
            if (card.sprint_id === op.sprintId) continue
            db.prepare('UPDATE cards SET sprint_id = ?, updated_at = ? WHERE id = ?').run(op.sprintId, now(), card.id)
            log(card, actor, 'editada', currentSprintName(projectId, card.sprint_id), name, 'sprint')
          } else if (op.action === 'label') {
            const labels = cleanLabels([...(JSON.parse(card.labels) as string[]), op.label])
            db.prepare('UPDATE cards SET labels = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(labels), now(), card.id)
            log(card, actor, 'editada', null, null, `etiqueta ${op.label}`)
          } else {
            db.prepare('UPDATE cards SET archived = 1, updated_at = ? WHERE id = ?').run(now(), card.id)
            log(card, actor, 'archivada')
          }
        }
        return numbers.map((n) => toCard(row(projectId, n)))
      })
    },

    /** Registra rama/commit/PR (lo usa Claude vía MCP). */
    registerWork(projectId: number, number: number, work: { branch?: string; commit?: string; pr?: string }, actor: string): Card {
      return tx(db, () => {
        const card = row(projectId, number)
        db.prepare(
          'UPDATE cards SET branch = COALESCE(?, branch), commit_sha = COALESCE(?, commit_sha), pr_url = COALESCE(?, pr_url), updated_at = ? WHERE id = ?',
        ).run(work.branch || null, work.commit || null, work.pr || null, now(), card.id)
        const detail = [work.branch && `rama ${work.branch}`, work.commit && `commit ${work.commit}`, work.pr && `PR ${work.pr}`]
          .filter(Boolean)
          .join(' · ')
        log(card, actor, 'trabajo', null, null, detail)
        return toCard(row(projectId, number))
      })
    },

    /**
     * Genera el .md para el chat de Claude del proyecto, con las tarjetas en el orden del tablero.
     * Con `mark`, registra la exportación (historial + exportedAt) y opcionalmente mueve las tarjetas.
     */
    exportMarkdown(
      projectId: number,
      input: ExportInput,
      actor: string,
      opts: { attachmentPath: (url: string) => string | null; date: string; isoDate: string },
    ): ExportResult {
      const project = db.prepare('SELECT name, code, ai_instructions FROM projects WHERE id = ?').get(projectId) as
        | { name: string; code: string; ai_instructions: string }
        | undefined
      if (!project) throw new NotFoundError(`Proyecto #${projectId} no existe`)
      const rows = [...new Set(input.numbers)].map((n) => row(projectId, n))
      rows.sort((a, b) => {
        const byCol = COLUMN_IDS.indexOf(a.column_id as ColumnId) - COLUMN_IDS.indexOf(b.column_id as ColumnId)
        return byCol || (a.ord < b.ord ? -1 : a.ord > b.ord ? 1 : 0)
      })
      const numbers = rows.map((r) => r.number)
      const filename = exportFilename({ code: project.code }, numbers, opts.isoDate)

      if (input.mark) {
        tx(db, () => {
          for (const r of rows) {
            db.prepare('UPDATE cards SET exported_at = ? WHERE id = ?').run(now(), r.id)
            log(r, actor, 'exportada', null, null, filename)
            if (input.moveTo && input.moveTo !== r.column_id) moveRow(r, actor, { column: input.moveTo })
          }
        })
      }

      const items = numbers.map((n) => ({ card: toCard(row(projectId, n)), comments: repo.comments(projectId, n) }))
      const markdown = buildExportMarkdown(
        { name: project.name, code: project.code, aiInstructions: project.ai_instructions },
        items,
        { date: opts.date, attachmentPath: opts.attachmentPath },
      )
      return { filename, markdown }
    },

    comments(projectId: number, number: number): Comment[] {
      const card = row(projectId, number)
      const rows = db.prepare('SELECT * FROM comments WHERE card_id = ? ORDER BY id').all(card.id) as Array<{
        id: number
        card_id: number
        author: string
        text: string
        created_at: string
      }>
      return rows.map((r) => ({ id: r.id, cardId: r.card_id, author: r.author, text: r.text, createdAt: r.created_at }))
    },

    comment(projectId: number, number: number, text: string, actor: string): Comment {
      if (!text.trim()) throw new RuleError('El comentario está vacío.')
      return tx(db, () => {
        const card = row(projectId, number)
        const c = addComment(card, actor, text)
        log(card, actor, 'comentada', null, null, text.trim().slice(0, 140))
        return c
      })
    },

    history(projectId: number, number: number): HistoryEntry[] {
      const card = row(projectId, number)
      const rows = db
        .prepare(
          `SELECT h.*, c.number, c.title FROM history h JOIN cards c ON c.id = h.card_id WHERE h.card_id = ? ORDER BY h.id DESC`,
        )
        .all(card.id) as unknown as HistoryRow[]
      return rows.map(toHistory)
    },

    activity(projectId: number, limit = 100): HistoryEntry[] {
      ensureProject(projectId)
      const rows = db
        .prepare(
          `SELECT h.*, c.number, c.title FROM history h JOIN cards c ON c.id = h.card_id
           WHERE h.project_id = ? ORDER BY h.id DESC LIMIT ?`,
        )
        .all(projectId, limit) as unknown as HistoryRow[]
      return rows.map(toHistory)
    },
  }
  return repo
}

export type CardsRepo = ReturnType<typeof createCardsRepo>
