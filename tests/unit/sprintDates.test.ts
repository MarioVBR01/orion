import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatRange, openSprintsOrder, sprintDay, sprintForDate } from '../../shared/sprintDates'
import type { Sprint } from '../../shared/types'

const sprint = (id: number, status: Sprint['status'], startDate: string | null, endDate: string | null): Sprint => ({
  id,
  projectId: 1,
  number: id,
  name: `S${id}`,
  goal: '',
  startDate,
  endDate,
  status,
  completedAt: null,
  createdAt: '',
})

describe('fechas de sprint', () => {
  it('formatea el rango como Jira', () => {
    expect(formatRange('2026-09-14', '2026-09-28', 2026)).toBe('14 sep – 28 sep')
    expect(formatRange('2026-12-21', '2027-01-04', 2026)).toBe('21 dic 2026 – 4 ene 2027')
  })
  it('suma días y calcula diferencias', () => {
    expect(addDays('2026-09-14', 14)).toBe('2026-09-28')
    expect(daysBetween('2026-09-14', '2026-09-28')).toBe(14)
  })
  it('ubica una fecha en su sprint y el día del sprint', () => {
    const list = [sprint(1, 'completado', '2026-09-14', '2026-09-28'), sprint(2, 'activo', '2026-09-29', '2026-10-12')]
    expect(sprintForDate(list, '2026-09-20')?.id).toBe(1)
    expect(sprintForDate(list, '2026-10-12')?.id).toBe(2)
    expect(sprintForDate(list, '2026-10-20')).toBeUndefined()
    expect(sprintDay(list[0]!, '2026-09-14')).toEqual({ day: 1, total: 15 })
  })
  it('ordena: activo primero y sin completados', () => {
    const list = [sprint(1, 'completado', null, null), sprint(2, 'futuro', null, null), sprint(3, 'activo', null, null)]
    expect(openSprintsOrder(list).map((s) => s.id)).toEqual([3, 2])
  })
})
