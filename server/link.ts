import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RuleError } from './errors'

export const ORION_CONFIG = '.orion.json'
const START = '<!-- ORION:inicio (sección generada por ORION; se actualiza al volver a preparar la carpeta) -->'
const END = '<!-- ORION:fin -->'

export interface PrepareResult {
  dir: string
  orionJson: 'creado' | 'actualizado' | 'sin cambios'
  claudeMd: 'creado' | 'agregado' | 'actualizado' | 'sin cambios'
  settings: 'creado' | 'actualizado' | 'sin cambios'
  verify: string[]
}

export function assertDirectory(dir: string) {
  if (!dir.trim()) throw new RuleError('Indica la carpeta del proyecto.')
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new RuleError(`La carpeta no existe: ${dir}`)
}

/** Comandos de verificación (QA) según los scripts del package.json del proyecto. */
export function detectVerifyCommands(dir: string): string[] {
  const pkgFile = join(dir, 'package.json')
  if (!existsSync(pkgFile)) return []
  try {
    const scripts = (JSON.parse(readFileSync(pkgFile, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {}
    const cmds: string[] = []
    if (scripts.test) cmds.push('npm test')
    if (scripts.typecheck) cmds.push('npm run typecheck')
    if (scripts.lint) cmds.push('npm run lint')
    if (!scripts.typecheck && scripts.build) cmds.push('npm run build')
    return cmds
  } catch {
    return []
  }
}

/** Sección de CLAUDE.md con el flujo de trabajo del tablero. */
export function claudeMdSection(project: { code: string; name: string }, verify: string[]): string {
  const verifyText = verify.length ? verify.map((c) => `\`${c}\``).join(', ') : 'las pruebas del proyecto (si las hay) y revisa el cambio'
  return `${START}
## Tablero ORION (proyecto ${project.code} · ${project.name})

Este proyecto se gestiona en el tablero ORION. Trabajas sus tarjetas con el comando \`orion\` (ver \`orion ayuda\`).
Flujo: Backlog → Por hacer → En progreso → En revisión QA → **En revisión humano** (ahí terminas tú).
Una persona prueba la aplicación y mueve a Hecho o reporta nuevos errores. **Tú nunca mueves a Hecho.**

Cuando te pidan "trabaja el backlog de ORION" (o "toma la siguiente tarjeta"), repite para cada tarjeta:

1. \`orion siguiente\`: toma la tarjeta (pasa a Por hacer → En progreso y queda asignada a ti).
   Lee todo: descripción, criterios, comentarios, y abre las imágenes (\`orion ver <N>\` muestra sus rutas).
   - Si falta información para hacerla bien, no adivines: \`orion bloquear <N> -c "qué falta"\` y sigue con la siguiente.
2. Implementa **solo** lo que pide la tarjeta, en la rama actual (no crees ramas ni hagas push).
3. Haz **un commit por tarjeta** con el mensaje \`<tipo>: <resumen> (ORION #<N>)\` (tipo: fix, feat, refactor…)
   y regístralo: \`orion trabajo <N> --commit <sha corto> --rama <rama actual>\`.
4. \`orion qa <N> -c "qué cambiaste y archivos clave"\`: pasa a En revisión QA.
5. Verificación (QA): ejecuta ${verifyText}. Revisa cada criterio de aceptación y márcalo con \`orion criterio <N> <i>\`.
   - Si algo falla, corrige, actualiza el mismo commit (\`git commit --amend\`), vuelve a registrar el sha y verifica de nuevo.
6. \`orion entregar <N> -c "qué se verificó y cómo probarlo en la app, paso a paso"\`: pasa a En revisión humano.
7. Continúa con la siguiente hasta que \`orion siguiente\` diga que no hay más o te pidan parar.
   Al final, resume qué tarjetas entregaste, cuáles bloqueaste y por qué.

Reglas: no toques tarjetas en "En revisión humano" ni en "Hecho"; no hagas \`git push\` salvo que te lo pidan;
responde y comenta en español.
${END}
`
}

/** Permisos que Claude Code necesita para trabajar el tablero sin pedir confirmación en cada paso. */
export function permissionRules(verify: string[]): string[] {
  return [
    'Bash(orion:*)',
    ...verify.map((c) => `Bash(${c}:*)`),
    'Bash(git status:*)',
    'Bash(git diff:*)',
    'Bash(git log:*)',
    'Bash(git add:*)',
    'Bash(git commit:*)',
    'Bash(git rev-parse:*)',
  ]
}

/** Vincula la carpeta con el proyecto y la deja lista para que Claude Code trabaje el tablero. */
export function prepareRepo(dir: string, project: { code: string; name: string }): PrepareResult {
  assertDirectory(dir)
  const verify = detectVerifyCommands(dir)

  // .orion.json
  const cfgFile = join(dir, ORION_CONFIG)
  const cfg = JSON.stringify({ proyecto: project.code }, null, 2) + '\n'
  const prevCfg = existsSync(cfgFile) ? readFileSync(cfgFile, 'utf8') : null
  if (prevCfg !== cfg) writeFileSync(cfgFile, cfg)
  const orionJson = prevCfg === null ? 'creado' : prevCfg === cfg ? 'sin cambios' : 'actualizado'

  // CLAUDE.md: reemplaza solo la sección entre marcas
  const mdFile = join(dir, 'CLAUDE.md')
  const section = claudeMdSection(project, verify)
  let claudeMd: PrepareResult['claudeMd']
  if (!existsSync(mdFile)) {
    writeFileSync(mdFile, `# ${project.name}\n\n${section}`)
    claudeMd = 'creado'
  } else {
    const current = readFileSync(mdFile, 'utf8')
    const eol = current.includes('\r\n') ? '\r\n' : '\n'
    const sectionEol = section.replace(/\n/g, eol)
    const s = current.indexOf(START)
    const e = current.indexOf(END)
    if (s >= 0 && e > s) {
      const next = current.slice(0, s) + sectionEol.trimEnd() + current.slice(e + END.length)
      claudeMd = next === current ? 'sin cambios' : 'actualizado'
      if (next !== current) writeFileSync(mdFile, next)
    } else {
      const sep = current.endsWith(eol) ? eol : eol + eol
      writeFileSync(mdFile, current + sep + sectionEol)
      claudeMd = 'agregado'
    }
  }

  // .claude/settings.json: agrega permisos sin borrar los existentes
  const settingsDir = join(dir, '.claude')
  const settingsFile = join(settingsDir, 'settings.json')
  let data: { permissions?: { allow?: string[] } } & Record<string, unknown> = {}
  const existed = existsSync(settingsFile)
  if (existed) {
    try {
      data = JSON.parse(readFileSync(settingsFile, 'utf8')) as typeof data
    } catch {
      throw new RuleError(`No pude leer ${settingsFile}: no es JSON válido. Corrígelo y vuelve a intentar.`)
    }
  }
  const allow = new Set(data.permissions?.allow ?? [])
  const before = allow.size
  for (const r of permissionRules(verify)) allow.add(r)
  let settings: PrepareResult['settings'] = 'sin cambios'
  if (!existed || allow.size !== before) {
    data.permissions = { ...(data.permissions ?? {}), allow: [...allow] }
    mkdirSync(settingsDir, { recursive: true })
    writeFileSync(settingsFile, JSON.stringify(data, null, 2) + '\n')
    settings = existed ? 'actualizado' : 'creado'
  }

  return { dir, orionJson, claudeMd, settings, verify }
}
