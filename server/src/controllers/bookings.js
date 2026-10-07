import { Booking } from '../models/Booking.js'
import { AppError } from '../utils/AppError.js'
import { applyCoupon, availableOffers, removeCoupon } from '../services/bookingCoupon.js'
import { setBookingFood } from '../services/bookingFood.js'
import { ticketFileName } from '../services/bookingEmail.js'
import { createBookingOrder, payOnGateway, verifyAndConfirm } from '../services/bookingPayment.js'
import { ticketPdf } from '../services/pdf/ticketPdf.js'
import { qrDataUrl } from '../services/qr/index.js'
import { ticketAlbum } from '../services/ticketAlbum.js'
import { holdSeats, releaseBooking, releaseIfExpired } from '../services/seatHold.js'
import { loadShowForUsers } from './shows.js'

// /api/bookings (api.md Section 6): U-12 seat hold, U-13 food, U-14 summary (pricing in every
// answer), U-15 coupon, U-16 payment, U-17 ticket (QR + PDF).

const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this booking.')

// U-14 summary: every amount from the server (SEC-10). The rates copy stays inside
// (commission is not for users); each line has its GST rate.
function publicPricing(p) {
  return {
    ticketsPaise: p.ticketsPaise,
    foodPaise: p.foodPaise ?? 0,
    ticketDiscountPaise: p.ticketDiscountPaise ?? 0,
    discountType: p.discountType ?? null, // 'deal' · 'coupon' · null
    dealPercent: p.dealPercent ?? null,
    couponCode: p.couponCode ?? null,
    convenienceFeePaise: p.convenienceFeePaise ?? 0,
    gstLines: (p.gstLines ?? []).map((l) => ({
      kind: l.kind,
      seatClass: l.seatClass ?? null, // ticket lines
      description: l.description,
      qty: l.qty,
      unitPricePaise: l.unitPricePaise,
      discountPaise: l.discountPaise,
      amountPaise: l.amountPaise,
      gstPercent: l.gstPercent,
      taxablePaise: l.taxablePaise,
      cgstPaise: l.cgstPaise,
      sgstPaise: l.sgstPaise,
    })),
    totalPaise: p.totalPaise ?? p.ticketsPaise,
  }
}

// What the API sends
export function publicBooking(booking, now = new Date()) {
  const pending = booking.status === 'pending'
  return {
    id: String(booking._id),
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    showId: String(booking.showId),
    theatreId: String(booking.theatreId), // U-13: the canteen menu of this theatre
    holdExpiresAt: pending ? booking.holdExpiresAt : null,
    remainingSeconds: pending ? Math.max(0, Math.round((booking.holdExpiresAt - now) / 1000)) : null,
    show: booking.show,
    seats: booking.seats.map((s) => ({ seatId: s.seatId, seatClass: s.seatClass, className: s.className, pricePaise: s.pricePaise })),
    food: (booking.food ?? []).map((f) => ({ foodItemId: String(f.foodItemId), name: f.name, isVeg: f.isVeg, unitPricePaise: f.unitPricePaise, qty: f.qty })),
    foodPickup: booking.foodPickup ?? null,
    pricing: publicPricing(booking.pricing),
    confirmedAt: booking.confirmedAt ?? null,
    invoiceId: booking.invoiceId ? String(booking.invoiceId) : null, // U-17 GST invoice PDF
  }
}

// U-17: a confirmed booking also gets its signed QR picture (SEC-09)
async function ticketView(booking) {
  const view = publicBooking(booking)
  if (booking.status === 'confirmed') view.qrDataUrl = await qrDataUrl(booking)
  return view
}

// Only the user's own bookings; someone else's looks the same as a missing one
async function findOwn(req) {
  const booking = await Booking.findById(req.valid.params.id)
  if (!booking || String(booking.userId) !== String(req.user._id)) throw notFound()
  return booking
}

// POST /api/bookings/hold { showId, seatIds } → 201 { booking } (pending, holdExpiresAt)
export async function hold(req, res) {
  const { showId, seatIds } = req.valid.body
  const { show, problem } = await loadShowForUsers(showId)
  if (problem === 'missing') throw new AppError(404, 'NOT_FOUND', 'We could not find this show.')
  if (problem === 'closed') throw new AppError(400, 'RULE_BROKEN', 'This show has started or was cancelled, so seats cannot be booked.', { rule: 'U-12', reason: 'show_closed' })

  const booking = await holdSeats({ show, user: req.user, seatIds })
  res.status(201).json({ booking: publicBooking(booking) })
}

// GET /api/bookings/:id (own). A hold whose time is over shows as released.
export async function getBooking(req, res) {
  const booking = await releaseIfExpired(await findOwn(req))
  res.json({ booking: await ticketView(booking) })
}

// DELETE /api/bookings/:id/hold (own): "Give up seats" (9.2) → released, seats free.
// Calling it again, or after the time ran out, is fine.
export async function giveUpHold(req, res) {
  const booking = await findOwn(req)
  if (booking.status !== 'pending' && booking.status !== 'released') {
    throw new AppError(400, 'RULE_BROKEN', 'This booking is not a seat hold any more.', { rule: 'U-12', reason: 'not_pending' })
  }
  await releaseBooking(booking._id)
  res.json({ booking: publicBooking(await Booking.findById(booking._id)) })
}

// PUT /api/bookings/:id/food { items: [{ foodItemId, qty }], pickup } (U-13, SF-06):
// replaces the food list while the hold runs. Empty list = no food.
export async function setFood(req, res) {
  const booking = await setBookingFood(await findOwn(req), req.valid.body)
  res.json({ booking: publicBooking(booking) })
}

// PUT /api/bookings/:id/coupon { code } (U-15, BR-16): tickets only, while the hold runs
export async function setCoupon(req, res) {
  const booking = await applyCoupon(await findOwn(req), req.valid.body.code, req.user)
  res.json({ booking: publicBooking(booking) })
}

// DELETE /api/bookings/:id/coupon: back to the price without the coupon
export async function deleteCoupon(req, res) {
  const booking = await removeCoupon(await findOwn(req))
  res.json({ booking: publicBooking(booking) })
}

// GET /api/bookings/:id/offers (U-15 Available offers): { offers } for this hold
export async function getOffers(req, res) {
  res.json({ offers: await availableOffers(await findOwn(req), req.user) })
}

// U-16 POST /api/bookings/:id/payments → 201 { orderId, amountPaise } (amount from the server)
export async function createPayment(req, res) {
  res.status(201).json(await createBookingOrder(await findOwn(req), req.user))
}

// U-16 POST /api/mock-gateway/pay: the fake Razorpay page → { paymentId, signature }
export async function gatewayPay(req, res) {
  res.json(await payOnGateway(req.valid.body, req.user))
}

// U-16 POST /api/payments/verify → { booking } (confirmed)
export async function verifyPayment(req, res) {
  res.json({ booking: await ticketView(await verifyAndConfirm(req.valid.body, req.user)) })
}

// U-18 GET /api/bookings?tab=upcoming|past&page&limit: the ticket album
export async function listBookings(req, res) {
  res.json(await ticketAlbum(req.user._id, req.valid.query))
}

// U-17 GET /api/bookings/:id/ticket.pdf (own, confirmed only)
export async function getTicketPdf(req, res) {
  const booking = await findOwn(req)
  if (booking.status !== 'confirmed') {
    throw new AppError(400, 'RULE_BROKEN', 'A ticket is ready only for a confirmed booking.', { rule: 'U-17', reason: 'not_confirmed' })
  }
  sendPdf(res, ticketFileName(booking), await ticketPdf(booking))
}

// A PDF download (the page saves it with this file name)
export function sendPdf(res, fileName, pdf) {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store' })
  res.send(pdf)
}
