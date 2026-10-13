import { describe, expect, it } from 'vitest'
import { anyGateOpen, cameShare, GATE_STAMPS, notCome } from './checkinReport.js'

describe('O-10 check-in report helpers', () => {
  it('came % rounds to whole numbers; nothing booked = dash', () => {
    expect(cameShare(6, 4)).toBe('67%')
    expect(cameShare(3, 3)).toBe('100%')
    expect(cameShare(5, 0)).toBe('0%')
    expect(cameShare(0, 0)).toBe('—')
    expect(notCome(6, 4)).toBe(2)
    expect(notCome(0, 0)).toBe(0)
  })

  it('auto refresh only while a gate is open', () => {
    expect(anyGateOpen([{ gate: 'over' }, { gate: 'open' }])).toBe(true)
    expect(anyGateOpen([{ gate: 'over' }, { gate: 'not_open' }, { gate: 'cancelled' }])).toBe(false)
    expect(anyGateOpen(undefined)).toBe(false)
  })

  it('has a stamp for every gate state', () => {
    expect(Object.keys(GATE_STAMPS)).toEqual(['open', 'not_open', 'over', 'cancelled'])
    expect(GATE_STAMPS.open).toEqual({ tone: 'green', label: 'Gate open' })
    expect(GATE_STAMPS.cancelled.tone).toBe('maroon')
  })
})
