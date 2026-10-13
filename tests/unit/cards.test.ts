import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb, type Db } from '../../server/db'
import { createApp } from '../../server/app'
import { createCardsRepo } from '../../server/cards'

let db: Db
let app: ReturnType<typeof createApp>

const newCard = (title: string, extra: Record<string, unknown> = {}) =>
  request(app).post('/api/projects/1/cards').send({ title, type: 'tarea', priority: 'media', ...extra })

beforeEach(async () => {
  db = openDb(':memory:')
  app = createApp(db)
  await request(app).patch('/api/settings').send({ userName: 'Mario' })
  await request(app).post('/api/projects').send({ name: 'LaGuardiaGO', code: 'LGG' })
})

describe('tarjetas', () => {
  it('numera de forma correlativa por proyecto y nacen en Backlog', async () => {
    const a = await newCard('Primera')
    const b = await newCard('Segunda', { labels: ['DIR-TEC', ' DIR-TEC ', ''] })
    expect(a.status).toBe(201)
    expect([a.body.number, b.body.number]).toEqual([1, 2])
    expect(a.body).toMatchObject({ column: 'backlog', createdBy: 'Mario', archived: false })
    expect(b.body.labels).toEqual(['DIR-TEC'])
    expect(b.body.order > a.body.order).toBe(true)

    await request(app).post('/api/projects').send({ name: 'YALEH', code: 'YLH' })
    const c = await request(app).post('/api/projects/2/cards').send({ title: 'Otra', type: 'bug', priority: 'alta' })
    expect(c.body.number).toBe(1)
  })

  it('mueve, registra historial y actualiza los contadores del proyecto', async () => {
    await newCard('Uno')
    const m = await request(app).post('/api/projects/1/cards/1/move').send({ column: 'en_progreso' })
    expect(m.body.column).toBe('en_progreso')
    const h = await request(app).get('/api/projects/1/cards/1/history')
    expect(h.body.map((e: { action: string }) => e.action)).toEqual(['movida', 'creada'])
    expect(h.body[0]).toMatchObject({ from: 'backlog', to: 'en_progreso', actor: 'Mario' })
    const p = await request(app).get('/api/projects/1')
    expect(p.body.counts.en_progreso).toBe(1)
  })

  it('una devolución de revisión humana exige comentario y lo guarda', async () => {
    await newCard('Uno', { column: 'revision_humano' })
    const bad = await request(app).post('/api/projects/1/cards/1/move').send({ column: 'por_hacer' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toMatch(/comentario/)
    const ok = await request(app).post('/api/projects/1/cards/1/move').send({ column: 'por_hacer', comment: 'Falta el botón QR' })
    expect(ok.status).toBe(200)
    const comments = await request(app).get('/api/projects/1/cards/1/comments')
    expect(comments.body[0]).toMatchObject({ text: 'Falta el botón QR', author: 'Mario' })
  })

  it('Claude llega hasta En revisión humano, nunca a Hecho', () => {
    const cards = createCardsRepo(db)
    cards.create(1, { title: 'X', type: 'tarea', priority: 'baja', column: 'por_hacer' }, 'Mario')
    expect(cards.move(1, 1, { column: 'en_progreso' }, 'claude').column).toBe('en_progreso')
    expect(cards.move(1, 1, { column: 'revision_qa' }, 'claude').column).toBe('revision_qa')
    expect(() => cards.move(1, 1, { column: 'hecho' }, 'claude')).toThrow(/Hecho/)
    // Claude entrega en revisión humana, pero de ahí en adelante decide una persona
    expect(cards.move(1, 1, { column: 'revision_humano' }, 'claude').column).toBe('revision_humano')
    expect(() => cards.move(1, 1, { column: 'por_hacer', comment: 'x' }, 'claude')).toThrow(/decide una persona/)
    expect(() => cards.move(1, 1, { column: 'hecho' }, 'claude')).toThrow(/Hecho/)
    // el humano sí
    expect(cards.move(1, 1, { column: 'hecho' }, 'Mario').column).toBe('hecho')
  })

  it('respeta el orden enviado por el cliente', async () => {
    await newCard('A')
    await newCard('B')
    const a = (await request(app).get('/api/projects/1/cards/1')).body
    // poner B antes que A
    const res = await request(app).post('/api/projects/1/cards/2/move').send({ column: 'backlog', order: '0V' })
    expect(res.body.order < a.order).toBe(true)
    const list = await request(app).get('/api/projects/1/cards')
    expect(list.body.map((c: { number: number }) => c.number)).toEqual([2, 1])
  })

  it('edita, comenta y archiva', async () => {
    await newCard('Uno')
    const e = await request(app).patch('/api/projects/1/cards/1').send({
      title: 'Uno editado', priority: 'alta', acceptance: [{ text: 'Se ve el QR', done: false }], branch: 'feat/qr',
    })
    expect(e.body).toMatchObject({ title: 'Uno editado', priority: 'alta', branch: 'feat/qr' })
    await request(app).post('/api/projects/1/cards/1/comments').send({ text: 'Hola @Rodri' })
    await request(app).patch('/api/projects/1/cards/1').send({ archived: true })
    expect((await request(app).get('/api/projects/1/cards')).body).toEqual([])
    expect((await request(app).get('/api/projects/1/cards?archived=1')).body).toHaveLength(1)
    const act = await request(app).get('/api/projects/1/activity')
    expect(act.body.map((x: { action: string }) => x.action)).toEqual(['archivada', 'comentada', 'editada', 'creada'])
  })

  it('acciones masivas son atómicas', async () => {
    await newCard('A')
    await newCard('B', { column: 'revision_humano' })
    // B es una devolución sin comentario → falla todo el lote
    const bad = await request(app).post('/api/projects/1/cards/bulk').send({ numbers: [1, 2], op: { action: 'move', column: 'por_hacer' } })
    expect(bad.status).toBe(400)
    expect((await request(app).get('/api/projects/1/cards/1')).body.column).toBe('backlog')

    const ok = await request(app).post('/api/projects/1/cards/bulk').send({ numbers: [1, 2], op: { action: 'assign', assignee: 'claude' } })
    expect(ok.body.map((c: { assignee: string }) => c.assignee)).toEqual(['claude', 'claude'])
  })

  it('valida tipo y prioridad', async () => {
    const r = await newCard('X', { type: 'epica' })
    expect(r.status).toBe(400)
    expect((await request(app).get('/api/projects/1/cards/99')).status).toBe(404)
  })
})
