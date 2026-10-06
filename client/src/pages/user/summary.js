import { formatRupees } from '../../validation/food.js'
import { sortSeatIds } from './seats.js'

// U-14 booking summary (UI-23 bill) helpers. Every amount comes from the server
// (booking.pricing, SEC-10); these only arrange it for the page.

const PICKUP_NAMES = { before_movie: 'Before movie', interval: 'Interval' }
const KIND_NAMES = { ticket: 'Tickets', food: 'Food', convenience_fee: 'Convenience fee' }

// The bill lines, top to bottom: tickets per class (before the discount, with the seat
// numbers), the discount, food, the fee. amountPaise < 0 = discount.
export function billRows(booking) {
  const { pricing } = booking
  const rows = []
  for (const l of pricing.gstLines.filter((g) => g.kind === 'ticket')) {
    const seatIds = sortSeatIds(booking.seats.filter((s) => s.seatClass === l.seatClass).map((s) => s.seatId))
    rows.push({ key: `ticket-${l.seatClass}`, text: l.description, note: `${seatIds.join(', ')} · ${formatRupees(l.unitPricePaise)} each`, amountPaise: l.unitPricePaise * l.qty })
  }
  if (pricing.ticketDiscountPaise > 0) {
    const text = pricing.discountType === 'deal' ? `Special offer ${pricing.dealPercent}% off tickets` : `Coupon ${pricing.couponCode}`
    rows.push({ key: 'discount', text, amountPaise: -pricing.ticketDiscountPaise, discount: true })
  }
  for (const l of pricing.gstLines.filter((g) => g.kind === 'food')) {
    rows.push({ key: `food-${l.description}`, text: l.description, note: `${formatRupees(l.unitPricePaise)} each`, amountPaise: l.amountPaise })
  }
  const fee = pricing.gstLines.find((g) => g.kind === 'convenience_fee')
  if (fee) rows.push({ key: 'fee', text: 'Convenience fee', note: `${fee.qty} × ${formatRupees(fee.unitPricePaise)}`, amountPaise: fee.amountPaise })
  return rows
}

export const pickupText = (booking) => (booking.food?.length && booking.foodPickup ? `Food pickup: ${PICKUP_NAMES[booking.foodPickup]}` : null)

// "GST included in the total": one row per kind + rate (Tickets 18%, Food 5%, …)
export function gstRows(gstLines) {
  const rows = new Map()
  for (const l of gstLines) {
    const key = `${l.kind}-${l.gstPercent}`
    const row = rows.get(key) ?? { key, text: `${KIND_NAMES[l.kind]} (${l.gstPercent}%)`, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0 }
    row.taxablePaise += l.taxablePaise
    row.cgstPaise += l.cgstPaise
    row.sgstPaise += l.sgstPaise
    rows.set(key, row)
  }
  return [...rows.values()]
}

// "−₹100" for discounts, "₹360" otherwise
export const signedRupees = (paise) => (paise < 0 ? `−${formatRupees(-paise)}` : formatRupees(paise))
