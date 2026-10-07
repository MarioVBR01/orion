import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z, ZodError } from 'zod'
import {
  CARD_TYPES,
  CHANNELS,
  COLUMN_IDS,
  OBSERVATION_KINDS,
  PERSON_ROLES,
  PRIORITIES,
  type CardType,
  type Channel,
  type ColumnId,
  type ObservationKind,
  type ObservationStatus,
  type PersonRole,
  type Priority,
} from '../shared/types'
import { createCardsRepo } from './cards'
import { createObservationsRepo } from './observations'
import { MAX_UPLOAD_BYTES, saveUpload } from './uploads'
import { RuleError } from './errors'
import type { Db } from './db'
import { createRepo, NotFoundError } from './repo'

const projectInput = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9]{2,6}$/, 'El prefijo debe tener de 2 a 6 letras o números'),
  description: z.string().max(2000).default(''),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2563EB'),
})
const projectPatch = projectInput.partial().extend({
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  briefMd: z.string().optional(),
})
const personInput = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  email: z.union([z.string().trim().email('Correo inválido'), z.literal('')]).optional(),
  role: z.enum(PERSON_ROLES as [PersonRole, ...PersonRole[]]),
})
const column = z.enum(COLUMN_IDS as [ColumnId, ...ColumnId[]])
const report = z.object({
  where: z.string().default(''),
  steps: z.array(z.string()).default([]),
  expected: z.string().default(''),
  actual: z.string().default(''),
})
const acceptance = z.array(z.object({ text: z.string().trim().min(1), done: z.boolean().default(false) }))
const cardInput = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(300),
  type: z.enum(CARD_TYPES as [CardType, ...CardType[]]),
  priority: z.enum(PRIORITIES as [Priority, ...Priority[]]),
  column: column.optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  assignee: z.string().trim().max(80).nullable().optional(),
  descriptionMd: z.string().max(50000).optional(),
  report: report.nullable().optional(),
  acceptance: acceptance.optional(),
})
const cardPatch = cardInput.omit({ column: true }).partial().extend({
  branch: z.string().trim().max(200).nullable().optional(),
  prUrl: z.string().trim().max(500).nullable().optional(),
  commitSha: z.string().trim().max(80).nullable().optional(),
  archived: z.boolean().optional(),
})
const moveInput = z.object({
  column,
  order: z.string().regex(/^[0-9A-Za-z]+$/).optional(),
  comment: z.string().max(5000).optional(),
})
const bulkInput = z.object({
  numbers: z.array(z.number().int().positive()).min(1).max(500),
  op: z.discriminatedUnion('action', [
    z.object({ action: z.literal('move'), column }),
    z.object({ action: z.literal('assign'), assignee: z.string().trim().max(80).nullable() }),
    z.object({ action: z.literal('label'), label: z.string().trim().min(1).max(40) }),
    z.object({ action: z.literal('archive') }),
  ]),
})
const commentInput = z.object({ text: z.string().trim().min(1, 'El comentario está vacío').max(10000) })
const attachment = z.object({
  name: z.string().max(120),
  url: z.string().regex(/^\/uploads\/\d+\/[\w.-]+$/, 'Adjunto inválido'),
  type: z.string().max(80),
  size: z.number().int().nonnegative(),
})
const observationInput = z.object({
  channel: z.enum(CHANNELS as [Channel, ...Channel[]]),
  kind: z.enum(OBSERVATION_KINDS as [ObservationKind, ...ObservationKind[]]),
  title: z.string().trim().min(1, 'El título es obligatorio').max(300),
  report: z.object({
    where: z.string().trim().min(1, 'Completa ¿Dónde?').max(500),
    steps: z.array(z.string().max(1000)).refine((s) => s.some((x) => x.trim()), 'Agrega al menos un paso en ¿Qué hice?'),
    expected: z.string().trim().min(1, 'Completa ¿Qué esperaba?').max(5000),
    actual: z.string().trim().min(1, 'Completa ¿Qué pasó?').max(5000),
  }),
  attachments: z.array(attachment).max(20).optional(),
  sender: z.string().trim().max(80).optional(),
})
const numbersInput = z.array(z.number().int().positive()).min(1).max(200)
const toBacklogInput = z.object({
  numbers: numbersInput,
  priority: z.enum(PRIORITIES as [Priority, ...Priority[]]).optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
})
const settingsPatch = z.object({ userName: z.string().trim().min(1).max(60).optional() })

const id = (v: unknown) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new NotFoundError('Identificador inválido')
  return n
}

export function createApp(db: Db, opts: { staticDir?: string; uploadsDir?: string } = {}) {
  const repo = createRepo(db)
  const cards = createCardsRepo(db)
  const observations = createObservationsRepo(db)
  // Con un solo usuario local, el actor de la web es el nombre guardado en Ajustes.
  const actor = () => repo.getSettings().userName
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  const api = express.Router()

  api.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  api.get('/settings', (_req, res) => {
    res.json(repo.getSettings())
  })
  api.patch('/settings', (req, res) => {
    res.json(repo.updateSettings(settingsPatch.parse(req.body)))
  })

  api.get('/projects', (req, res) => {
    res.json(repo.listProjects({ includeArchived: req.query.archived === '1' }))
  })
  api.post('/projects', (req, res) => {
    res.status(201).json(repo.createProject(projectInput.parse(req.body)))
  })
  api.get('/projects/:pid', (req, res) => {
    res.json(repo.getProject(id(req.params.pid)))
  })
  api.patch('/projects/:pid', (req, res) => {
    res.json(repo.updateProject(id(req.params.pid), projectPatch.parse(req.body)))
  })
  api.delete('/projects/:pid', (req, res) => {
    repo.deleteProject(id(req.params.pid))
    res.status(204).end()
  })

  api.get('/projects/:pid/people', (req, res) => {
    res.json(repo.listPeople(id(req.params.pid)))
  })
  api.post('/projects/:pid/people', (req, res) => {
    const body = personInput.parse(req.body)
    res.status(201).json(repo.addPerson(id(req.params.pid), body))
  })
  api.patch('/projects/:pid/people/:id', (req, res) => {
    const body = personInput.partial().parse(req.body)
    res.json(repo.updatePerson(id(req.params.pid), id(req.params.id), body))
  })
  api.delete('/projects/:pid/people/:id', (req, res) => {
    repo.removePerson(id(req.params.pid), id(req.params.id))
    res.status(204).end()
  })

  // ---------- Tarjetas ----------
  api.get('/projects/:pid/cards', (req, res) => {
    res.json(cards.list(id(req.params.pid), { archived: req.query.archived === '1' }))
  })
  api.post('/projects/:pid/cards', (req, res) => {
    res.status(201).json(cards.create(id(req.params.pid), cardInput.parse(req.body), actor()))
  })
  api.post('/projects/:pid/cards/bulk', (req, res) => {
    const body = bulkInput.parse(req.body)
    res.json(cards.bulk(id(req.params.pid), body.numbers, body.op, actor()))
  })
  api.get('/projects/:pid/cards/:n', (req, res) => {
    res.json(cards.get(id(req.params.pid), id(req.params.n)))
  })
  api.patch('/projects/:pid/cards/:n', (req, res) => {
    res.json(cards.update(id(req.params.pid), id(req.params.n), cardPatch.parse(req.body), actor()))
  })
  api.post('/projects/:pid/cards/:n/move', (req, res) => {
    res.json(cards.move(id(req.params.pid), id(req.params.n), moveInput.parse(req.body), actor()))
  })
  api.get('/projects/:pid/cards/:n/comments', (req, res) => {
    res.json(cards.comments(id(req.params.pid), id(req.params.n)))
  })
  api.post('/projects/:pid/cards/:n/comments', (req, res) => {
    res.status(201).json(cards.comment(id(req.params.pid), id(req.params.n), commentInput.parse(req.body).text, actor()))
  })
  api.get('/projects/:pid/cards/:n/history', (req, res) => {
    res.json(cards.history(id(req.params.pid), id(req.params.n)))
  })
  api.get('/projects/:pid/activity', (req, res) => {
    res.json(cards.activity(id(req.params.pid), Math.min(Number(req.query.limit ?? 100) || 100, 500)))
  })

  // ---------- Adjuntos ----------
  api.post('/projects/:pid/uploads', express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), (req, res) => {
    const pid = id(req.params.pid)
    repo.getProject(pid)
    if (!opts.uploadsDir) throw new RuleError('La subida de archivos no está configurada.')
    const name = decodeURIComponent(String(req.header('x-filename') ?? 'archivo'))
    const type = String(req.header('content-type') ?? '').split(';')[0]!.trim()
    res.status(201).json(saveUpload(opts.uploadsDir, pid, name, type, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)))
  })

  // ---------- Observaciones (Por revisar) ----------
  api.get('/projects/:pid/observations', (req, res) => {
    const channel = CHANNELS.find((c) => c === req.query.channel)
    const status = typeof req.query.status === 'string' ? (req.query.status as ObservationStatus | 'abiertas') : undefined
    res.json(observations.list(id(req.params.pid), { channel, status }))
  })
  api.get('/projects/:pid/observations/counts', (req, res) => {
    res.json(observations.pendingCounts(id(req.params.pid)))
  })
  api.post('/projects/:pid/observations', (req, res) => {
    res.status(201).json(observations.create(id(req.params.pid), observationInput.parse(req.body), actor()))
  })
  api.post('/projects/:pid/observations/to-backlog', (req, res) => {
    res.json(observations.toBacklog(id(req.params.pid), toBacklogInput.parse(req.body), actor()))
  })
  api.post('/projects/:pid/observations/reject', (req, res) => {
    const body = z.object({ numbers: numbersInput, reason: z.string().trim().min(1, 'Indica el motivo del rechazo').max(2000) }).parse(req.body)
    res.json(observations.reject(id(req.params.pid), body.numbers, body.reason, actor()))
  })
  api.get('/projects/:pid/observations/:n', (req, res) => {
    res.json(observations.get(id(req.params.pid), id(req.params.n)))
  })
  api.patch('/projects/:pid/observations/:n', (req, res) => {
    res.json(observations.update(id(req.params.pid), id(req.params.n), observationInput.partial().parse(req.body)))
  })
  api.post('/projects/:pid/observations/:n/request-info', (req, res) => {
    const body = z.object({ question: z.string().trim().min(1, 'Escribe qué información falta').max(2000) }).parse(req.body)
    res.json(observations.requestInfo(id(req.params.pid), id(req.params.n), body.question, actor()))
  })
  api.post('/projects/:pid/observations/:n/reopen', (req, res) => {
    res.json(observations.reopen(id(req.params.pid), id(req.params.n), actor()))
  })
  api.get('/projects/:pid/observations/:n/comments', (req, res) => {
    res.json(observations.comments(id(req.params.pid), id(req.params.n)))
  })
  api.post('/projects/:pid/observations/:n/comments', (req, res) => {
    res.status(201).json(observations.comment(id(req.params.pid), id(req.params.n), commentInput.parse(req.body).text, actor()))
  })

  api.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })

  app.use('/api', api)
  if (opts.uploadsDir) app.use('/uploads', express.static(opts.uploadsDir, { maxAge: '7d', fallthrough: false }))

  // En producción local el mismo servidor sirve la web compilada (SPA).
  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { index: false, maxAge: '1h' }))
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(opts.staticDir!, 'index.html'))
    })
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues.map((i) => i.message).join('. ') })
      return
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON inválido' })
      return
    }
    if (err instanceof RuleError) {
      res.status(400).json({ error: err.message })
      return
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    // Errores HTTP de Express/static (404 de un adjunto inexistente, 413 de archivo grande, etc.)
    const status = typeof err === 'object' && err && 'status' in err ? Number((err as { status: unknown }).status) : 500
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: status === 413 ? 'El archivo es demasiado grande.' : 'Solicitud inválida' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })

  return app
}
