import { describe, expect, it } from 'vitest'
import { bookingShowText, cartFromBooking, cartLines, changeQty, foodTotal, itemCountText } from './food.js'

// U-13 canteen page helpers (UI-24, SF-06)
const items = [
  { id: 'pop', name: 'Butter Popcorn', pricePaise: 15000, inStock: true },
  { id: 'sam', name: 'Samosa (2 pcs)', pricePaise: 6000, inStock: true },
  { id: 'cof', name: 'Filter Coffee', pricePaise: 4000, inStock: false },
]

describe('quantity + / − (U-13)', () => {
  it('adds and removes; 0 takes the item out of the cart', () => {
    let cart = changeQty({}, 'pop', +1, 10)
    cart = changeQty(cart, 'pop', +1, 10)
    expect(cart).toEqual({ pop: 2 })
    cart = changeQty(cart, 'pop', -1, 10)
    cart = changeQty(cart, 'pop', -1, 10)
    expect(cart).toEqual({})
    expect(changeQty({}, 'pop', -1, 10)).toEqual({}) // never below 0
  })

  it('stops at the most per item and does not change the old cart', () => {
    const full = { sam: 10 }
    expect(changeQty(full, 'sam', +1, 10)).toEqual({ sam: 10 })
    expect(full).toEqual({ sam: 10 })
  })
})

describe('cart lines and totals', () => {
  it('sends only in-stock menu items, in menu order', () => {
    const cart = { sam: 2, pop: 1, cof: 3, gone: 1 }
    expect(cartLines(cart, items)).toEqual([
      { foodItemId: 'pop', qty: 1 },
      { foodItemId: 'sam', qty: 2 },
    ])
    expect(foodTotal(cart, items)).toBe(27000)
    expect(itemCountText(cart, items)).toBe('3 items')
  })

  it('empty cart', () => {
    expect(cartLines({}, items)).toEqual([])
    expect(foodTotal({}, items)).toBe(0)
    expect(itemCountText({}, items)).toBe('No food yet')
    expect(itemCountText({ pop: 1 }, items)).toBe('1 item')
  })

  it('the saved food of a booking comes back as the cart', () => {
    expect(cartFromBooking([{ foodItemId: 'pop', qty: 2, name: 'Butter Popcorn' }])).toEqual({ pop: 2 })
    expect(cartFromBooking(undefined)).toEqual({})
  })
})

describe('show line from the booking snapshot', () => {
  it('uses IST: 09:00 UTC = 2:30 PM IST', () => {
    expect(bookingShowText({ startAt: '2026-10-06T09:00:00.000Z', label: 'matinee', theatreName: 'Chandni Talkies' })).toBe('Tue 6 Oct · Matinee · 2:30 PM · Chandni Talkies')
    expect(bookingShowText({ startAt: '2026-10-06T19:00:00.000Z', label: 'second', theatreName: 'Roopa' })).toMatch(/^Wed 7 Oct · Second show · 12:30 AM/)
  })
})
