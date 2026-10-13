import { describe, expect, it } from 'vitest'
import { buildDailyDoc, longDate, pdfSafe, periodText } from '../../src/features/daily/dailyPdf'

describe('PDF del Daily Scrum', () => {
  it('reemplaza flechas y quita emojis que la fuente no tiene', () => {
    expect(pdfSafe('Backlog → Por hacer 🤖 claude ✅')).toBe('Backlog » Por hacer claude ')
  })

  it('muestra el periodo como rango de fechas', () => {
    const from = new Date(2026, 9, 12).toISOString()
    const to = new Date(2026, 9, 14).toISOString()
    expect(periodText({ from, to })).toBe('12/10/2026 al 13/10/2026')
  })

  it('fecha larga en español', () => {
    expect(longDate('2026-10-13')).toBe('martes, 13/10/2026')
  })

  it('arma el documento con participantes, actividad y estado', () => {
    const doc = buildDailyDoc(
      { name: 'YALEH', code: 'YLH' },
      {
        id: 1,
        projectId: 1,
        date: '2026-10-13',
        notes: 'Sprint 1',
        entries: [{ person: 'Mario', yesterday: 'Revisé', today: 'Probar', blockers: '' }],
        boardSnapshot: { backlog: 2, por_hacer: 0, en_progreso: 1, revision_qa: 0, revision_humano: 1, hecho: 3 },
        createdAt: '2026-10-13T12:00:00.000Z',
        updatedAt: '2026-10-13T12:00:00.000Z',
      },
      { from: new Date(2026, 9, 12).toISOString(), to: new Date(2026, 9, 14).toISOString(), moves: [] },
    )
    const text = JSON.stringify(doc.content)
    expect(text).toContain('YALEH (YLH) · martes, 13/10/2026')
    expect(text).toContain('Mario')
    expect(text).toContain('Sin movimientos en el periodo.')
    expect(text).toContain('Periodo: 12/10/2026 al 13/10/2026')
  })
})
