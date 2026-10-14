import type { Sprint } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso)
  d.setDate(d.getDate() + days)
  return toIsoDate(d)
}

/** Días entre dos fechas AAAA-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / 86_400_000)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "14 sep – 28 sep" (con año si no es el actual o si cambia). */
export function formatRange(start: string, end: string, currentYear = new Date().getFullYear()): string {
  const s = parseIsoDate(start)
  const e = parseIsoDate(end)
  const showYear = s.getFullYear() !== e.getFullYear() || s.getFullYear() !== currentYear
  const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}${showYear ? ` ${d.getFullYear()}` : ''}`
  return `${fmt(s)} – ${fmt(e)}`
}

/** Sprint al que pertenece una fecha (por sus fechas de inicio y fin). */
export function sprintForDate(sprints: Sprint[], date: string): Sprint | undefined {
  return sprints.find((s) => s.startDate && s.endDate && s.startDate <= date && date <= s.endDate)
}

/** Día del sprint (1 = primer día) y duración total en días. */
export function sprintDay(sprint: Pick<Sprint, 'startDate' | 'endDate'>, date: string): { day: number; total: number } | null {
  if (!sprint.startDate || !sprint.endDate) return null
  return { day: daysBetween(sprint.startDate, date) + 1, total: daysBetween(sprint.startDate, sprint.endDate) + 1 }
}

/** Orden de la vista de sprints: activo primero, luego futuros por número. */
export function openSprintsOrder(sprints: Sprint[]): Sprint[] {
  const rank = (s: Sprint) => (s.status === 'activo' ? 0 : 1)
  return sprints.filter((s) => s.status !== 'completado').sort((a, b) => rank(a) - rank(b) || a.number - b.number)
}
