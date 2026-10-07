import { describe, expect, it } from 'vitest'
import { calculatePricing, couponDiscount, dealDiscount, gstSplit, ratesFromSettings } from '../src/services/pricing.js'

// T-05: price and GST calculation (backend), with coupon and deal (database.md 2a, BR-16)

const rates = ratesFromSettings({
  gst: { ticketPercent: 18, foodPercent: 5, convenienceFeePercent: 18, hsnSac: { ticket: 'T', food: 'F', convenienceFee: 'C' } },
  convenienceFeePaise: 3000,
  commissionPercent: 10,
  userRefundTicketPercent: 75,
  userRefundFoodPercent: 100,
  cancelCutoffMinutes: 120,
})
const seat = (seatClass, pricePaise) => ({ seatClass, pricePaise })
// Every line must add up exactly, and the lines must add up to the total
function expectExact(pricing) {
  for (const l of pricing.gstLines) expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(l.amountPaise)
  expect(pricing.gstLines.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(pricing.totalPaise)
  expect(pricing.totalPaise).toBe(pricing.ticketsPaise - pricing.ticketDiscountPaise + pricing.foodPaise + pricing.convenienceFeePaise)
}

describe('GST calculated back from the price (database.md 2a)', () => {
  it('the example: ₹200 at 18% → taxable 16949, CGST 1525, SGST 1526', () => {
    expect(gstSplit(20000, 18)).toEqual({ taxablePaise: 16949, cgstPaise: 1525, sgstPaise: 1526 })
  })

  it('always adds up exactly, for many amounts and rates (also 0%)', () => {
    for (const rate of [0, 5, 12, 18, 28]) {
      for (const amount of [1, 99, 3000, 12345, 20000, 99999, 500000]) {
        const { taxablePaise, cgstPaise, sgstPaise } = gstSplit(amount, rate)
        expect(taxablePaise + cgstPaise + sgstPaise).toBe(amount)
        expect(Math.abs(sgstPaise - cgstPaise)).toBeLessThanOrEqual(1)
      }
    }
    expect(gstSplit(5000, 0)).toEqual({ taxablePaise: 5000, cgstPaise: 0, sgstPaise: 0 })
  })
})

describe('booking price (U-14)', () => {
  it('tickets per class, food per item at 5%, fee per ticket; total = all lines', () => {
    const pricing = calculatePricing({
      seats: [seat('second', 12000), seat('balcony', 25000), seat('second', 12000)],
      food: [
        { name: 'Butter Popcorn', unitPricePaise: 15000, qty: 2 },
        { name: 'Chicken Puff', unitPricePaise: 7000, qty: 1 },
      ],
      rates,
    })
    expect(pricing).toMatchObject({ ticketsPaise: 49000, foodPaise: 37000, convenienceFeePaise: 9000, ticketDiscountPaise: 0, discountType: null, totalPaise: 95000 })
    expect(pricing.gstLines.map((l) => [l.kind, l.description, l.amountPaise, l.gstPercent])).toEqual([
      ['ticket', '1 × Balcony', 25000, 18],
      ['ticket', '2 × Second class', 24000, 18],
      ['food', '2 × Butter Popcorn', 30000, 5],
      ['food', '1 × Chicken Puff', 7000, 5],
      ['convenience_fee', 'Convenience fee', 9000, 18],
    ])
    expect(pricing.gstLines[0].seatClass).toBe('balcony')
    expect(pricing.gstLines[1]).toMatchObject({ seatClass: 'second', qty: 2, unitPricePaise: 12000, taxablePaise: 20339, cgstPaise: 1830, sgstPaise: 1831 })
    expect(pricing.gstLines[2]).toMatchObject({ taxablePaise: 28571, cgstPaise: 714, sgstPaise: 715 })
    expect(pricing.rates).toBe(rates)
    expectExact(pricing)
  })

  it('no food: only tickets + fee', () => {
    const pricing = calculatePricing({ seats: [seat('first', 18000)], rates })
    expect(pricing.gstLines.map((l) => l.kind)).toEqual(['ticket', 'convenience_fee'])
    expect(pricing.totalPaise).toBe(21000)
    expectExact(pricing)
  })
})

describe('last-minute deal and coupons: tickets only (BR-14, BR-16)', () => {
  it('a 20% deal comes off the tickets, never off food or the fee', () => {
    const tickets = [seat('first', 18000), seat('first', 18000)]
    const paise = dealDiscount(36000, 20)
    expect(paise).toBe(7200)
    const pricing = calculatePricing({ seats: tickets, food: [{ name: 'Tea', unitPricePaise: 2000, qty: 1 }], rates, discount: { type: 'deal', paise, dealPercent: 20 } })
    expect(pricing).toMatchObject({ ticketDiscountPaise: 7200, discountType: 'deal', dealPercent: 20, couponCode: null, foodPaise: 2000, convenienceFeePaise: 6000, totalPaise: 36000 - 7200 + 2000 + 6000 })
    // GST of the ticket line is worked back from the discounted amount
    expect(pricing.gstLines[0]).toMatchObject({ amountPaise: 28800, discountPaise: 7200, ...gstSplit(28800, 18) })
    expect(pricing.gstLines[1]).toMatchObject({ kind: 'food', amountPaise: 2000, discountPaise: 0 })
    expectExact(pricing)
  })

  it('the discount is shared by the classes by their amount; the last line gets the paise left over', () => {
    // Balcony 25000 + Second 12000 = 37000; 10001 off → 25000/37000 × 10001 = 6757.4 → 6757, the rest 3244
    const pricing = calculatePricing({ seats: [seat('balcony', 25000), seat('second', 12000)], rates, discount: { type: 'coupon', paise: 10001, couponCode: 'ODD' } })
    expect(pricing.gstLines.slice(0, 2).map((l) => [l.discountPaise, l.amountPaise])).toEqual([
      [6757, 18243],
      [3244, 8756],
    ])
    expect(pricing).toMatchObject({ ticketDiscountPaise: 10001, discountType: 'coupon', couponCode: 'ODD', dealPercent: null })
    expectExact(pricing)
  })

  it('percent coupon: capped at its max discount', () => {
    expect(couponDiscount({ discountType: 'percent', value: 20 }, 36000)).toBe(7200)
    expect(couponDiscount({ discountType: 'percent', value: 20, maxDiscountPaise: 5000 }, 36000)).toBe(5000)
    expect(couponDiscount({ discountType: 'percent', value: 15 }, 12345)).toBe(1852) // 1851.75 → 1852
  })

  it('flat coupon: never more than the tickets (the total never goes below the fee + food)', () => {
    expect(couponDiscount({ discountType: 'flat', value: 5000 }, 36000)).toBe(5000)
    expect(couponDiscount({ discountType: 'flat', value: 50000 }, 12000)).toBe(12000)
    const pricing = calculatePricing({ seats: [seat('second', 12000)], rates, discount: { type: 'coupon', paise: 99999, couponCode: 'BIG' } })
    expect(pricing).toMatchObject({ ticketDiscountPaise: 12000, totalPaise: 3000 })
    expect(pricing.gstLines[0]).toMatchObject({ amountPaise: 0, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0 })
    expectExact(pricing)
  })
})

describe('rates come from settings (BR-20, A-05)', () => {
  it('copies GST rates, HSN / SAC, fee, commission and refund percents', () => {
    expect(rates).toEqual({
      gst: { ticketPercent: 18, foodPercent: 5, convenienceFeePercent: 18 },
      hsnSac: { ticket: 'T', food: 'F', convenienceFee: 'C' },
      convenienceFeePaise: 3000,
      commissionPercent: 10,
      userRefundTicketPercent: 75,
      userRefundFoodPercent: 100,
      cancelCutoffMinutes: 120,
    })
  })

  it('GST rates missing → 503 PRICES_NOT_READY (no ₹0 GST)', () => {
    const error = (() => {
      try {
        ratesFromSettings({ gst: { ticketPercent: 18, foodPercent: null, convenienceFeePercent: 18 }, convenienceFeePaise: 3000 })
      } catch (e) {
        return e
      }
    })()
    expect(error).toMatchObject({ status: 503, code: 'PRICES_NOT_READY', message: 'Prices are not ready yet. Please try again later.' })
  })
})
