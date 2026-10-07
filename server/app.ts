import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { z, ZodError } from 'zod'
import { PERSON_ROLES } from '../shared/types'
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
  role: z.enum(PERSON_ROLES as [string, ...string[]]),
})
const settingsPatch = z.object({ userName: z.string().trim().min(1).max(60).optional() })

const id = (v: unknown) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new NotFoundError('Identificador inválido')
  return n
}

export function createApp(db: Db, opts: { staticDir?: string } = {}) {
  const repo = createRepo(db)
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
    res.status(201).json(repo.addPerson(id(req.params.pid), body as Parameters<typeof repo.addPerson>[1]))
  })
  api.patch('/projects/:pid/people/:id', (req, res) => {
    const body = personInput.partial().parse(req.body)
    res.json(repo.updatePerson(id(req.params.pid), id(req.params.id), body as Parameters<typeof repo.updatePerson>[2]))
  })
  api.delete('/projects/:pid/people/:id', (req, res) => {
    repo.removePerson(id(req.params.pid), id(req.params.id))
    res.status(204).end()
  })

  api.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })

  app.use('/api', api)

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
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })

  return app
}
