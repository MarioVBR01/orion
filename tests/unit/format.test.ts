import { describe, expect, it } from 'vitest'
import { badgeCount, formatDateTime, initials, percent } from '../../src/lib/format'

describe('format', () => {
  it('badgeCount topa en 9+', () => {
    expect(badgeCount(3)).toBe('3')
    expect(badgeCount(12)).toBe('9+')
  })
  it('percent', () => {
    expect(percent(353, 360)).toBe(98)
    expect(percent(0, 0)).toBe(0)
  })
  it('initials', () => {
    expect(initials('mario brañez')).toBe('MB')
  })
  it('formatDateTime usa dd/mm/aaaa', () => {
    const s = formatDateTime(new Date(2026, 9, 5, 12, 29))
    expect(s.startsWith('05/10/2026')).toBe(true)
    expect(s).toMatch(/12:29/)
  })
})
