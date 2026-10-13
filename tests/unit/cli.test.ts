import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../../server/db'
import { createRepo } from '../../server/repo'
import { createCardsRepo } from '../../server/cards'

const BIN = resolve(import.meta.dirname, '../../bin/orion.mjs')
let dir: string
let repoDir: string
let dbFile: string

function orion(...args: string[]) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd: repoDir,
    env: { ...process.env, ORION_DB: dbFile, ORION_PROYECTO: '' },
    encoding: 'utf8',
  })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'orion-cli-'))
  repoDir = mkdtempSync(join(tmpdir(), 'orion-repo-'))
  dbFile = join(dir, 'orion.db')
  const db = openDb(dbFile)
  const repo = createRepo(db)
  const cards = createCardsRepo(db)
  repo.createProject({ name: 'LaGuardiaGO', code: 'LGG', description: '', color: '#2563EB' })
  repo.createProject({ name: 'YALEH', code: 'YLH', description: '', color: '#2563EB' })
  cards.create(1, { title: 'Backlog A', type: 'tarea', priority: 'baja' }, 'Mario')
  cards.create(
    1,
    {
      title: 'Botón QR solo al final',
      type: 'bug',
      priority: 'alta',
      report: { where: 'Pantalla de carrera', steps: ['Pedir móvil'], expected: 'QR al final', actual: 'QR al inicio' },
      acceptance: [{ text: 'QR oculto durante la carrera', done: false }],
    },
    'Mario',
  )
  cards.create(1, { title: 'De otra persona', type: 'tarea', priority: 'alta', column: 'por_hacer', assignee: 'Leonel' }, 'Mario')
  db.close()
}, 30000)

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(repoDir, { recursive: true, force: true })
})

describe('comando orion', () => {
  it('pide el proyecto si hay varios y lo vincula con init', () => {
    const r = orion('tablero')
    expect(r.code).toBe(1)
    expect(r.err).toMatch(/orion init/)
    const init = orion('init', 'lgg', '--claude-md')
    expect(init.code).toBe(0)
    expect(JSON.parse(readFileSync(join(repoDir, '.orion.json'), 'utf8'))).toEqual({ proyecto: 'LGG' })
    expect(readFileSync(join(repoDir, 'CLAUDE.md'), 'utf8')).toContain('## Tablero ORION')
    // segunda vez no duplica
    orion('init', 'LGG', '--claude-md')
    expect(readFileSync(join(repoDir, 'CLAUDE.md'), 'utf8').match(/## Tablero ORION/g)).toHaveLength(1)
  }, 30000)

  it('siguiente toma del Backlog en orden, salta tarjetas de otras personas', () => {
    const peek = orion('siguiente', '--ver')
    expect(peek.out).toMatch(/^#1 Backlog A/)
    // el usuario prioriza moviendo #2 a Por hacer → pasa primero
    expect(orion('mover', '2', 'por-hacer', '--como', 'Mario').code).toBe(0)
    const r = orion('siguiente')
    expect(r.code).toBe(0)
    expect(r.out).toContain('Tomaste la tarjeta')
    expect(r.out).toContain('#2 Botón QR solo al final')
    expect(r.out).toContain('¿Qué pasó?\n  QR al inicio')
    expect(r.out).toContain('1. [ ] QR oculto durante la carrera')
    const card = JSON.parse(orion('ver', '#2', '--json').out)
    expect(card).toMatchObject({ column: 'en_progreso', assignee: 'claude' })
  }, 30000)

  it('flujo completo: qa, criterio, trabajo, entregar; nunca Hecho', () => {
    // entregar exige pasar antes por QA
    expect(orion('entregar', '2', '-c', 'x').err).toMatch(/primero pásala a QA/)
    expect(orion('qa', '2').code).toBe(1) // sin resumen
    expect(orion('qa', '2', '-c', 'Oculté el botón QR hasta finalizar la carrera').out).toMatch(/En revisión QA/)
    expect(orion('criterio', '2', '1').out).toMatch(/cumplido/)
    expect(orion('trabajo', '2', '--rama', 'v1-yaleh', '--commit', 'a1b2c3').code).toBe(0)
    const e = orion('entregar', '2', '-c', 'npm test OK. Probar: iniciar una carrera y finalizarla')
    expect(e.out).toMatch(/En revisión humano/)
    // desde revisión humana decide una persona
    expect(orion('mover', '2', 'hecho').err).toMatch(/Hecho/)
    expect(orion('bloquear', '2', '-c', 'x').err).toMatch(/decide una persona/)
    const card = JSON.parse(orion('ver', '2', '--json').out)
    expect(card).toMatchObject({ column: 'revision_humano', branch: 'v1-yaleh', commitSha: 'a1b2c3' })
    expect(card.acceptance[0].done).toBe(true)
    expect(card.comments.map((c: { text: string }) => c.text)).toEqual([
      'QA · Oculté el botón QR hasta finalizar la carrera',
      'Entregada para revisión humana · npm test OK. Probar: iniciar una carrera y finalizarla',
    ])
  }, 30000)

  it('siguiente recorre Por hacer antes de En progreso; bloquear devuelve con la pregunta', () => {
    const r = orion('siguiente') // #1 sigue en Backlog
    expect(r.out).toContain('Tomaste la tarjeta #1')
    expect(JSON.parse(orion('ver', '1', '--json').out).column).toBe('en_progreso')
    const b = orion('bloquear', '1', '-c', '¿En qué pantalla aplica?')
    expect(b.out).toMatch(/Por hacer/)
    expect(JSON.parse(orion('ver', '1', '--json').out).comments.at(-1).text).toBe('Bloqueada · ¿En qué pantalla aplica?')
  }, 30000)

  it('errores claros', () => {
    expect(orion('ver', 'abc').err).toMatch(/inválido/)
    expect(orion('mover', '1', 'cualquiera').err).toMatch(/Columna desconocida/)
    expect(orion('ver', '99').err).toMatch(/no existe/)
    expect(orion('ayuda').out).toContain('orion siguiente')
    expect(existsSync(join(repoDir, '.orion.json'))).toBe(true)
  }, 30000)
})
