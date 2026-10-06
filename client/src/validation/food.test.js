import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import { EMPTY_FOOD, foodFormSchema, foodToForm, formatRupees, formToBody } from './food.js'

// O-07 canteen item form
const good = { ...EMPTY_FOOD, name: ' Butter Popcorn ', price: '150', isVeg: 'veg' }

describe('foodFormSchema (O-07)', () => {
  it('a good item → body with the price in paise', () => {
    expect(formToBody(foodFormSchema.parse(good))).toEqual({ name: 'Butter Popcorn', photoUrl: '', pricePaise: 15000, isVeg: true, inStock: true, isCombo: false })
  })

  it('gives a message for each empty required field', () => {
    expect(Object.keys(fieldErrors(foodFormSchema.safeParse(EMPTY_FOOD).error)).sort()).toEqual(['isVeg', 'name', 'price'])
  })

  it('price: whole rupees from ₹1 to ₹5,000 only', () => {
    for (const price of ['0', '49.50', '5001', '-5', 'abc']) {
      expect(fieldErrors(foodFormSchema.safeParse({ ...good, price }).error).price, price).toMatch(/whole rupees/)
    }
    expect(foodFormSchema.safeParse({ ...good, price: '5000' }).success).toBe(true)
  })

  it('an item from the API → form → the same body', () => {
    const item = { name: 'Chicken Puff', photoUrl: null, pricePaise: 7000, isVeg: false, inStock: false, isCombo: true }
    const form = foodToForm(item)
    expect(form).toMatchObject({ price: '70', isVeg: 'nonveg', photoUrl: '' })
    expect(formToBody(foodFormSchema.parse(form))).toEqual({ ...item, photoUrl: '' })
  })
})

describe('formatRupees', () => {
  it('shows rupees with Indian digit groups', () => {
    expect(formatRupees(15000)).toBe('₹150')
    expect(formatRupees(500000)).toBe('₹5,000')
    expect(formatRupees(12345600)).toBe('₹1,23,456')
  })

  it('with paise: always 2 decimals (GST box, 2026-10-06 bug)', () => {
    expect(formatRupees(3810)).toBe('₹38.10')
    expect(formatRupees(3813)).toBe('₹38.13')
    expect(formatRupees(5)).toBe('₹0.05')
    expect(formatRupees(12345601)).toBe('₹1,23,456.01')
    expect(formatRupees(0)).toBe('₹0')
  })
})
