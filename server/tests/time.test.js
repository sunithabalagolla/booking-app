import { describe, expect, it } from 'vitest'
import { dateToIstDay, istDayToDate, istToday } from '../src/utils/time.js'

// BR-21: store UTC, show IST
describe('IST day helpers', () => {
  it('an IST day starts at 18:30 UTC the day before', () => {
    expect(istDayToDate('2026-10-02').toISOString()).toBe('2026-10-01T18:30:00.000Z')
  })

  it('turns a moment into its IST day (late evening UTC is already the next day in IST)', () => {
    expect(dateToIstDay(new Date('2026-10-01T18:29:59Z'))).toBe('2026-10-01')
    expect(dateToIstDay(new Date('2026-10-01T18:30:00Z'))).toBe('2026-10-02')
  })

  it('goes there and back without change', () => {
    expect(dateToIstDay(istDayToDate('2027-01-01'))).toBe('2027-01-01')
  })

  it('istToday adds days', () => {
    const now = new Date('2026-10-01T20:00:00Z') // 1:30 AM on 2 Oct in IST
    expect(istToday(0, now)).toBe('2026-10-02')
    expect(istToday(-1, now)).toBe('2026-10-01')
  })
})
