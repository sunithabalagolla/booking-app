import { describe, expect, it } from 'vitest'
import { istDateTime, istParts, showEnd, showLabel } from '../src/utils/showTime.js'

// O-05 show times in IST (BR-21), labels (BR-22), end time (BR-10)
describe('show times', () => {
  it('IST day + time → UTC and back', () => {
    const start = istDateTime('2026-10-05', '14:30')
    expect(start.toISOString()).toBe('2026-10-05T09:00:00.000Z')
    expect(istParts(start)).toEqual({ date: '2026-10-05', time: '14:30' })
    // 02:00 IST is still the evening before in UTC
    expect(istDateTime('2026-10-05', '02:00').toISOString()).toBe('2026-10-04T20:30:00.000Z')
  })

  it('labels change exactly at 12:00, 4:00 PM and 8:00 PM IST (BR-22)', () => {
    const cases = { '00:00': 'morning', '11:59': 'morning', '12:00': 'matinee', '15:59': 'matinee', '16:00': 'first', '19:59': 'first', '20:00': 'second', '23:59': 'second' }
    for (const [time, label] of Object.entries(cases)) expect(showLabel(istDateTime('2026-10-05', time)), time).toBe(label)
  })

  it('end = start + duration + cleaning break (BR-10), also past midnight', () => {
    const end = showEnd(istDateTime('2026-10-05', '22:00'), 150, 15)
    expect(istParts(end)).toEqual({ date: '2026-10-06', time: '00:45' })
  })
})
