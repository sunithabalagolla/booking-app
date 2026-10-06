import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import { couponFormSchema, couponToForm, EMPTY_COUPON, endsText, formToBody, offerText, usedText, whereText } from './coupons.js'

// A-06 coupon form + U-15 offer texts

const form = (fields) => ({ ...EMPTY_COUPON, code: 'talkies20', value: '20', startDate: '2026-10-06', endDate: '2026-11-05', ...fields })
const check = (fields) => {
  const result = couponFormSchema.safeParse(form(fields))
  return result.success ? {} : fieldErrors(result.error)
}

describe('coupon form (A-06)', () => {
  it('checks the fields', () => {
    expect(check({})).toEqual({})
    expect(check({ code: 'ab' })).toHaveProperty('code')
    expect(check({ code: 'TALKIES 20' })).toHaveProperty('code')
    expect(check({ value: '101' })).toEqual({ value: 'A percent is 1 to 100.' })
    expect(check({ discountType: 'flat', value: '5001' })).toEqual({ value: 'Whole rupees, ₹1 to ₹5,000.' })
    expect(check({ value: '2.5' })).toHaveProperty('value')
    expect(check({ maxDiscount: '0' })).toHaveProperty('maxDiscount')
    expect(check({ totalLimit: 'x' })).toHaveProperty('totalLimit')
    expect(check({ endDate: '2026-10-01' })).toEqual({ endDate: 'The end date must be on or after the start date.' })
    expect(check({ endDate: '' })).toHaveProperty('endDate')
  })

  it('form → body: rupees to paise, empty = null, code only when new', () => {
    expect(formToBody(form({ maxDiscount: '100', minAmount: '200', isPublic: true }), { isNew: true })).toEqual({
      code: 'TALKIES20',
      discountType: 'percent',
      value: 20,
      maxDiscountPaise: 10000,
      minAmountPaise: 20000,
      startDate: '2026-10-06',
      endDate: '2026-11-05',
      totalLimit: null,
      perUserLimit: null,
      cityCodes: [],
      theatreIds: [],
      isPublic: true,
    })
    const flat = formToBody(form({ discountType: 'flat', value: '50', maxDiscount: '100', perUserLimit: '1' }), { isNew: false })
    expect(flat).toMatchObject({ value: 5000, maxDiscountPaise: null, perUserLimit: 1 })
    expect(flat).not.toHaveProperty('code')
  })

  it('coupon → form and back gives the same body', () => {
    const coupon = { code: 'FLAT50', discountType: 'flat', value: 5000, maxDiscountPaise: null, minAmountPaise: 30000, startDate: '2026-10-06', endDate: '2026-12-31', totalLimit: 100, perUserLimit: 1, cityCodes: ['hyderabad'], theatreIds: ['t1'], isPublic: false }
    const back = formToBody(couponToForm(coupon), { isNew: true })
    expect(back).toEqual({ ...coupon })
  })
})

describe('texts', () => {
  it('offer text', () => {
    expect(offerText({ discountType: 'percent', value: 20, maxDiscountPaise: 10000, minAmountPaise: 20000 })).toBe('20% off tickets, up to ₹100 · tickets ₹200 or more')
    expect(offerText({ discountType: 'percent', value: 15, maxDiscountPaise: null, minAmountPaise: null })).toBe('15% off tickets')
    expect(offerText({ discountType: 'flat', value: 5000, maxDiscountPaise: null, minAmountPaise: null })).toBe('₹50 off tickets')
  })

  it('used, where, ends', () => {
    expect(usedText({ usedCount: 3, totalLimit: 100 })).toBe('Used 3 / 100')
    expect(usedText({ usedCount: 3, totalLimit: null })).toBe('Used 3')
    expect(whereText({ cityCodes: [], theatreIds: [] })).toBe('All cities')
    expect(whereText({ cityCodes: ['hyderabad', 'chennai'], theatreIds: [] }, { hyderabad: 'Hyderabad', chennai: 'Chennai' })).toBe('Hyderabad, Chennai')
    expect(whereText({ cityCodes: ['hyderabad'], theatreIds: ['t1'] }, {}, { t1: 'Chandni Talkies' })).toBe('Chandni Talkies')
    expect(endsText('2027-01-04T18:29:59.999Z')).toBe('Ends Mon 4 Jan')
  })
})
