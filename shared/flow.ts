import { CLAUDE, COLUMNS, type ColumnId } from './types'

/**
 * Columnas por las que puede mover Claude: desde el Backlog hasta entregar en "En revisión humano".
 * Desde "En revisión humano" en adelante decide una persona (probar la app y mover a Hecho o devolver).
 */
export const CLAUDE_COLUMNS: ColumnId[] = ['backlog', 'por_hacer', 'en_progreso', 'revision_qa', 'revision_humano']

export const columnName = (id: string) => COLUMNS.find((c) => c.id === id)?.name ?? id

/** Una devolución desde revisión humana exige explicar por qué. */
export function isReturn(from: ColumnId, to: ColumnId) {
  return from === 'revision_humano' && to === 'por_hacer'
}

/** Devuelve el motivo si el movimiento no está permitido, o null si sí lo está. */
export function moveError(actor: string, from: ColumnId, to: ColumnId, comment?: string): string | null {
  if (from === to) return null
  if (actor === CLAUDE) {
    if (to === 'hecho') return 'Claude no puede mover tarjetas a Hecho; eso lo hace una persona después de probar la aplicación.'
    if (from === 'revision_humano') return 'La tarjeta ya está en "En revisión humano": ahora decide una persona.'
    if (!CLAUDE_COLUMNS.includes(from) || !CLAUDE_COLUMNS.includes(to)) {
      return `Claude solo puede mover entre ${CLAUDE_COLUMNS.map(columnName).join(', ')}.`
    }
  }
  if (isReturn(from, to) && !comment?.trim()) {
    return 'Para devolver una tarjeta de "En revisión humano" a "Por hacer" debes escribir un comentario.'
  }
  return null
}
