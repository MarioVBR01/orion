import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb } from '../../server/db'
import { createApp } from '../../server/app'

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp(openDb(':memory:'))
})

describe('API de proyectos', () => {
  it('crea, lista y numera proyectos', async () => {
    const a = await request(app).post('/api/projects').send({ name: 'LaGuardiaGO', code: 'lgg', description: '', color: '#2563EB' })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ id: 1, name: 'LaGuardiaGO', code: 'LGG', favorite: false })
    expect(a.body.counts).toEqual({ backlog: 0, por_hacer: 0, en_progreso: 0, revision_qa: 0, revision_humano: 0, hecho: 0 })

    const b = await request(app).post('/api/projects').send({ name: 'YALEH', code: 'YLH' })
    expect(b.body.id).toBe(2)

    const list = await request(app).get('/api/projects')
    expect(list.body.map((p: { name: string }) => p.name)).toEqual(['LaGuardiaGO', 'YALEH'])
  })

  it('valida la entrada', async () => {
    const r = await request(app).post('/api/projects').send({ name: '', code: 'x' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/nombre/i)
  })

  it('favoritos primero y archivados ocultos', async () => {
    await request(app).post('/api/projects').send({ name: 'A', code: 'AA' })
    await request(app).post('/api/projects').send({ name: 'B', code: 'BB' })
    await request(app).post('/api/projects').send({ name: 'C', code: 'CC' })
    await request(app).patch('/api/projects/2').send({ favorite: true })
    await request(app).patch('/api/projects/3').send({ archived: true })
    const list = await request(app).get('/api/projects')
    expect(list.body.map((p: { name: string }) => p.name)).toEqual(['B', 'A'])
  })

  it('404 para proyectos inexistentes', async () => {
    expect((await request(app).get('/api/projects/99')).status).toBe(404)
    expect((await request(app).get('/api/projects/abc')).status).toBe(404)
  })
})

describe('API de personas y ajustes', () => {
  it('agrega, cambia y quita personas', async () => {
    await request(app).post('/api/projects').send({ name: 'LaGuardiaGO', code: 'LGG' })
    const p = await request(app).post('/api/projects/1/people').send({ name: 'Rodri BC', email: '', role: 'cliente' })
    expect(p.status).toBe(201)
    const upd = await request(app).patch(`/api/projects/1/people/${p.body.id}`).send({ role: 'tester' })
    expect(upd.body.role).toBe('tester')
    const proj = await request(app).get('/api/projects/1')
    expect(proj.body.people).toEqual([{ id: p.body.id, name: 'Rodri BC' }])
    expect((await request(app).delete(`/api/projects/1/people/${p.body.id}`)).status).toBe(204)
    expect((await request(app).get('/api/projects/1/people')).body).toEqual([])
  })

  it('rechaza roles inválidos', async () => {
    await request(app).post('/api/projects').send({ name: 'X', code: 'XX' })
    const r = await request(app).post('/api/projects/1/people').send({ name: 'Y', role: 'jefe' })
    expect(r.status).toBe(400)
  })

  it('guarda el nombre del usuario', async () => {
    expect((await request(app).get('/api/settings')).body).toEqual({ userName: 'Yo' })
    const r = await request(app).patch('/api/settings').send({ userName: 'Mario Victor' })
    expect(r.body.userName).toBe('Mario Victor')
  })
})
