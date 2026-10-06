import { formatShortDay } from '../../validation/shows.js'
import { showTimeText } from '../public/showList.js'

// U-13 canteen page (UI-24, SF-06) helpers. Plain functions, so they are easy to test.
// The cart is an object { foodItemId: qty }. Prices shown here are only for the user;
// the server reads the real prices again when the food is saved (SEC-10).

export const PICKUPS = [
  { value: 'before_movie', label: 'Before movie' },
  { value: 'interval', label: 'Interval' },
]
export const DEFAULT_PICKUP = 'before_movie' // picked as soon as food is added (decided 2026-10-06)

// The saved food of a booking → cart (coming back to the page)
export const cartFromBooking = (food = []) => Object.fromEntries(food.map((f) => [f.foodItemId, f.qty]))

// + / − on one item: from 0 up to max (the menu's maxQtyPerItem). 0 = out of the cart.
export function changeQty(cart, foodItemId, delta, max) {
  const qty = Math.min(max, Math.max(0, (cart[foodItemId] ?? 0) + delta))
  const next = { ...cart }
  if (qty === 0) delete next[foodItemId]
  else next[foodItemId] = qty
  return next
}

// Only items that are on the menu and in stock can be sent (an item may have sold out
// or left the menu since it was picked). In menu order.
export const cartLines = (cart, items) => items.filter((item) => item.inStock && cart[item.id] > 0).map((item) => ({ foodItemId: item.id, qty: cart[item.id] }))

export function foodTotal(cart, items) {
  const priceOf = new Map(items.map((item) => [item.id, item.pricePaise]))
  return cartLines(cart, items).reduce((sum, line) => sum + priceOf.get(line.foodItemId) * line.qty, 0)
}

// "3 items" for the bottom bar
export function itemCountText(cart, items) {
  const count = cartLines(cart, items).reduce((sum, line) => sum + line.qty, 0)
  return count === 0 ? 'No food yet' : `${count} item${count === 1 ? '' : 's'}`
}

// Booking snapshot → "Tue 6 Oct · Matinee · 2:30 PM · Chandni Talkies" (IST)
export function bookingShowText(show) {
  const ist = new Date(new Date(show.startAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
  return `${formatShortDay(ist.slice(0, 10))} · ${showTimeText({ label: show.label, startTime: ist.slice(11, 16) })} · ${show.theatreName}`
}
