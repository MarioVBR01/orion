import { describe, expect, it } from 'vitest'
import { keyBetween, keysBetween } from '../../src/lib/order'

describe('keyBetween', () => {
  it('genera clave inicial', () => {
    expect(keyBetween(null, null).length).toBeGreaterThan(0)
  })

  it('respeta el orden entre dos claves', () => {
    const cases: Array<[string | null, string | null]> = [
      [null, 'V'], ['V', null], ['A', 'B'], ['A', 'A1'], ['Az', 'B'], ['a1', 'a2'], [null, '1'], ['zz', null], [null, '01'],
    ]
    for (const [a, b] of cases) {
      const k = keyBetween(a, b)
      if (a !== null) expect(k > a).toBe(true)
      if (b !== null) expect(k < b).toBe(true)
      expect(k.endsWith('0')).toBe(false)
    }
  })

  it('soporta muchas inserciones consecutivas al inicio y al final', () => {
    let first = keyBetween(null, null)
    let last = first
    for (let i = 0; i < 300; i++) {
      const nf = keyBetween(null, first)
      expect(nf < first).toBe(true)
      first = nf
      const nl = keyBetween(last, null)
      expect(nl > last).toBe(true)
      last = nl
    }
  })

  it('soporta bisecciones repetidas', () => {
    let a = 'A'
    let b = 'B'
    for (let i = 0; i < 200; i++) {
      const k = keyBetween(a, b)
      expect(k > a && k < b).toBe(true)
      if (i % 2) a = k
      else b = k
    }
  })

  it('rechaza rangos invertidos', () => {
    expect(() => keyBetween('B', 'A')).toThrow()
  })

  it('keysBetween genera claves crecientes y únicas', () => {
    const ks = keysBetween('A', 'B', 10)
    expect([...ks].sort()).toEqual(ks)
    expect(new Set(ks).size).toBe(10)
  })
})
