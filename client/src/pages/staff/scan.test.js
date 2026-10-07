import { describe, expect, it } from 'vitest'
import { bookingNumberProblem, cleanBookingNumber, gateTime, rejectionText } from './scan.js'

const NOW = Date.parse('2026-10-08T12:00:00Z') // Thu 8 Oct 2026, 5:30 PM IST

describe('gate scanner helpers (S-05)', () => {
  it('time today, or with the day when it is another day (IST)', () => {
    expect(gateTime('2026-10-08T12:35:00Z', NOW)).toBe('6:05 PM')
    expect(gateTime('2026-10-09T04:00:00Z', NOW)).toBe('Fri 9 Oct, 9:30 AM')
    expect(gateTime('2026-10-08T18:45:00Z', NOW)).toBe('Fri 9 Oct, 12:15 AM') // after midnight IST
  })

  it('every rejection reason has plain words', () => {
    expect(rejectionText({ reason: 'already_used', usedAt: '2026-10-08T12:35:00Z' }, NOW)).toBe('Already used at 6:05 PM.')
    expect(rejectionText({ reason: 'too_early', opensAt: '2026-10-08T13:00:00Z' }, NOW)).toBe('Too early. Check-in opens at 6:30 PM.')
    expect(rejectionText({ reason: 'wrong_theatre' })).toBe('This ticket is for another theatre.')
    expect(rejectionText({ reason: 'too_late' })).toBe('This show is already over.')
    expect(rejectionText({ reason: 'cancelled' })).toBe('This booking is cancelled.')
    expect(rejectionText({ reason: 'transferred' })).toMatch(/^This ticket was given to someone else/)
    expect(rejectionText({ reason: 'bad_qr' })).toBe('This is not a valid Talkies ticket.')
  })

  it('typed booking number: cleaned and checked', () => {
    expect(cleanBookingNumber(' tk7f3 k9qxm ')).toBe('TK7F3K9QXM')
    expect(bookingNumberProblem(' tk7f3 k9qxm ')).toBeNull()
    expect(bookingNumberProblem('')).toBe('Please type the booking number.')
    expect(bookingNumberProblem('TK7F3K9QX0')).toMatch(/^A booking number is TK/) // 0 is never used
    expect(bookingNumberProblem('TK7F3K9QX')).toMatch(/^A booking number is TK/)
  })
})
