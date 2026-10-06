import { AppError } from '../utils/AppError.js'
import { CLASS_NAMES, SEAT_CLASSES } from '../utils/seatLayout.js'

// U-14 booking prices (SEC-10, database.md 2a, T-05). The ONE place where money is
// worked out. Plain functions (no database), so every number can be tested.
//
// - All prices include GST: tickets, food, convenience fee (BR-03, BR-20).
// - A discount is a last-minute deal OR a coupon (BR-16), on tickets only.
// - GST is calculated back per line: taxable = round(amount × 100 / (100 + rate)),
//   CGST = floor(GST / 2), SGST = the rest, so every line adds up exactly.
// - Rates are copied into the booking when the seats are held (A-05: new values only
//   for new bookings), so a later settings change never changes a running booking.

// database.md 2a: one GST-inclusive amount → taxable value + CGST + SGST
export function gstSplit(amountPaise, gstPercent) {
  const taxablePaise = Math.round((amountPaise * 100) / (100 + gstPercent))
  const gst = amountPaise - taxablePaise
  const cgstPaise = Math.floor(gst / 2)
  return { taxablePaise, cgstPaise, sgstPaise: gst - cgstPaise }
}

// The rates a booking keeps (database.md 5.11 pricing.rates). GST rates must be set
// (decided 2026-10-06): without them nobody can hold seats, and the admin sees a log line.
export function ratesFromSettings(settings) {
  const { gst } = settings
  if ([gst?.ticketPercent, gst?.foodPercent, gst?.convenienceFeePercent].some((rate) => typeof rate !== 'number')) {
    console.error('[pricing] GST rates are not set in settings (BR-20). Seat holds are refused until the admin sets them.')
    throw new AppError(503, 'PRICES_NOT_READY', 'Prices are not ready yet. Please try again later.')
  }
  return {
    gst: { ticketPercent: gst.ticketPercent, foodPercent: gst.foodPercent, convenienceFeePercent: gst.convenienceFeePercent },
    hsnSac: { ticket: gst.hsnSac?.ticket ?? null, food: gst.hsnSac?.food ?? null, convenienceFee: gst.hsnSac?.convenienceFee ?? null },
    convenienceFeePaise: settings.convenienceFeePaise, // per ticket (BR-03)
    commissionPercent: settings.commissionPercent ?? null, // BR-11 (payouts, Phase 9)
    userRefundTicketPercent: settings.userRefundTicketPercent, // BR-05
    userRefundFoodPercent: settings.userRefundFoodPercent,
  }
}

// Last-minute deal (BR-14): percent off the tickets
export const dealDiscount = (ticketsPaise, percent) => Math.round((ticketsPaise * percent) / 100)

// Coupon (A-06, U-15): percent (capped at maxDiscountPaise) or flat; never more than the tickets
export function couponDiscount(coupon, ticketsPaise) {
  const raw = coupon.discountType === 'percent' ? Math.round((ticketsPaise * coupon.value) / 100) : coupon.value
  const capped = coupon.maxDiscountPaise != null ? Math.min(raw, coupon.maxDiscountPaise) : raw
  return Math.min(capped, ticketsPaise)
}

// The discount spread over the ticket lines by their share (decided 2026-10-06);
// the last line gets the paise left over, so the parts add up exactly.
function splitDiscount(amounts, discount, total) {
  let given = 0
  return amounts.map((amount, i) => {
    const part = i === amounts.length - 1 ? discount - given : Math.floor((discount * amount) / total)
    given += part
    return part
  })
}

// amountPaise = what the line costs after its discount, GST included
function line(kind, description, qty, unitPricePaise, amountPaise, gstPercent, discountPaise = 0) {
  return { kind, description, qty, unitPricePaise, discountPaise, amountPaise, gstPercent, ...gstSplit(amountPaise, gstPercent) }
}

// The full price of a booking.
//   seats:    [{ seatClass, pricePaise }]     (snapshot from the hold)
//   food:     [{ name, unitPricePaise, qty }] (snapshot from U-13)
//   rates:    ratesFromSettings(...) copy kept in the booking
//   discount: { type: 'deal' | 'coupon' | null, paise, dealPercent?, couponCode? }
// Returns the `pricing` object of the booking (database.md 5.11).
export function calculatePricing({ seats, food = [], rates, discount = {} }) {
  const ticketsPaise = seats.reduce((sum, s) => sum + s.pricePaise, 0)
  const ticketDiscountPaise = Math.min(discount.paise ?? 0, ticketsPaise)

  // Ticket lines: one per seat class, Balcony → First → Second ("2 × First class")
  const classes = SEAT_CLASSES.map((seatClass) => ({ seatClass, seats: seats.filter((s) => s.seatClass === seatClass) })).filter((c) => c.seats.length)
  const classAmounts = classes.map((c) => c.seats.reduce((sum, s) => sum + s.pricePaise, 0))
  const parts = ticketDiscountPaise ? splitDiscount(classAmounts, ticketDiscountPaise, ticketsPaise) : classAmounts.map(() => 0)
  const ticketLines = classes.map((c, i) => ({
    seatClass: c.seatClass,
    ...line('ticket', `${c.seats.length} × ${CLASS_NAMES[c.seatClass]}`, c.seats.length, c.seats[0].pricePaise, classAmounts[i] - parts[i], rates.gst.ticketPercent, parts[i]),
  }))

  const foodLines = food.map((f) => line('food', `${f.qty} × ${f.name}`, f.qty, f.unitPricePaise, f.unitPricePaise * f.qty, rates.gst.foodPercent))
  const foodPaise = foodLines.reduce((sum, l) => sum + l.amountPaise, 0)

  const convenienceFeePaise = rates.convenienceFeePaise * seats.length
  const feeLine = line('convenience_fee', 'Convenience fee', seats.length, rates.convenienceFeePaise, convenienceFeePaise, rates.gst.convenienceFeePercent)

  const gstLines = [...ticketLines, ...foodLines, feeLine]
  return {
    ticketsPaise,
    foodPaise,
    ticketDiscountPaise,
    discountType: discount.type ?? null,
    dealPercent: discount.type === 'deal' ? discount.dealPercent : null,
    couponCode: discount.type === 'coupon' ? discount.couponCode : null,
    convenienceFeePaise,
    gstLines,
    totalPaise: gstLines.reduce((sum, l) => sum + l.amountPaise, 0),
    rates,
  }
}

// The discount kept in a booking's pricing, for the next recalculation (food change)
export const discountOf = (pricing) => ({ type: pricing.discountType ?? null, paise: pricing.ticketDiscountPaise ?? 0, dealPercent: pricing.dealPercent, couponCode: pricing.couponCode })
