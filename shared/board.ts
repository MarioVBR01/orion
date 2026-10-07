import { keyBetween } from './order'
import { COLUMN_IDS, type Card, type ColumnId, type Report } from './types'

/** Quita tildes y pasa a minúsculas para comparar textos. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** "#90" o "90" busca por número exacto; cualquier otro texto busca en título y etiquetas. */
export function matchesSearch(card: Pick<Card, 'number' | 'title' | 'labels'>, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  const num = /^#?(\d+)$/.exec(q)
  if (num) return card.number === Number(num[1])
  const n = normalize(q)
  return normalize(card.title).includes(n) || card.labels.some((l) => normalize(l).includes(n))
}

export function groupByColumn<T extends Pick<Card, 'column' | 'order'>>(cards: T[]): Record<ColumnId, T[]> {
  const groups = Object.fromEntries(COLUMN_IDS.map((c) => [c, [] as T[]])) as Record<ColumnId, T[]>
  for (const c of cards) groups[c.column]?.push(c)
  for (const id of COLUMN_IDS) groups[id].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0))
  return groups
}

/** Clave de orden entre dos vecinos; undefined si no se puede (el servidor la pone al final). */
export function orderBetween(prev: string | null | undefined, next: string | null | undefined): string | undefined {
  try {
    return keyBetween(prev ?? null, next ?? null)
  } catch {
    return undefined
  }
}

export function progress(cards: Array<Pick<Card, 'column'>>) {
  const total = cards.length
  const done = cards.filter((c) => c.column === 'hecho').length
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0 }
}

/** Compone la descripción Markdown con los bloques fijos del reporte. */
export function reportToMarkdown(r: Report, imagesMd = ''): string {
  const steps = r.steps.filter((s) => s.trim()).map((s, i) => `${i + 1}. ${s.trim()}`)
  return [
    '### ¿Dónde?',
    r.where.trim() || '—',
    '',
    '### ¿Qué hice?',
    steps.length ? steps.join('\n') : '—',
    '',
    '### ¿Qué esperaba?',
    r.expected.trim() || '—',
    '',
    '### ¿Qué pasó?',
    r.actual.trim() || '—',
    ...(imagesMd ? ['', '### 📎 Imagen', imagesMd] : []),
  ].join('\n')
}

/** Nombres mencionados con @ en un texto (coincidencia con la lista de personas conocida). */
export function mentions(text: string, people: string[]): string[] {
  const found = new Set<string>()
  const lower = normalize(text)
  for (const p of people) if (lower.includes(`@${normalize(p)}`)) found.add(p)
  return [...found]
}
