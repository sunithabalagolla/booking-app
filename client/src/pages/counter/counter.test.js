import { describe, expect, it } from 'vitest'
import { counterRejectionText, itemCountText } from './counter.js'

// 2026-10-13 12:00 IST
const now = Date.parse('2026-10-13T06:30:00Z')

describe('O-11 canteen counter helpers', () => {
  it('says each reason in plain words', () => {
    expect(counterRejectionText({ reason: 'no_food' }, now)).toBe('This booking has no food order.')
    expect(counterRejectionText({ reason: 'already_collected', collectedAt: '2026-10-13T14:15:00Z' }, now)).toBe('Already collected at 7:45 PM.')
    expect(counterRejectionText({ reason: 'too_early', opensAt: '2026-10-13T13:00:00Z' }, now)).toBe('Too early. The counter opens for this show at 6:30 PM.')
    // The rest: the gate scanner words
    expect(counterRejectionText({ reason: 'wrong_theatre' }, now)).toBe('This ticket is for another theatre.')
    expect(counterRejectionText({ reason: 'cancelled' }, now)).toBe('This booking is cancelled.')
    expect(counterRejectionText({ reason: 'bad_qr' }, now)).toBe('This is not a valid Talkies ticket.')
  })

  it('counts items by quantity', () => {
    expect(itemCountText([{ qty: 2 }, { qty: 1 }])).toBe('3 items')
    expect(itemCountText([{ qty: 1 }])).toBe('1 item')
  })
})
