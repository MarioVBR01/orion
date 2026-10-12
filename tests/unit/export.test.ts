import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { openDb } from '../../server/db'
import { createApp } from '../../server/app'

let app: ReturnType<typeof createApp>
let uploadsDir: string

beforeEach(async () => {
  uploadsDir = mkdtempSync(join(tmpdir(), 'orion-exp-'))
  app = createApp(openDb(':memory:'), { uploadsDir })
  await request(app).patch('/api/settings').send({ userName: 'Mario' })
  await request(app)
    .post('/api/projects')
    .send({ name: 'LaGuardiaGO', code: 'LGG', aiInstructions: 'Repo: laguardiago-app (React Native). Usa ramas fix/<n>.' })
})
afterEach(() => rmSync(uploadsDir, { recursive: true, force: true }))

const exportMd = (body: Record<string, unknown>) => request(app).post('/api/projects/1/cards/export').send(body)

describe('exportar tarjetas a .md', () => {
  it('arma el .md con instrucciones del proyecto, flujo de estados y detalle de cada tarea', async () => {
    const up = await request(app).post('/api/projects/1/uploads').set('Content-Type', 'image/png').set('X-Filename', 'qr.png').send(Buffer.from([1, 2, 3]))
    await request(app)
      .post('/api/projects/1/observations')
      .send({ channel: 'clientes', kind: 'bug', title: 'Botón QR al final', description: 'El QR se ve desde el inicio.', sender: 'Rodri BC', attachments: [up.body] })
    await request(app).post('/api/projects/1/observations/to-backlog').send({ numbers: [1], priority: 'alta', labels: ['App pasajero'] })
    await request(app).post('/api/projects/1/cards').send({ title: 'Segunda', type: 'tarea', priority: 'baja', descriptionMd: 'Algo más' })
    await request(app).patch('/api/projects/1/cards/2').send({ acceptance: [{ text: 'Se ve bien', done: false }] })
    await request(app).post('/api/projects/1/cards/1/comments').send({ text: 'Probar en Android 10' })

    const r = await exportMd({ numbers: [2, 1] })
    expect(r.status).toBe(200)
    expect(r.body.filename).toMatch(/^LGG-tareas-\d{4}-\d{2}-\d{2}\.md$/)
    const md: string = r.body.markdown
    expect(md).toContain('# Tareas para Claude · LaGuardiaGO (LGG)')
    expect(md).toContain('## Instrucciones del proyecto\n\nRepo: laguardiago-app (React Native). Usa ramas fix/<n>.')
    expect(md).toContain('`▶ #N → En progreso`')
    expect(md).toContain('`✅ #N → En revisión QA`')
    expect(md).toContain('Nunca indiques **Hecho**')
    // orden del tablero (ambas en Backlog: #1 primero)
    expect(md.indexOf('Tarea 1 de 2 · #1 · Botón QR al final')).toBeGreaterThan(0)
    expect(md.indexOf('Tarea 2 de 2 · #2 · Segunda')).toBeGreaterThan(md.indexOf('#1 · Botón QR'))
    expect(md).toContain('**Prioridad:** Alta')
    expect(md).toContain('**Reportado por:** Rodri BC')
    expect(md).toContain('### Descripción\n\nEl QR se ve desde el inicio.')
    expect(md).toContain(join(uploadsDir, '1'))
    expect(md).toContain('- [ ] Se ve bien')
    expect(md).toContain('**Mario:**\n> Probar en Android 10')
    expect(md).toContain('| #1 | En revisión QA / Por hacer | … |')
  })

  it('una sola tarjeta usa el nombre LGG-N.md y sin tabla final', async () => {
    await request(app).post('/api/projects/1/cards').send({ title: 'Única', type: 'bug', priority: 'media' })
    const r = await exportMd({ numbers: [1] })
    expect(r.body.filename).toBe('LGG-1.md')
    expect(r.body.markdown).toContain('## #1 · Única')
    expect(r.body.markdown).toContain('Sin descripción: pregunta antes de implementar')
    expect(r.body.markdown).not.toContain('tabla final')
  })

  it('la vista previa no cambia nada; marcar registra historial y puede mover', async () => {
    await request(app).post('/api/projects/1/cards').send({ title: 'Única', type: 'bug', priority: 'media' })
    await exportMd({ numbers: [1] })
    expect((await request(app).get('/api/projects/1/cards/1')).body.exportedAt).toBeNull()

    await exportMd({ numbers: [1], mark: true, moveTo: 'por_hacer' })
    const card = (await request(app).get('/api/projects/1/cards/1')).body
    expect(card.exportedAt).not.toBeNull()
    expect(card.column).toBe('por_hacer')
    const hist = (await request(app).get('/api/projects/1/cards/1/history')).body
    expect(hist.map((h: { action: string }) => h.action)).toEqual(['movida', 'exportada', 'creada'])
    expect(hist[1].detail).toBe('LGG-1.md')
  })

  it('sin instrucciones del proyecto omite esa sección; tarjeta inexistente es 404', async () => {
    await request(app).patch('/api/projects/1').send({ aiInstructions: '' })
    await request(app).post('/api/projects/1/cards').send({ title: 'X', type: 'tarea', priority: 'baja' })
    expect((await exportMd({ numbers: [1] })).body.markdown).not.toContain('Instrucciones del proyecto')
    expect((await exportMd({ numbers: [9] })).status).toBe(404)
  })
})
