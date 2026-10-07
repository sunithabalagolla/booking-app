import { describe, expect, it } from 'vitest'
import { cutoffText, istShortDateTime, refundRows } from './cancel.js'

// U-20 cancel panel text
describe('cancel panel', () => {
  it('refund rows: percent back, fee not refunded', () => {
    const preview = {
      cutoffAt: '2026-10-07T12:30:00.000Z',
      lines: [
        { kind: 'ticket', description: '2 × Second class', paidPaise: 23000, percent: 75, refundPaise: 17250 },
        { kind: 'food', description: '2 × Tea', paidPaise: 4000, percent: 100, refundPaise: 4000 },
        { kind: 'convenience_fee', description: 'Convenience fee', paidPaise: 6000, percent: 0, refundPaise: 0 },
      ],
    }
    expect(refundRows(preview).map(({ text, note, amountText }) => [text, note, amountText])).toEqual([
      ['2 × Second class', '75% back of ₹230', '₹172.50'],
      ['2 × Tea', '100% back of ₹40', '₹40'],
      ['Convenience fee', 'not refunded', '₹0'],
    ])
    expect(cutoffText(preview)).toBe('You can cancel until Wed 7 Oct, 6:00 PM.')
  })

  it('IST date and time', () => {
    expect(istShortDateTime('2026-10-07T18:30:00.000Z')).toBe('Thu 8 Oct, 12:00 AM')
  })
})
