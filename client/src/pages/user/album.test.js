import { describe, expect, it } from 'vitest'
import { STAMPS, stubDateText, ticketInfo, tiltFor } from './ticket.js'

// U-18 ticket album helpers (UI-28)
describe('ticket album', () => {
  it('a ticket keeps the same small tilt; different tickets get different tilts', () => {
    const ids = ['6ac6295b9bfb5b4143c0b554', '6ac4e846a9d50896b4d4a860', '6ac4db29a9d50896b4d4a856', '6ac262ef0a67bd8f520f4d9b']
    for (const id of ids) {
      expect(tiltFor(id)).toBe(tiltFor(id))
      expect(Math.abs(tiltFor(id))).toBeLessThanOrEqual(1.5)
    }
    expect(new Set(ids.map(tiltFor)).size).toBeGreaterThan(1)
  })

  it('stub date in IST and stamps', () => {
    expect(stubDateText({ startAt: '2026-10-07T16:15:00.000Z' })).toBe('Wed 7 Oct 2026 · 9:45 PM')
    expect(stubDateText({ startAt: '2026-12-31T19:00:00.000Z' })).toBe('Fri 1 Jan 2027 · 12:30 AM')
    expect(STAMPS.cancelled).toEqual({ text: 'Cancelled', tone: 'maroon' })
    expect(STAMPS.transferred).toEqual({ text: 'Transferred', tone: 'mustard' })
    expect(STAMPS.null).toBeUndefined() // no "Watched" until gate check-in (Phase 7)
  })

  it('album items (flat totalPaise) work with the ticket text', () => {
    const item = { show: { certificate: 'U', language: 'Tamil', format: '2D', label: 'first', startAt: '2026-10-07T13:00:00.000Z' }, seats: [{ seatId: 'A1', seatClass: 'second' }], food: [], totalPaise: 15000 }
    expect(ticketInfo(item)).toMatchObject({ totalText: '₹150', seatsText: 'A1', foodText: null })
  })
})
