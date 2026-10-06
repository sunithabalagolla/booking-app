import { getSettings } from '../models/Settings.js'
import { calculatePricing, discountOf, ratesFromSettings } from './pricing.js'

// U-14: the price of a booking again after a change (food, coupon). Seats, food and the
// discount come from the booking unless `changes` gives new ones. The rates are the
// booking's own copy from hold time (A-05).
export async function bookingPricing(booking, changes = {}) {
  const current = booking.pricing ?? {}
  // A hold made before U-14 has no copy of the rates yet: take today's settings once
  const rates = current.rates?.gst?.ticketPercent != null ? toPlain(current.rates) : ratesFromSettings(await getSettings())
  return calculatePricing({
    seats: booking.seats,
    food: changes.food ?? booking.food ?? [],
    rates,
    discount: changes.discount ?? discountOf(current),
  })
}

const toPlain = (value) => (typeof value?.toObject === 'function' ? value.toObject() : value)
