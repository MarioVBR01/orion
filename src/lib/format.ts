const dateFmt = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/** Formatea como "05/10/2026, 12:29 p. m." */
export function formatDateTime(d: Date | { toDate(): Date } | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : d.toDate()
  // Intl usa espacios finos/no separables; los normalizamos a espacio normal
  return dateFmt.format(date).replace(new RegExp('[\\u202f\\u00a0]', 'g'), ' ')
}

export function badgeCount(n: number, max = 9): string {
  return n > max ? `${max}+` : String(n)
}

export function percent(done: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((done / total) * 100)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}
