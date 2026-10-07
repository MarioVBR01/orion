import { CLAUDE, COLUMNS, type ColumnId } from './types'

/** Columnas por las que puede mover Claude (igual que un dev: hasta QA). */
export const CLAUDE_COLUMNS: ColumnId[] = ['backlog', 'por_hacer', 'en_progreso', 'revision_qa']

export const columnName = (id: string) => COLUMNS.find((c) => c.id === id)?.name ?? id

/** Una devolución desde revisión humana exige explicar por qué. */
export function isReturn(from: ColumnId, to: ColumnId) {
  return from === 'revision_humano' && to === 'por_hacer'
}

/** Devuelve el motivo si el movimiento no está permitido, o null si sí lo está. */
export function moveError(actor: string, from: ColumnId, to: ColumnId, comment?: string): string | null {
  if (from === to) return null
  if (actor === CLAUDE) {
    if (to === 'hecho') return 'Claude no puede mover tarjetas a Hecho; eso lo hace un humano.'
    if (!CLAUDE_COLUMNS.includes(from) || !CLAUDE_COLUMNS.includes(to)) {
      return `Claude solo puede mover entre ${CLAUDE_COLUMNS.map(columnName).join(', ')}.`
    }
  }
  if (isReturn(from, to) && !comment?.trim()) {
    return 'Para devolver una tarjeta de "En revisión humano" a "Por hacer" debes escribir un comentario.'
  }
  return null
}
