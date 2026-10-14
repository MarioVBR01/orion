import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb, type Db } from '../../server/db'
import { createApp } from '../../server/app'
import { createCardsRepo } from '../../server/cards'

let db: Db
let app: ReturnType<typeof createApp>
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const entry = (person: string) => ({ person, yesterday: 'Revisé reportes', today: 'Probar entregas', blockers: '' })

beforeEach(async () => {
  db = openDb(':memory:')
  app = createApp(db)
  await request(app).post('/api/projects').send({ name: 'YALEH', code: 'YLH' })
})

describe('Daily Scrum', () => {
  it('crea, lista, edita y elimina, con foto del tablero', async () => {
    createCardsRepo(db).create(1, { title: 'A', type: 'bug', priority: 'alta' }, 'Mario')
    const c = await request(app).post('/api/projects/1/dailies').send({ date: today(), notes: 'Sprint 1', entries: [entry('Mario'), entry('  ')] })
    expect(c.status).toBe(201)
    expect(c.body.entries).toHaveLength(1)
    expect(c.body.boardSnapshot.backlog).toBe(1)

    const dup = await request(app).post('/api/projects/1/dailies').send({ date: today(), entries: [] })
    expect(dup.status).toBe(400)
    expect(dup.body.error).toMatch(/Ya existe un Daily Scrum para el \d{2}\/\d{2}\/\d{4}/)

    await request(app).post('/api/projects/1/dailies').send({ date: '2026-09-15', entries: [] })
    const list = await request(app).get('/api/projects/1/dailies')
    expect(list.body.map((d: { date: string }) => d.date)).toEqual([today(), '2026-09-15'])

    const u = await request(app).put(`/api/projects/1/dailies/${c.body.id}`).send({ date: today(), entries: [entry('Mario'), entry('Leonel')] })
    expect(u.body.entries.map((e: { person: string }) => e.person)).toEqual(['Mario', 'Leonel'])
    const dupPerson = await request(app).put(`/api/projects/1/dailies/${c.body.id}`).send({ date: today(), entries: [entry('Mario'), entry('mario')] })
    expect(dupPerson.body.error).toMatch(/repetidos/)

    expect((await request(app).delete(`/api/projects/1/dailies/${c.body.id}`)).status).toBe(204)
    expect((await request(app).get('/api/projects/1/dailies')).body).toHaveLength(1)
  })

  it('la actividad incluye los movimientos del periodo (incluido Claude)', async () => {
    const cards = createCardsRepo(db)
    cards.create(1, { title: 'Botón QR', type: 'bug', priority: 'alta' }, 'Mario')
    cards.move(1, 1, { column: 'por_hacer' }, 'claude')
    cards.move(1, 1, { column: 'en_progreso' }, 'claude')
    cards.comment(1, 1, 'nota', 'claude')
    const a = await request(app).get(`/api/projects/1/dailies/activity?date=${today()}`)
    expect(a.status).toBe(200)
    expect(a.body.moves.map((m: { action: string; to: string; actor: string }) => `${m.actor}:${m.action}:${m.to}`)).toEqual([
      'Mario:creada:backlog',
      'claude:movida:por_hacer',
      'claude:movida:en_progreso',
    ])
    expect((await request(app).get('/api/projects/1/dailies/activity?date=mal')).status).toBe(400)
  })
})
