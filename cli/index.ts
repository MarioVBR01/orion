/**
 * `orion`: comando para que Claude Code (o tú) trabaje las tarjetas del tablero desde la terminal.
 * Usa la misma base de datos y las mismas reglas que la web (server/), así que lo que hace aquí
 * aparece en vivo en el tablero.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { openDb } from '../server/db'
import { createRepo } from '../server/repo'
import { createCardsRepo } from '../server/cards'
import { attachmentPath } from '../server/uploads'
import { columnName } from '../shared/flow'
import { CLAUDE, COLUMN_IDS, PRIORITY_LABEL, TYPE_LABEL, type Card, type ColumnId, type Project } from '../shared/types'
import { ORION_CONFIG, prepareRepo } from '../server/link'
import { HELP } from './texts'

const ROOT = resolve(import.meta.dirname, '..')
const DB_FILE = process.env.ORION_DB ?? join(ROOT, 'data', 'orion.db')
const UPLOADS = process.env.ORION_UPLOADS ?? join(dirname(DB_FILE), 'uploads')
const CONFIG = ORION_CONFIG

class CliError extends Error {}

// ---------- argumentos ----------
interface Args {
  cmd: string
  pos: string[]
  flags: Record<string, string | true>
}

/** Flags con valor (el resto son booleanos). */
const VALUE_FLAGS = new Set(['proyecto', 'p', 'columna', 'asignado', 'c', 'comentario', 'rama', 'commit', 'pr', 'como'])

function parse(argv: string[]): Args {
  const pos: string[] = []
  const flags: Record<string, string | true> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const m = /^--?([\w-]+)(?:=(.*))?$/.exec(a)
    if (m && !/^-\d/.test(a)) {
      const key = m[1]!
      if (m[2] !== undefined) flags[key] = m[2]
      else if (VALUE_FLAGS.has(key) && i + 1 < argv.length) flags[key] = argv[++i]!
      else flags[key] = true
    } else pos.push(a)
  }
  return { cmd: pos.shift() ?? 'ayuda', pos, flags }
}

const str = (v: string | true | undefined) => (typeof v === 'string' ? v : undefined)

// ---------- columnas ----------
const COLUMN_ALIASES: Record<string, ColumnId> = {
  backlog: 'backlog',
  'por-hacer': 'por_hacer',
  por_hacer: 'por_hacer',
  porhacer: 'por_hacer',
  todo: 'por_hacer',
  progreso: 'en_progreso',
  'en-progreso': 'en_progreso',
  en_progreso: 'en_progreso',
  qa: 'revision_qa',
  'revision-qa': 'revision_qa',
  revision_qa: 'revision_qa',
  humano: 'revision_humano',
  'revision-humano': 'revision_humano',
  revision_humano: 'revision_humano',
  hecho: 'hecho',
}

function parseColumn(s: string | undefined): ColumnId {
  const c = s ? COLUMN_ALIASES[s.toLowerCase()] : undefined
  if (!c) throw new CliError(`Columna desconocida "${s ?? ''}". Usa: backlog, por-hacer, progreso, qa, humano, hecho.`)
  return c
}

function parseNumber(s: string | undefined): number {
  const n = Number((s ?? '').replace(/^#/, ''))
  if (!Number.isInteger(n) || n <= 0) throw new CliError(`Número de tarjeta inválido: "${s ?? ''}". Ej.: orion ver 12`)
  return n
}

// ---------- proyecto ----------
function findConfig(from: string): string | null {
  let dir = from
  for (;;) {
    const f = join(dir, CONFIG)
    if (existsSync(f)) return f
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}

const normalizePath = (p: string) => resolve(p).replace(/[\\/]+$/, '').toLowerCase()

function resolveProject(projects: Project[], flags: Args['flags']): Project {
  let wanted = str(flags.proyecto) ?? str(flags.p) ?? process.env.ORION_PROYECTO
  if (!wanted) {
    const cfg = findConfig(process.cwd())
    if (cfg) wanted = (JSON.parse(readFileSync(cfg, 'utf8')) as { proyecto?: string }).proyecto
  }
  if (!wanted) {
    // carpeta vinculada desde ORION (campo "Carpeta del proyecto")
    const cwd = normalizePath(process.cwd())
    const linked = projects.find((p) => {
      const root = p.repoPath ? normalizePath(p.repoPath) : ''
      return root && (cwd === root || cwd.startsWith(`${root}${sep}`))
    })
    if (linked) return linked
    if (projects.length === 1) return projects[0]!
    throw new CliError(
      `Indica el proyecto con --proyecto <CÓDIGO> o ejecuta "orion init <CÓDIGO>" en el repo.\nProyectos: ${projects.map((p) => `${p.code} (${p.name})`).join(', ') || 'ninguno'}`,
    )
  }
  const p = projects.find((x) => x.code.toLowerCase() === wanted!.toLowerCase() || String(x.id) === wanted)
  if (!p) throw new CliError(`No existe el proyecto "${wanted}". Proyectos: ${projects.map((x) => x.code).join(', ')}`)
  return p
}

// ---------- salida ----------
const line = (c: Card) =>
  `#${c.number} [${TYPE_LABEL[c.type]}] ${c.title} · prioridad ${PRIORITY_LABEL[c.priority].toLowerCase()}${c.assignee ? ` · @${c.assignee}` : ''}`

function detail(c: Card, comments: Array<{ author: string; text: string; createdAt: string }>): string {
  const out: string[] = []
  out.push(`#${c.number} ${c.title}`)
  out.push(`Tipo: ${TYPE_LABEL[c.type]} · Prioridad: ${PRIORITY_LABEL[c.priority]} · Columna: ${columnName(c.column)}`)
  if (c.labels.length) out.push(`Etiquetas: ${c.labels.join(', ')}`)
  out.push(`Asignado: ${c.assignee ?? 'nadie'} · Reportado por: ${c.createdBy}`)
  if (c.report) {
    out.push('', '¿Dónde?', `  ${c.report.where || '—'}`, '¿Qué hice?')
    c.report.steps.forEach((s, i) => out.push(`  ${i + 1}. ${s}`))
    out.push('¿Qué esperaba?', `  ${c.report.expected || '—'}`, '¿Qué pasó?', `  ${c.report.actual || '—'}`)
  }
  if (c.descriptionMd.trim() && !c.report) out.push('', 'Descripción:', c.descriptionMd.trim())
  if (c.acceptance.length) {
    out.push('', 'Criterios de aceptación:')
    c.acceptance.forEach((a, i) => out.push(`  ${i + 1}. [${a.done ? 'x' : ' '}] ${a.text}`))
  }
  if (c.attachments.length) {
    out.push('', 'Adjuntos (puedes abrir las imágenes con tu herramienta de lectura):')
    for (const a of c.attachments) out.push(`  - ${a.name}: ${attachmentPath(UPLOADS, a.url) ?? a.url}`)
  }
  if (c.branch || c.commitSha || c.prUrl) {
    out.push('', `Trabajo: rama ${c.branch ?? '—'} · commit ${c.commitSha ?? '—'} · PR ${c.prUrl ?? '—'}`)
  }
  if (comments.length) {
    out.push('', 'Comentarios:')
    for (const k of comments) out.push(`  ${k.author}: ${k.text}`)
  }
  return out.join('\n')
}

/** Siguiente tarjeta a trabajar: primero lo comprometido en "Por hacer", luego el Backlog, en el orden del tablero. */
function nextCard(cards: Card[]): Card | undefined {
  const free = (c: Card) => c.assignee === null || c.assignee === CLAUDE
  for (const col of ['por_hacer', 'backlog'] as ColumnId[]) {
    const found = cards.filter((c) => c.column === col && free(c)).sort((a, b) => (a.order < b.order ? -1 : 1))[0]
    if (found) return found
  }
  return undefined
}

// ---------- main ----------
function main(argv: string[]): string {
  const args = parse(argv)
  const json = args.flags.json === true
  const actor = str(args.flags.como) ?? CLAUDE
  const out = (text: string, data: unknown) => (json ? JSON.stringify(data, null, 2) : text)

  if (['ayuda', 'help', '-h', '--help'].includes(args.cmd) || args.flags.help || args.flags.h) return HELP
  if (!existsSync(DB_FILE)) throw new CliError(`No encuentro la base de ORION en ${DB_FILE}. Abre ORION (npm start) y crea un proyecto primero.`)

  const db = openDb(DB_FILE)
  const repo = createRepo(db)
  const cards = createCardsRepo(db)
  const projects = repo.listProjects()

  switch (args.cmd) {
    case 'proyectos':
      return out(projects.map((p) => `${p.code}  ${p.name}  (#${p.id})`).join('\n') || 'No hay proyectos.', projects)

    case 'init': {
      const code = args.pos[0]
      if (!code) throw new CliError('Uso: orion init <CÓDIGO>   (desde la carpeta del proyecto)')
      const p = resolveProject(projects, { proyecto: code })
      const dir = process.cwd()
      const r = prepareRepo(dir, p)
      repo.updateProject(p.id, { repoPath: dir })
      return [
        `Carpeta vinculada al proyecto ${p.name} (${p.code}).`,
        `  .orion.json: ${r.orionJson}`,
        `  CLAUDE.md (sección Tablero ORION): ${r.claudeMd}`,
        `  .claude/settings.json (permisos): ${r.settings}`,
        `  Verificación QA: ${r.verify.join(', ') || 'sin scripts detectados'}`,
      ].join('\n')
    }
  }

  const project = resolveProject(projects, args.flags)
  const pid = project.id

  switch (args.cmd) {
    case 'tablero': {
      const all = cards.list(pid)
      const lines = [`${project.name} (${project.code})`]
      for (const col of COLUMN_IDS) {
        const inCol = all.filter((c) => c.column === col)
        lines.push('', `${columnName(col)} (${inCol.length})`)
        if (col !== 'hecho') inCol.forEach((c) => lines.push(`  ${line(c)}`))
      }
      return out(lines.join('\n'), all)
    }

    case 'listar': {
      const column = args.flags.columna ? parseColumn(str(args.flags.columna)) : undefined
      const list = cards.list(pid, { column, assignee: str(args.flags.asignado) })
      return out(list.map(line).join('\n') || 'No hay tarjetas con ese filtro.', list)
    }

    case 'siguiente': {
      const card = nextCard(cards.list(pid))
      if (!card) return out('No hay tarjetas libres en "Por hacer" ni en "Backlog". ¡Tablero al día!', null)
      if (args.flags.ver) return out(detail(card, cards.comments(pid, card.number)), card)
      const taken = take(card.number)
      return out(`Tomaste la tarjeta #${taken.number} (En progreso, asignada a ${actor}).\n\n${detail(taken, cards.comments(pid, taken.number))}`, taken)
    }

    case 'ver': {
      const c = cards.get(pid, parseNumber(args.pos[0]))
      return out(detail(c, cards.comments(pid, c.number)), { ...c, comments: cards.comments(pid, c.number) })
    }

    case 'tomar': {
      const c = take(parseNumber(args.pos[0]))
      return out(`#${c.number} en En progreso, asignada a ${actor}.`, c)
    }

    case 'mover': {
      const n = parseNumber(args.pos[0])
      const column = parseColumn(args.pos[1])
      const c = cards.move(pid, n, { column, comment: str(args.flags.c) ?? str(args.flags.comentario) }, actor)
      return out(`#${c.number} movida a ${columnName(c.column)}.`, c)
    }

    case 'qa':
    case 'terminar': {
      const n = parseNumber(args.pos[0])
      const comment = needComment('Explica qué cambiaste: orion qa 12 -c "Oculté el botón QR hasta finalizar; src/Carrera.tsx"')
      const c = cards.move(pid, n, { column: 'revision_qa' }, actor)
      cards.comment(pid, n, `QA · ${comment}`, actor)
      return out(`#${c.number} en En revisión QA. Verifica y, si todo está bien: orion entregar ${n} -c "cómo probarlo"`, c)
    }

    case 'entregar': {
      const n = parseNumber(args.pos[0])
      const comment = needComment('Indica qué verificaste y cómo probarlo: orion entregar 12 -c "npm test OK. Probar: abrir carrera…"')
      const current = cards.get(pid, n)
      if (current.column !== 'revision_qa') {
        throw new CliError(`#${n} está en ${columnName(current.column)}; primero pásala a QA con: orion qa ${n} -c "…"`)
      }
      const c = cards.move(pid, n, { column: 'revision_humano' }, actor)
      cards.comment(pid, n, `Entregada para revisión humana · ${comment}`, actor)
      return out(`#${c.number} entregada en En revisión humano. Una persona la probará y decidirá.`, c)
    }

    case 'bloquear': {
      const n = parseNumber(args.pos[0])
      const comment = needComment('Explica qué falta: orion bloquear 12 -c "¿El QR debe verse también al pagar en efectivo?"')
      const c = cards.move(pid, n, { column: 'por_hacer' }, actor)
      cards.comment(pid, n, `Bloqueada · ${comment}`, actor)
      return out(`#${c.number} devuelta a Por hacer con tu pregunta. Sigue con: orion siguiente`, c)
    }

    case 'comentar': {
      const n = parseNumber(args.pos[0])
      const text = args.pos.slice(1).join(' ')
      const k = cards.comment(pid, n, text, actor)
      return out(`Comentario agregado a #${n}.`, k)
    }

    case 'criterio': {
      const n = parseNumber(args.pos[0])
      const i = Number(args.pos[1])
      const c = cards.get(pid, n)
      if (!Number.isInteger(i) || i < 1 || i > c.acceptance.length) {
        throw new CliError(`Criterio inválido. #${n} tiene ${c.acceptance.length} criterio(s); usa orion criterio ${n} <1..${c.acceptance.length}>`)
      }
      const done = !args.flags.no
      const acceptance = c.acceptance.map((a, j) => (j === i - 1 ? { ...a, done } : a))
      cards.update(pid, n, { acceptance }, actor)
      return out(`Criterio ${i} de #${n} marcado como ${done ? 'cumplido' : 'pendiente'}.`, acceptance)
    }

    case 'trabajo': {
      const n = parseNumber(args.pos[0])
      const work = { branch: str(args.flags.rama), commit: str(args.flags.commit), pr: str(args.flags.pr) }
      if (!work.branch && !work.commit && !work.pr) throw new CliError('Uso: orion trabajo 12 --rama fix/qr --commit a1b2c3 [--pr URL]')
      const c = cards.registerWork(pid, n, work, actor)
      return out(`Trabajo registrado en #${n}.`, c)
    }

    default:
      throw new CliError(`Comando desconocido "${args.cmd}". Escribe "orion ayuda".`)
  }

  /** Toma la tarjeta: la asigna y la lleva por Por hacer hasta En progreso (cada paso queda en el historial). */
  function take(n: number): Card {
    const c = cards.get(pid, n)
    if (c.assignee !== actor) cards.update(pid, n, { assignee: actor }, actor)
    if (c.column === 'backlog') cards.move(pid, n, { column: 'por_hacer' }, actor)
    return c.column === 'en_progreso' ? cards.get(pid, n) : cards.move(pid, n, { column: 'en_progreso' }, actor)
  }

  function needComment(usage: string): string {
    const text = str(args.flags.c) ?? str(args.flags.comentario) ?? args.pos.slice(1).join(' ')
    if (!text.trim()) throw new CliError(usage)
    return text.trim()
  }
}

try {
  console.log(main(process.argv.slice(2)))
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.error(`Error: ${msg}`)
  process.exit(1)
}

