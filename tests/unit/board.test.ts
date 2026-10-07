import { describe, expect, it } from 'vitest'
import { groupByColumn, matchesSearch, mentions, orderBetween, progress, reportToMarkdown } from '../../shared/board'

const card = (number: number, title: string, labels: string[] = []) => ({ number, title, labels })

describe('búsqueda', () => {
  it('por número con o sin #', () => {
    expect(matchesSearch(card(90, 'X'), '#90')).toBe(true)
    expect(matchesSearch(card(90, 'X'), '90')).toBe(true)
    expect(matchesSearch(card(901, 'X'), '#90')).toBe(false)
  })
  it('por título sin importar tildes ni mayúsculas, y por etiqueta', () => {
    expect(matchesSearch(card(1, 'Consumo de Batería en App'), 'bateria')).toBe(true)
    expect(matchesSearch(card(1, 'Algo', ['DIR-TEC']), 'dir-tec')).toBe(true)
    expect(matchesSearch(card(1, 'Algo'), 'otro')).toBe(false)
    expect(matchesSearch(card(1, 'Algo'), '  ')).toBe(true)
  })
})

describe('tablero', () => {
  it('agrupa por columna ordenando por clave', () => {
    const g = groupByColumn([
      { column: 'hecho' as const, order: 'b', id: 1 },
      { column: 'hecho' as const, order: 'a', id: 2 },
      { column: 'backlog' as const, order: 'V', id: 3 },
    ])
    expect(g.hecho.map((c) => c.id)).toEqual([2, 1])
    expect(g.backlog.map((c) => c.id)).toEqual([3])
    expect(g.por_hacer).toEqual([])
  })
  it('calcula el progreso como en la referencia', () => {
    const cards = [...Array(353).fill({ column: 'hecho' }), ...Array(7).fill({ column: 'backlog' })]
    expect(progress(cards)).toEqual({ total: 360, done: 353, percent: 98 })
    expect(progress([])).toEqual({ total: 0, done: 0, percent: 0 })
  })
  it('orderBetween tolera vecinos inválidos', () => {
    expect(orderBetween('a', 'b')).toBeDefined()
    expect(orderBetween('b', 'a')).toBeUndefined()
    expect(orderBetween(null, undefined)).toBeDefined()
  })
})

describe('reporte', () => {
  it('compone los cinco bloques en Markdown', () => {
    const md = reportToMarkdown(
      { where: 'Checkout → paso 2 (Pago)', steps: ['Abrí la app en Android', '', 'Fui a pagar'], expected: 'Ver QR', actual: 'No aparece' },
      '![captura](x.png)',
    )
    expect(md).toContain('### ¿Dónde?\nCheckout → paso 2 (Pago)')
    expect(md).toContain('1. Abrí la app en Android\n2. Fui a pagar')
    expect(md).toContain('### ¿Qué esperaba?\nVer QR')
    expect(md).toContain('### ¿Qué pasó?\nNo aparece')
    expect(md).toContain('### 📎 Imagen\n![captura](x.png)')
  })
  it('detecta menciones', () => {
    expect(mentions('Hola @Rodri BC y @claude', ['Rodri BC', 'Leonel', 'claude'])).toEqual(['Rodri BC', 'claude'])
  })
})
