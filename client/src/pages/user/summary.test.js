import { describe, expect, it } from 'vitest'
import { billRows, gstRows, pickupText, signedRupees } from './summary.js'

// U-14 summary bill helpers (UI-23). Amounts are the server's; these only arrange them.
const line = (kind, description, qty, unitPricePaise, amountPaise, gstPercent, taxablePaise, cgstPaise, sgstPaise, discountPaise = 0) => ({
  kind,
  description,
  qty,
  unitPricePaise,
  amountPaise,
  gstPercent,
  taxablePaise,
  cgstPaise,
  sgstPaise,
  discountPaise,
})
const booking = {
  seats: [
    { seatId: 'F5', seatClass: 'first' },
    { seatId: 'F4', seatClass: 'first' },
    { seatId: 'L1', seatClass: 'balcony' },
  ],
  food: [{ name: 'Butter Popcorn', qty: 2 }],
  foodPickup: 'interval',
  pricing: {
    ticketDiscountPaise: 10000,
    discountType: 'coupon',
    couponCode: 'TALKIES20',
    dealPercent: null,
    gstLines: [
      { seatClass: 'balcony', ...line('ticket', '1 × Balcony', 1, 25000, 20946, 18, 17751, 1597, 1598, 4054) },
      { seatClass: 'first', ...line('ticket', '2 × First class', 2, 18000, 30054, 18, 25469, 2292, 2293, 5946) },
      line('food', '2 × Butter Popcorn', 2, 15000, 30000, 5, 28571, 714, 715),
      line('convenience_fee', 'Convenience fee', 3, 3000, 9000, 18, 7627, 686, 687),
    ],
  },
}

describe('bill rows (UI-23)', () => {
  it('tickets per class before the discount with seat numbers, then the coupon, food, fee', () => {
    expect(billRows(booking)).toEqual([
      { key: 'ticket-balcony', text: '1 × Balcony', note: 'L1 · ₹250 each', amountPaise: 25000 },
      { key: 'ticket-first', text: '2 × First class', note: 'F4, F5 · ₹180 each', amountPaise: 36000 },
      { key: 'discount', text: 'Coupon TALKIES20', amountPaise: -10000, discount: true },
      { key: 'food-2 × Butter Popcorn', text: '2 × Butter Popcorn', note: '₹150 each', amountPaise: 30000 },
      { key: 'fee', text: 'Convenience fee', note: '3 × ₹30', amountPaise: 9000 },
    ])
  })

  it('a deal shows as Special offer; no discount = no discount row', () => {
    const deal = { ...booking, pricing: { ...booking.pricing, discountType: 'deal', dealPercent: 20, couponCode: null } }
    expect(billRows(deal).find((r) => r.discount).text).toBe('Special offer 20% off tickets')
    const none = { ...booking, pricing: { ...booking.pricing, ticketDiscountPaise: 0, discountType: null } }
    expect(billRows(none).some((r) => r.discount)).toBe(false)
  })

  it('pickup line only with food', () => {
    expect(pickupText(booking)).toBe('Food pickup: Interval')
    expect(pickupText({ ...booking, food: [] })).toBeNull()
  })
})

describe('GST box', () => {
  it('one row per kind and rate, the ticket lines added together', () => {
    expect(gstRows(booking.pricing.gstLines)).toEqual([
      { key: 'ticket-18', text: 'Tickets (18%)', taxablePaise: 43220, cgstPaise: 3889, sgstPaise: 3891 },
      { key: 'food-5', text: 'Food (5%)', taxablePaise: 28571, cgstPaise: 714, sgstPaise: 715 },
      { key: 'convenience_fee-18', text: 'Convenience fee (18%)', taxablePaise: 7627, cgstPaise: 686, sgstPaise: 687 },
    ])
  })

  it('signed rupees', () => {
    expect(signedRupees(-10000)).toBe('−₹100')
    expect(signedRupees(36000)).toBe('₹360')
  })
})
