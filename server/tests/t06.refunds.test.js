import { describe, expect, it } from 'vitest'
import { calculatePricing, ratesFromSettings, refundFor } from '../src/services/pricing.js'

// T-06: cancellation refund amounts. BR-05 (user cancels): 75% of each ticket line after its
// discount, 100% food, convenience fee not refunded. BR-06 (theatre cancels): 100% of all.

const rates = ratesFromSettings({
  gst: { ticketPercent: 18, foodPercent: 5, convenienceFeePercent: 18 },
  convenienceFeePaise: 3000,
  commissionPercent: 10,
  userRefundTicketPercent: 75,
  userRefundFoodPercent: 100,
  cancelCutoffMinutes: 120,
})
const seat = (seatClass, pricePaise) => ({ seatClass, pricePaise })
const tea = { name: 'Tea', unitPricePaise: 2000, qty: 2 }
const exact = ({ lines }) => {
  for (const l of lines) expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(l.amountPaise)
}

describe('BR-05 user cancels', () => {
  it('75% tickets, 100% food, fee 0', () => {
    const pricing = calculatePricing({ seats: [seat('second', 12000), seat('second', 12000)], food: [tea], rates })
    expect(pricing.totalPaise).toBe(34000) // 240 + 40 + 60
    const refund = refundFor(pricing, 'user')
    expect(refund.lines.map((l) => [l.kind, l.paidPaise, l.percent, l.amountPaise])).toEqual([
      ['ticket', 24000, 75, 18000],
      ['food', 4000, 100, 4000],
      ['convenience_fee', 6000, 0, 0],
    ])
    expect(refund.refundPaise).toBe(22000)
    exact(refund)
  })

  it('75% of the tickets AFTER the coupon (shared by the classes)', () => {
    const pricing = calculatePricing({ seats: [seat('balcony', 25000), seat('first', 18000)], rates, discount: { type: 'coupon', paise: 10000, couponCode: 'TALKIES20' } })
    const ticketLines = pricing.gstLines.filter((l) => l.kind === 'ticket').map((l) => l.amountPaise)
    expect(ticketLines).toEqual([19187, 13813]) // ₹430 − ₹100 shared by amount (last line gets the rest)
    const refund = refundFor(pricing, 'user')
    expect(refund.lines.filter((l) => l.kind === 'ticket').map((l) => l.amountPaise)).toEqual([14390, 10360]) // 143.9025 → 143.90, 103.5975 → 103.60
    expect(refund.refundPaise).toBe(24750)
    exact(refund)
  })

  it('a last-minute deal works the same way', () => {
    const pricing = calculatePricing({ seats: [seat('first', 18000), seat('first', 18000)], rates, discount: { type: 'deal', paise: 7200, dealPercent: 20 } })
    expect(refundFor(pricing, 'user').refundPaise).toBe(21600) // 75% of 288
  })

  it('odd paise round to the nearest paisa (half up)', () => {
    const pricing = calculatePricing({ seats: [seat('second', 10001)], rates })
    expect(refundFor(pricing, 'user').lines[0].amountPaise).toBe(7501) // 75.0075 → 75.01
    const p2 = calculatePricing({ seats: [seat('second', 10002)], rates })
    expect(refundFor(p2, 'user').lines[0].amountPaise).toBe(7502) // 75.015 → 75.02
  })

  it('uses the percents copied into the booking, not today’s settings (A-05)', () => {
    const pricing = calculatePricing({ seats: [seat('second', 12000)], food: [tea], rates: { ...rates, userRefundTicketPercent: 50, userRefundFoodPercent: 90 } })
    const refund = refundFor(pricing, 'user')
    expect(refund.lines.map((l) => l.amountPaise)).toEqual([6000, 3600, 0])
  })
})

describe('BR-06 theatre cancels', () => {
  it('100% of everything, including the fee; = the amount paid', () => {
    const pricing = calculatePricing({ seats: [seat('balcony', 25000), seat('first', 18000)], food: [tea], rates, discount: { type: 'coupon', paise: 10000, couponCode: 'X' } })
    const refund = refundFor(pricing, 'theatre')
    expect(refund.lines.every((l) => l.percent === 100)).toBe(true)
    expect(refund.refundPaise).toBe(pricing.totalPaise)
    exact(refund)
  })
})
