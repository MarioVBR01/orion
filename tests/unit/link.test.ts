import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectVerifyCommands, prepareRepo } from '../../server/link'

let dir: string
const project = { code: 'YLH', name: 'YALEH' }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'orion-link-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'vitest', typecheck: 'tsc', build: 'vite build' } }))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('preparar carpeta del proyecto', () => {
  it('detecta los comandos de verificación', () => {
    expect(detectVerifyCommands(dir)).toEqual(['npm test', 'npm run typecheck'])
  })

  it('agrega la sección sin tocar el CLAUDE.md existente y respeta CRLF', () => {
    writeFileSync(join(dir, 'CLAUDE.md'), '# YALEH\r\n\r\nReglas propias del proyecto.\r\n')
    const r = prepareRepo(dir, project)
    expect(r).toMatchObject({ orionJson: 'creado', claudeMd: 'agregado', settings: 'creado', verify: ['npm test', 'npm run typecheck'] })
    const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
    expect(md.startsWith('# YALEH\r\n\r\nReglas propias del proyecto.\r\n')).toBe(true)
    expect(md).toContain('## Tablero ORION (proyecto YLH · YALEH)')
    expect(md).toContain('ejecuta `npm test`, `npm run typecheck`')
    expect(/[^\r]\n/.test(md)).toBe(false)
    expect(JSON.parse(readFileSync(join(dir, '.orion.json'), 'utf8'))).toEqual({ proyecto: 'YLH' })
  })

  it('volver a preparar no duplica y actualiza solo la sección', () => {
    writeFileSync(join(dir, 'CLAUDE.md'), '# YALEH\n\nAntes.\n')
    prepareRepo(dir, project)
    writeFileSync(join(dir, 'CLAUDE.md'), readFileSync(join(dir, 'CLAUDE.md'), 'utf8') + '\nDespués.\n')
    expect(prepareRepo(dir, project)).toMatchObject({ orionJson: 'sin cambios', claudeMd: 'sin cambios', settings: 'sin cambios' })
    expect(prepareRepo(dir, { code: 'YLH', name: 'YALEH v2' }).claudeMd).toBe('actualizado')
    const md = readFileSync(join(dir, 'CLAUDE.md'), 'utf8')
    expect(md.match(/## Tablero ORION/g)).toHaveLength(1)
    expect(md).toContain('YALEH v2')
    expect(md).toContain('Antes.')
    expect(md).toContain('Después.')
  })

  it('combina permisos con un settings.json existente', () => {
    mkdirSync(join(dir, '.claude'))
    writeFileSync(join(dir, '.claude', 'settings.json'), JSON.stringify({ model: 'x', permissions: { allow: ['Bash(ls:*)'], deny: ['Bash(rm:*)'] } }))
    expect(prepareRepo(dir, project).settings).toBe('actualizado')
    const s = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'))
    expect(s.model).toBe('x')
    expect(s.permissions.deny).toEqual(['Bash(rm:*)'])
    expect(s.permissions.allow).toEqual(expect.arrayContaining(['Bash(ls:*)', 'Bash(orion:*)', 'Bash(npm test:*)', 'Bash(git commit:*)']))
  })

  it('rechaza carpetas inexistentes', () => {
    expect(() => prepareRepo(join(dir, 'no-existe'), project)).toThrow(/no existe/)
  })
})
