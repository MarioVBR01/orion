import {
  KIND_TO_CARD_TYPE,
  type Attachment,
  type Card,
  type Channel,
  type Observation,
  type ObservationComment,
  type ObservationInput,
  type ObservationStatus,
  type Report,
  type ToBacklogInput,
} from '../shared/types'
import { createCardsRepo } from './cards'
import { now, tx, type Db } from './db'
import { NotFoundError, RuleError } from './errors'

interface ObsRow {
  id: number
  project_id: number
  number: number
  channel: string
  kind: string
  title: string
  description: string
  report: string
  attachments: string
  sender: string
  status: string
  status_note: string | null
  card_number: number | null
  created_at: string
  updated_at: string
}

const toObservation = (r: ObsRow): Observation => ({
  id: r.id,
  projectId: r.project_id,
  number: r.number,
  channel: r.channel as Channel,
  kind: r.kind as Observation['kind'],
  title: r.title,
  description: r.description,
  // las observaciones nuevas guardan 'null' en report (columna NOT NULL heredada)
  report: JSON.parse(r.report) as Report | null,
  attachments: JSON.parse(r.attachments) as Attachment[],
  sender: r.sender,
  status: r.status as ObservationStatus,
  statusNote: r.status_note,
  cardNumber: r.card_number,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const OPEN: ObservationStatus[] = ['pendiente', 'info']

export function createObservationsRepo(db: Db) {
  const cards = createCardsRepo(db)

  function ensureProject(projectId: number) {
    if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) throw new NotFoundError(`Proyecto #${projectId} no existe`)
  }

  function row(projectId: number, number: number): ObsRow {
    const r = db.prepare('SELECT * FROM observations WHERE project_id = ? AND number = ?').get(projectId, number) as ObsRow | undefined
    if (!r) throw new NotFoundError(`Observación #${number} no existe`)
    return r
  }

  function addComment(obs: ObsRow, author: string, text: string): ObservationComment {
    const at = now()
    const res = db
      .prepare('INSERT INTO observation_comments (observation_id, author, text, created_at) VALUES (?, ?, ?, ?)')
      .run(obs.id, author, text.trim(), at)
    return { id: Number(res.lastInsertRowid), observationId: obs.id, author, text: text.trim(), createdAt: at }
  }

  function setStatus(obs: ObsRow, status: ObservationStatus, note: string | null, cardNumber: number | null = obs.card_number) {
    db.prepare('UPDATE observations SET status = ?, status_note = ?, card_number = ?, updated_at = ? WHERE id = ?').run(
      status,
      note,
      cardNumber,
      now(),
      obs.id,
    )
  }

  function requireOpen(obs: ObsRow) {
    if (!OPEN.includes(obs.status as ObservationStatus)) {
      throw new RuleError(
        obs.status === 'en_backlog'
          ? `La observación #${obs.number} ya está en el Backlog (tarjeta #${obs.card_number}).`
          : `La observación #${obs.number} fue rechazada.`,
      )
    }
  }

  const repo = {
    list(projectId: number, opts: { channel?: Channel; status?: ObservationStatus | 'abiertas' } = {}): Observation[] {
      ensureProject(projectId)
      const where = ['project_id = ?']
      const params: Array<string | number> = [projectId]
      if (opts.channel) {
        where.push('channel = ?')
        params.push(opts.channel)
      }
      if (opts.status === 'abiertas') {
        where.push(`status IN ('pendiente', 'info')`)
      } else if (opts.status) {
        where.push('status = ?')
        params.push(opts.status)
      }
      const rows = db
        .prepare(`SELECT * FROM observations WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC`)
        .all(...params) as unknown as ObsRow[]
      return rows.map(toObservation)
    },

    /** Pendientes por canal (para los contadores de la pestaña). */
    pendingCounts(projectId: number): Record<Channel, number> {
      const rows = db
        .prepare(`SELECT channel, COUNT(*) AS n FROM observations WHERE project_id = ? AND status IN ('pendiente', 'info') GROUP BY channel`)
        .all(projectId) as Array<{ channel: Channel; n: number }>
      const counts: Record<Channel, number> = { clientes: 0, testers: 0 }
      for (const r of rows) counts[r.channel] = r.n
      return counts
    },

    get(projectId: number, number: number): Observation {
      return toObservation(row(projectId, number))
    },

    create(projectId: number, input: ObservationInput, actor: string): Observation {
      ensureProject(projectId)
      return tx(db, () => {
        db.prepare('UPDATE projects SET observation_counter = observation_counter + 1 WHERE id = ?').run(projectId)
        const { observation_counter: number } = db
          .prepare('SELECT observation_counter FROM projects WHERE id = ?')
          .get(projectId) as { observation_counter: number }
        const at = now()
        db.prepare(
          `INSERT INTO observations (project_id, number, channel, kind, title, description, report, attachments, sender, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'null', ?, ?, ?, ?)`,
        ).run(
          projectId,
          number,
          input.channel,
          input.kind,
          input.title.trim(),
          input.description.trim(),
          JSON.stringify(input.attachments ?? []),
          input.sender?.trim() || actor,
          at,
          at,
        )
        return toObservation(row(projectId, number))
      })
    },

    /** Editar mientras está abierta; si estaba esperando información, vuelve a pendiente. */
    update(projectId: number, number: number, patch: Partial<ObservationInput>): Observation {
      return tx(db, () => {
        const obs = row(projectId, number)
        requireOpen(obs)
        const next = { ...toObservation(obs), ...patch }
        db.prepare(
          `UPDATE observations SET channel = ?, kind = ?, title = ?, description = ?, attachments = ?, sender = ?,
             status = 'pendiente', updated_at = ? WHERE id = ?`,
        ).run(
          next.channel,
          next.kind,
          next.title.trim(),
          next.description.trim(),
          JSON.stringify(next.attachments),
          next.sender.trim(),
          now(),
          obs.id,
        )
        return toObservation(row(projectId, number))
      })
    },

    /** Pasa observaciones al Backlog: cada una se convierte en una tarjeta. Todo o nada. */
    toBacklog(projectId: number, input: ToBacklogInput, actor: string): Card[] {
      return tx(db, () =>
        input.numbers.map((n) => {
          const obs = row(projectId, n)
          requireOpen(obs)
          const o = toObservation(obs)
          const card = cards.create(
            projectId,
            {
              title: o.title,
              type: KIND_TO_CARD_TYPE[o.kind],
              priority: input.priority ?? 'media',
              column: 'backlog',
              labels: input.labels ?? [],
              report: o.report,
              descriptionMd: o.description,
            },
            actor,
            { createdBy: o.sender, attachments: o.attachments, sourceObservationIds: [o.number] },
          )
          setStatus(obs, 'en_backlog', null, card.number)
          addComment(obs, actor, `Pasada al Backlog como tarjeta #${card.number}.`)
          return card
        }),
      )
    },

    reject(projectId: number, numbers: number[], reason: string, actor: string): Observation[] {
      if (!reason.trim()) throw new RuleError('Indica el motivo del rechazo.')
      return tx(db, () =>
        numbers.map((n) => {
          const obs = row(projectId, n)
          requireOpen(obs)
          setStatus(obs, 'rechazada', reason.trim())
          addComment(obs, actor, `Rechazada: ${reason.trim()}`)
          return toObservation(row(projectId, n))
        }),
      )
    },

    requestInfo(projectId: number, number: number, question: string, actor: string): Observation {
      if (!question.trim()) throw new RuleError('Escribe qué información falta.')
      return tx(db, () => {
        const obs = row(projectId, number)
        requireOpen(obs)
        setStatus(obs, 'info', question.trim())
        addComment(obs, actor, `Se pidió más información: ${question.trim()}`)
        return toObservation(row(projectId, number))
      })
    },

    /** Vuelve a abrir una rechazada. */
    reopen(projectId: number, number: number, actor: string): Observation {
      return tx(db, () => {
        const obs = row(projectId, number)
        if (obs.status !== 'rechazada') throw new RuleError('Solo se pueden reabrir observaciones rechazadas.')
        setStatus(obs, 'pendiente', null)
        addComment(obs, actor, 'Reabierta.')
        return toObservation(row(projectId, number))
      })
    },

    comments(projectId: number, number: number): ObservationComment[] {
      const obs = row(projectId, number)
      const rows = db.prepare('SELECT * FROM observation_comments WHERE observation_id = ? ORDER BY id').all(obs.id) as Array<{
        id: number
        observation_id: number
        author: string
        text: string
        created_at: string
      }>
      return rows.map((r) => ({ id: r.id, observationId: r.observation_id, author: r.author, text: r.text, createdAt: r.created_at }))
    },

    comment(projectId: number, number: number, text: string, actor: string): ObservationComment {
      if (!text.trim()) throw new RuleError('El comentario está vacío.')
      return addComment(row(projectId, number), actor, text)
    },
  }
  return repo
}
