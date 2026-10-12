import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb } from '../../server/db'
import { createApp } from '../../server/app'
import { attachmentPath } from '../../server/uploads'

let app: ReturnType<typeof createApp>
let uploadsDir: string

const description = 'Cuando la carrera está finalizada debe aparecer el botón de pago QR; no debe verse al inicio.'
const newObs = (extra: Record<string, unknown> = {}) =>
  request(app).post('/api/projects/1/observations').send({ channel: 'clientes', kind: 'bug', title: 'APP-FLUJO CARRERA-QR', description, ...extra })

beforeEach(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), 'orion-up-'))
  app = createApp(openDb(':memory:'), { uploadsDir })
  await request(app).patch('/api/settings').send({ userName: 'Mario' })
  await request(app).post('/api/projects').send({ name: 'LaGuardiaGO', code: 'LGG' })
})

afterEach(() => rmSync(uploadsDir, { recursive: true, force: true }))

describe('observaciones', () => {
  it('se crean con remitente, numeración propia y quedan pendientes', async () => {
    const a = await newObs({ sender: 'Rodri BC' })
    expect(a.status).toBe(201)
    expect(a.body).toMatchObject({ number: 1, status: 'pendiente', sender: 'Rodri BC', channel: 'clientes' })
    const b = await newObs({ channel: 'testers' })
    expect(b.body).toMatchObject({ number: 2, sender: 'Mario' })
    expect((await request(app).get('/api/projects/1/observations/counts')).body).toEqual({ clientes: 1, testers: 1 })
    const list = await request(app).get('/api/projects/1/observations?channel=testers')
    expect(list.body.map((o: { number: number }) => o.number)).toEqual([2])
  })

  it('exige título y descripción', async () => {
    const r = await newObs({ description: '   ' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/Describe/)
    expect((await newObs({ title: '' })).status).toBe(400)
  })

  it('al pasar al Backlog se convierte en tarjeta con el reporte, autor y adjuntos', async () => {
    const up = await request(app)
      .post('/api/projects/1/uploads')
      .set('Content-Type', 'image/png')
      .set('X-Filename', encodeURIComponent('captura móvil.png'))
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    expect(up.status).toBe(201)
    expect(existsSync(attachmentPath(uploadsDir, up.body.url)!)).toBe(true)

    await newObs({ sender: 'Rodri BC', attachments: [up.body] })
    await newObs({ kind: 'mejora', title: 'Métodos de pago visibles' })
    const res = await request(app).post('/api/projects/1/observations/to-backlog').send({ numbers: [1, 2], priority: 'alta', labels: ['App pasajero'] })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    const [c1, c2] = res.body
    expect(c1).toMatchObject({ number: 1, column: 'backlog', type: 'bug', priority: 'alta', createdBy: 'Rodri BC', labels: ['App pasajero'], sourceObservationIds: [1] })
    expect(c1.report).toBeNull()
    expect(c1.descriptionMd).toBe(description)
    expect(c1.attachments[0].url).toBe(up.body.url)
    expect(c1.attachments[0].name).toBe('captura m_vil.png')
    expect(c2.type).toBe('historia')

    const o1 = (await request(app).get('/api/projects/1/observations/1')).body
    expect(o1).toMatchObject({ status: 'en_backlog', cardNumber: 1 })
    // no se puede pasar dos veces
    const again = await request(app).post('/api/projects/1/observations/to-backlog').send({ numbers: [1] })
    expect(again.status).toBe(400)
    expect(again.body.error).toMatch(/ya está en el Backlog/)
    // historial de la tarjeta muestra al usuario como quien la creó en Backlog
    const hist = await request(app).get('/api/projects/1/cards/1/history')
    expect(hist.body[0]).toMatchObject({ action: 'creada', actor: 'Mario', to: 'backlog' })
  })

  it('el lote es atómico', async () => {
    await newObs()
    await newObs()
    await request(app).post('/api/projects/1/observations/reject').send({ numbers: [2], reason: 'Duplicada' })
    const r = await request(app).post('/api/projects/1/observations/to-backlog').send({ numbers: [1, 2] })
    expect(r.status).toBe(400)
    expect((await request(app).get('/api/projects/1/cards')).body).toEqual([])
    expect((await request(app).get('/api/projects/1/observations/1')).body.status).toBe('pendiente')
  })

  it('rechazar exige motivo; pedir info y editar vuelve a pendiente; reabrir', async () => {
    await newObs()
    expect((await request(app).post('/api/projects/1/observations/reject').send({ numbers: [1], reason: '' })).status).toBe(400)
    const info = await request(app).post('/api/projects/1/observations/1/request-info').send({ question: '¿En qué celular?' })
    expect(info.body).toMatchObject({ status: 'info', statusNote: '¿En qué celular?' })
    const edited = await request(app).patch('/api/projects/1/observations/1').send({ title: 'APP-FLUJO QR (Samsung A10)' })
    expect(edited.body).toMatchObject({ status: 'pendiente', title: 'APP-FLUJO QR (Samsung A10)' })
    await request(app).post('/api/projects/1/observations/reject').send({ numbers: [1], reason: 'No reproducible' })
    expect((await request(app).post('/api/projects/1/observations/1/reopen')).body.status).toBe('pendiente')
    const comments = (await request(app).get('/api/projects/1/observations/1/comments')).body
    expect(comments.map((c: { text: string }) => c.text)).toEqual([
      'Se pidió más información: ¿En qué celular?',
      'Rechazada: No reproducible',
      'Reabierta.',
    ])
  })

  it('rechaza archivos no permitidos y adjuntos inexistentes dan 404', async () => {
    const r = await request(app).post('/api/projects/1/uploads').set('Content-Type', 'application/x-msdownload').send(Buffer.from('MZ'))
    expect(r.status).toBe(400)
    expect((await request(app).get('/uploads/1/nada.png')).status).toBe(404)
  })
})
