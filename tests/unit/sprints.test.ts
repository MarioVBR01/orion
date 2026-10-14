import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb, type Db } from '../../server/db'
import { createApp } from '../../server/app'
import { createCardsRepo } from '../../server/cards'

let db: Db
let app: ReturnType<typeof createApp>
const api = (path: string) => `/api/projects/1${path}`
const card = (title: string, extra: Record<string, unknown> = {}) =>
  request(app).post(api('/cards')).send({ title, type: 'tarea', priority: 'media', ...extra })

beforeEach(async () => {
  db = openDb(':memory:')
  app = createApp(db)
  await request(app).patch('/api/settings').send({ userName: 'Mario' })
  await request(app).post('/api/projects').send({ name: 'Proyecto de grado SCAL', code: 'SCAL' })
})

describe('sprints', () => {
  it('se numeran, tienen nombre por defecto y validan fechas', async () => {
    const s1 = await request(app).post(api('/sprints')).send({ startDate: '2026-09-14', endDate: '2026-09-28' })
    expect(s1.status).toBe(201)
    expect(s1.body).toMatchObject({ number: 1, name: 'SCAL Sprint 1', status: 'futuro', startDate: '2026-09-14', endDate: '2026-09-28' })
    const s2 = await request(app).post(api('/sprints')).send({})
    expect(s2.body).toMatchObject({ number: 2, startDate: null, endDate: null })

    const bad = await request(app).patch(api(`/sprints/${s2.body.id}`)).send({ startDate: '2026-10-10', endDate: '2026-10-01' })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toMatch(/anterior/)
    const ok = await request(app).patch(api(`/sprints/${s2.body.id}`)).send({ name: 'Sprint de cierre', startDate: '2026-09-29', endDate: '2026-10-12' })
    expect(ok.body).toMatchObject({ name: 'Sprint de cierre', startDate: '2026-09-29' })
  })

  it('solo un sprint activo; iniciar exige fechas', async () => {
    const a = (await request(app).post(api('/sprints')).send({})).body
    const b = (await request(app).post(api('/sprints')).send({ startDate: '2026-09-29', endDate: '2026-10-12' })).body
    const noDates = await request(app).post(api(`/sprints/${a.id}/start`)).send({})
    expect(noDates.body.error).toMatch(/fechas/)
    const started = await request(app).post(api(`/sprints/${a.id}/start`)).send({ startDate: '2026-09-14', endDate: '2026-09-28', goal: 'Base' })
    expect(started.body).toMatchObject({ status: 'activo', goal: 'Base' })
    const second = await request(app).post(api(`/sprints/${b.id}/start`)).send({})
    expect(second.status).toBe(400)
    expect(second.body.error).toMatch(/Ya hay un sprint activo/)
  })

  it('completar mueve lo no terminado al Backlog o a otro sprint, y conserva lo hecho', async () => {
    const s1 = (await request(app).post(api('/sprints')).send({ startDate: '2026-09-14', endDate: '2026-09-28' })).body
    const s2 = (await request(app).post(api('/sprints')).send({})).body
    await card('Hecha', { sprintId: s1.id, column: 'hecho' })
    await card('Pendiente', { sprintId: s1.id })
    await request(app).post(api(`/sprints/${s1.id}/start`)).send({})

    const done = await request(app).post(api(`/sprints/${s1.id}/complete`)).send({ moveTo: s2.id })
    expect(done.body.status).toBe('completado')
    expect((await request(app).get(api('/cards/1'))).body.sprintId).toBe(s1.id)
    expect((await request(app).get(api('/cards/2'))).body.sprintId).toBe(s2.id)
    const hist = (await request(app).get(api('/cards/2/history'))).body
    expect(hist[0]).toMatchObject({ action: 'editada', detail: 'sprint', from: 'SCAL Sprint 1', to: 'SCAL Sprint 2' })

    // no se pueden asignar tarjetas a un sprint completado ni eliminarlo
    expect((await request(app).patch(api('/cards/2')).send({ sprintId: s1.id })).body.error).toMatch(/completado/)
    expect((await request(app).delete(api(`/sprints/${s1.id}`))).status).toBe(400)
  })

  it('eliminar un sprint devuelve sus tarjetas al Backlog; sprint de otro proyecto no vale', async () => {
    const s = (await request(app).post(api('/sprints')).send({})).body
    await card('A', { sprintId: s.id })
    await request(app).post(api('/cards/bulk')).send({ numbers: [1], op: { action: 'sprint', sprintId: null } })
    await request(app).post(api('/cards/bulk')).send({ numbers: [1], op: { action: 'sprint', sprintId: s.id } })
    expect((await request(app).get(api('/cards/1'))).body.sprintId).toBe(s.id)
    expect((await request(app).delete(api(`/sprints/${s.id}`))).status).toBe(204)
    expect((await request(app).get(api('/cards/1'))).body.sprintId).toBeNull()

    await request(app).post('/api/projects').send({ name: 'Otro', code: 'OTR' })
    const foreign = (await request(app).post('/api/projects/2/sprints').send({})).body
    expect((await card('B', { sprintId: foreign.id })).body.error).toMatch(/no existe/)
  })
})

describe('daily con fecha pasada', () => {
  it('la foto del tablero corresponde al final de ese día', async () => {
    const cards = createCardsRepo(db)
    cards.create(1, { title: 'Vieja', type: 'tarea', priority: 'media' }, 'Mario')
    cards.move(1, 1, { column: 'hecho' }, 'Mario')
    // simulamos que la tarjeta se creó el 15/09 y se terminó el 20/09
    const at = (d: string) => new Date(`${d}T15:00:00`).toISOString()
    db.prepare('UPDATE cards SET created_at = ? WHERE number = 1').run(at('2026-09-15'))
    db.prepare("UPDATE history SET at = ? WHERE action = 'creada'").run(at('2026-09-15'))
    db.prepare("UPDATE history SET at = ? WHERE action = 'movida'").run(at('2026-09-20'))

    const d16 = (await request(app).post(api('/dailies')).send({ date: '2026-09-16', entries: [] })).body
    expect(d16.boardSnapshot).toMatchObject({ backlog: 1, hecho: 0 })
    const d21 = (await request(app).post(api('/dailies')).send({ date: '2026-09-21', entries: [] })).body
    expect(d21.boardSnapshot).toMatchObject({ backlog: 0, hecho: 1 })
    const d10 = (await request(app).post(api('/dailies')).send({ date: '2026-09-10', entries: [] })).body
    expect(d10.boardSnapshot).toMatchObject({ backlog: 0, hecho: 0 })
    const act = (await request(app).get(api('/dailies/activity?date=2026-09-21'))).body
    expect(act.moves.map((m: { to: string }) => m.to)).toEqual(['hecho'])
  })
})
