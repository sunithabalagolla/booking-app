import { describe, expect, it } from 'vitest'
import { canCancelShow, cancelledMessage, cancelSummaryText, reasonProblem } from './showCancel.js'

describe('O-06 cancel show helpers', () => {
  it('only a scheduled show that has not started can be cancelled (BR-07)', () => {
    const now = Date.parse('2026-10-07T10:00:00Z')
    expect(canCancelShow({ status: 'scheduled', startAt: '2026-10-07T10:00:01Z' }, now)).toBe(true)
    expect(canCancelShow({ status: 'scheduled', startAt: '2026-10-07T10:00:00Z' }, now)).toBe(false)
    expect(canCancelShow({ status: 'cancelled', startAt: '2026-10-08T10:00:00Z' }, now)).toBe(false)
  })

  it('summary and message text', () => {
    expect(cancelSummaryText({ bookings: 2, refundPaise: 48000 })).toBe('2 bookings · ₹480 goes back to the users in full (tickets, food and convenience fee).')
    expect(cancelSummaryText({ bookings: 1, refundPaise: 15000 })).toMatch(/^1 booking · ₹150/)
    expect(cancelSummaryText({ bookings: 0, refundPaise: 0 })).toBe('Nobody has booked this show yet, so there is nothing to refund.')
    expect(cancelledMessage({ bookings: 0 })).toBe('Show cancelled.')
    expect(cancelledMessage({ bookings: 1 })).toBe('Show cancelled. 1 booking is refunded in full and the user gets an email.')
    expect(cancelledMessage({ bookings: 3 })).toBe('Show cancelled. 3 bookings are refunded in full and the users get an email.')
  })

  it('reason: 5–300 characters after trimming', () => {
    expect(reasonProblem('  abcd ')).toBe('Please give a reason (at least 5 characters).')
    expect(reasonProblem('abcde')).toBeNull()
    expect(reasonProblem('x'.repeat(301))).toBe('The reason can have at most 300 characters.')
  })
})
