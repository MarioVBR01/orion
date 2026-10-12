import { columnName } from '@shared/flow'
import type { HistoryEntry } from '@shared/types'

/** Frase legible para una entrada del historial. */
export function describeHistory(h: HistoryEntry): string {
  switch (h.action) {
    case 'creada':
      return `creó la tarjeta en ${columnName(h.to ?? '')}`
    case 'movida':
      return `movió de ${columnName(h.from ?? '')} a ${columnName(h.to ?? '')}`
    case 'comentada':
      return 'comentó'
    case 'archivada':
      return 'archivó la tarjeta'
    case 'restaurada':
      return 'restauró la tarjeta'
    case 'exportada':
      return `exportó a ${h.detail ?? '.md'} para el chat del proyecto`
    case 'trabajo':
      return `registró trabajo: ${h.detail ?? ''}`
    case 'editada':
      if (h.detail === 'asignado') return h.to ? `asignó a ${h.to}` : 'quitó el asignado'
      return `editó ${h.detail ?? 'la tarjeta'}`
  }
}
