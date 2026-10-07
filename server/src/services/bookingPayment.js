import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { Coupon } from '../models/Coupon.js'
import { CouponUsage } from '../models/CouponUsage.js'
import { Payment } from '../models/Payment.js'
import { Show } from '../models/Show.js'
import { ShowSeat } from '../models/ShowSeat.js'
import { emitSeatsUpdate } from '../sockets/index.js'
import { AppError } from '../utils/AppError.js'
import { couponProblem, removeCoupon } from './bookingCoupon.js'
import { sendBookingConfirmedEmail, sendPaymentRefundedEmail } from './bookingEmail.js'
import { createInvoice } from './invoice.js'
import * as gateway from './payment/index.js'
import { releaseIfExpired } from './seatHold.js'

// U-16 mock payment (flow 9.4, PAY-01 … PAY-04, T-04):
//   1. createBookingOrder: an order for the amount the server calculates
//   2. payOnGateway:       the fake Razorpay page (success → paymentId + signature). It also
//                          saves paymentId + capturedAt, like Razorpay's "payment captured"
//                          webhook, so the server knows about the money (JOB-02)
//   3. verifyAndConfirm:   signature check, then ONE confirm transaction (database.md 2)
//      … with the GST invoice (11.3, U-17); after it the E-03 email (ticket + invoice).
//   JOB-02 (jobs/paymentSafety.js) uses settleCapturedPayment for payments that were
//   captured but never verified (browser closed after paying).
// Every payment change checks `status: 'created'` first, so the verify call and JOB-02
// can never both confirm or refund the same payment.

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', paise % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})}`
const holdExpired = (message = 'Your seat hold time is over. Please pick seats again.') => new AppError(409, 'HOLD_EXPIRED', message)
const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this payment.')

// 1. POST /api/bookings/:id/payments → { orderId, amountPaise }
export async function createBookingOrder(booking, user, now = new Date()) {
  booking = await releaseIfExpired(booking, now)
  if (booking.status === 'confirmed') throw new AppError(400, 'RULE_BROKEN', 'This booking is already paid.', { rule: 'U-16', reason: 'already_paid' })
  if (booking.status !== 'pending') throw holdExpired()

  // U-15: the coupon is checked once more. If it stopped working it is taken off and the
  // user sees the new total before paying.
  if (booking.couponId) {
    const coupon = await Coupon.findById(booking.couponId)
    const problem = coupon ? await couponProblem(coupon, booking, user, now) : new AppError(400, 'COUPON_INVALID', 'This coupon is not available any more.', { reason: 'not_found' })
    if (problem) {
      const updated = await removeCoupon(booking, now)
      throw new AppError(400, 'COUPON_INVALID', `${problem.message} It was removed. Your new total is ${rupees(updated.pricing.totalPaise)}.`, {
        ...problem.details,
        removed: true,
        totalPaise: updated.pricing.totalPaise,
      })
    }
  }

  // Already paid at the gateway but not confirmed yet (e.g. the verify call got lost):
  // no second payment; JOB-02 confirms it (or refunds) within a few minutes
  if (await Payment.exists({ bookingId: booking._id, status: 'created', capturedAt: { $exists: true } })) {
    throw new AppError(400, 'RULE_BROKEN', 'Your payment went through. We are confirming your booking, please check again in a few minutes.', { rule: 'JOB-02', reason: 'payment_pending' })
  }

  // A new order replaces older unpaid ones of this booking (only the newest can be paid)
  await Payment.updateMany({ bookingId: booking._id, status: 'created' }, { $set: { status: 'failed', failureReason: 'replaced' } })
  const amountPaise = booking.pricing.totalPaise
  const { orderId } = await gateway.createOrder({ amountPaise })
  await Payment.create({ bookingId: booking._id, userId: user._id, orderId, amountPaise, status: 'created' })
  return { orderId, amountPaise }
}

// 2. POST /api/mock-gateway/pay → { paymentId, signature } or 400 PAYMENT_FAILED (the hold stays)
export async function payOnGateway({ orderId, method, upiId, card, bank }, user, now = new Date()) {
  const payment = await Payment.findOne({ orderId, userId: user._id })
  if (!payment) throw notFound()
  if (payment.capturedAt) {
    // An order can be paid only once (like Razorpay)
    throw new AppError(400, 'RULE_BROKEN', 'This order is already paid. Your booking will be confirmed in a few minutes.', { rule: 'U-16', reason: 'already_paid' })
  }
  if (payment.status !== 'created') throw closedPayment(payment)
  const result = await gateway.pay({ orderId, method, upiId, card, bank })
  if (!result.ok) {
    await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'failed', method, failureReason: result.reason } })
    throw new AppError(400, 'PAYMENT_FAILED', 'Payment failed. No money was taken. You can try again.', { reason: result.reason })
  }
  // Mock "payment captured" webhook: the money is taken, the booking is not confirmed yet
  // Only while the order is open: JOB-02 may have failed it during the payment ('timeout')
  const captured = await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { method, paymentId: result.paymentId, capturedAt: now } })
  if (captured.modifiedCount !== 1) {
    await gateway.refund({ paymentId: result.paymentId, amountPaise: payment.amountPaise }) // the money goes straight back
    throw new AppError(400, 'RULE_BROKEN', `This payment was closed while you were paying. We refunded ${rupees(payment.amountPaise)}. Please start again.`, { rule: 'U-16', reason: 'order_closed' })
  }
  return { paymentId: result.paymentId, signature: result.signature }
}

// The error for a payment that is not open any more (refunded → says how much came back)
function closedPayment(payment) {
  if (payment.status === 'refunded') {
    return new AppError(400, 'RULE_BROKEN', `This payment was refunded: ${rupees(payment.amountPaise)}. No booking was made. Please start again.`, { rule: 'U-16', reason: 'refunded' })
  }
  return new AppError(400, 'RULE_BROKEN', 'This payment is closed. Please start the payment again.', { rule: 'U-16', reason: 'order_closed' })
}

class HoldGone extends Error {}
class PaymentTaken extends Error {} // JOB-02 or the verify call was first

// Give the money back at once (mock) and close the attempt as refunded.
// Only while the payment is still open → true when this call refunded it.
async function refundPayment(payment, paymentId, reason, now) {
  const closed = await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'refunded', paymentId } })
  if (closed.modifiedCount !== 1) return false
  const { refundId } = await gateway.refund({ paymentId, amountPaise: payment.amountPaise })
  await Payment.updateOne({ _id: payment._id }, { $push: { refunds: { refundId, amountPaise: payment.amountPaise, reason, at: now } } })
  return true
}

// THE confirm transaction (database.md 2), used by verify and by JOB-02.
//   rebook = false: the hold must still run (the booking and every one of its seats).
//   rebook = true (JOB-02, hold over): the seats are taken again if they are still free;
//                 the unique seat index decides (someone else's seat → duplicate key).
async function confirmPaidBooking(booking, payment, paymentId, now, { rebook = false } = {}) {
  await mongoose.connection.transaction(async (session) => {
    if (rebook) {
      const confirmed = await Booking.updateOne(
        { _id: booking._id, status: { $in: ['pending', 'released'] } },
        { $set: { status: 'confirmed', confirmedAt: now }, $unset: { holdExpiresAt: 1, releasedAt: 1 } },
        { session },
      )
      if (confirmed.modifiedCount !== 1) throw new HoldGone()
      const seatIds = booking.seats.map((s) => s.seatId)
      // Our own old held seats, and anybody's expired holds on these seats, make room
      await ShowSeat.deleteMany({ bookingId: booking._id, status: 'held' }, { session })
      await ShowSeat.deleteMany({ showId: booking.showId, seatId: { $in: seatIds }, status: 'held', expiresAt: { $lte: now } }, { session })
      await ShowSeat.insertMany(
        seatIds.map((seatId) => ({ showId: booking.showId, seatId, status: 'booked', bookingId: booking._id, userId: booking.userId })),
        { session },
      )
    } else {
      const confirmed = await Booking.updateOne(
        { _id: booking._id, status: 'pending', holdExpiresAt: { $gt: now } },
        { $set: { status: 'confirmed', confirmedAt: now }, $unset: { holdExpiresAt: 1 } },
        { session },
      )
      if (confirmed.modifiedCount !== 1) throw new HoldGone()
      const seats = await ShowSeat.updateMany({ bookingId: booking._id, status: 'held', expiresAt: { $gt: now } }, { $set: { status: 'booked' }, $unset: { expiresAt: 1 } }, { session })
      if (seats.modifiedCount !== booking.seats.length) throw new HoldGone()
    }

    const paid = await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'success', paymentId } }, { session })
    if (paid.modifiedCount !== 1) throw new PaymentTaken()

    // Coupon use counted here. Honoured even if the last use went to someone else a
    // moment ago (the user saw and paid this price; decided 2026-10-06).
    if (booking.couponId) {
      await Coupon.updateOne({ _id: booking.couponId }, { $inc: { usedCount: 1 } }, { session })
      await CouponUsage.create([{ couponId: booking.couponId, userId: booking.userId, bookingId: booking._id }], { session })
    }
    await Show.updateOne({ _id: booking.showId }, { $inc: { bookedCount: booking.seats.length } }, { session })

    // 11.3 GST invoice: its number is used only when the whole confirm succeeds
    const invoice = await createInvoice(booking, { session, now })
    await Booking.updateOne({ _id: booking._id }, { $set: { invoiceId: invoice._id } }, { session })
  })

  // U-10: the seats are booked for everybody looking at the map
  emitSeatsUpdate(booking.showId, booking.seats.map((s) => ({ seatId: s.seatId, status: 'booked' })))
  const confirmed = await Booking.findById(booking._id)
  // E-03 in the background: the booking stays confirmed even if the email fails
  sendBookingConfirmedEmail(confirmed).catch((error) => console.error(`[email] E-03 for booking ${confirmed.bookingNumber} failed: ${error.message}`))
  return confirmed
}

// 3. POST /api/payments/verify { orderId, paymentId, signature } → the confirmed booking.
// A bad signature is refused (T-04). Verifying the same payment again gives the booking.
export async function verifyAndConfirm({ orderId, paymentId, signature }, user, now = new Date()) {
  const payment = await Payment.findOne({ orderId, userId: user._id })
  if (!payment) throw notFound()
  if (!gateway.verifySignature({ orderId, paymentId, signature })) {
    throw new AppError(400, 'RULE_BROKEN', 'We could not check this payment. No booking was made.', { rule: 'U-16', reason: 'bad_signature' })
  }
  // Again = fine (also when JOB-02 confirmed it first)
  if (payment.status === 'success' && payment.paymentId === paymentId) return Booking.findById(payment.bookingId)
  if (payment.status !== 'created') throw closedPayment(payment)

  const booking = await Booking.findById(payment.bookingId)
  // Food or coupon changed after the order: the amount paid is not the total any more
  if (booking.status === 'pending' && booking.pricing.totalPaise !== payment.amountPaise) {
    if (!(await refundPayment(payment, paymentId, 'amount_changed', now))) return afterSomeoneElse(payment, paymentId)
    throw new AppError(400, 'RULE_BROKEN', `Your total changed while you were paying. We refunded ${rupees(payment.amountPaise)}. Please pay again.`, {
      rule: 'U-16',
      reason: 'amount_changed',
    })
  }

  try {
    return await confirmPaidBooking(booking, payment, paymentId, now)
  } catch (error) {
    if (error instanceof PaymentTaken) return afterSomeoneElse(payment, paymentId)
    if (!(error instanceof HoldGone)) throw error
    // Paid, but the hold ended first: money back at once (JOB-02 is only the backup)
    if (!(await refundPayment(payment, paymentId, 'hold_expired', now))) return afterSomeoneElse(payment, paymentId)
    await releaseIfExpired(await Booking.findById(booking._id), now)
    throw holdExpired(`Your seat hold ended before the payment finished. We refunded ${rupees(payment.amountPaise)}. Please pick seats again.`)
  }
}

// JOB-02 settled this payment at the same moment: answer with what it did
async function afterSomeoneElse(payment, paymentId) {
  const fresh = await Payment.findById(payment._id)
  if (fresh.status === 'success' && fresh.paymentId === paymentId) return Booking.findById(fresh.bookingId)
  throw closedPayment(fresh)
}

// JOB-02 part 1: a payment captured at the gateway but never verified.
// → { result: 'confirmed' | 'refunded' | 'skipped', reason? }
//   hold still running + same amount         → confirm (invoice + E-03)
//   hold over, seats still free, show ahead  → take the seats again and confirm
//   seats taken / show started or cancelled / amount changed → refund + "Payment refunded" email
export async function settleCapturedPayment(payment, now = new Date()) {
  const booking = await Booking.findById(payment.bookingId)
  const refund = async (reason) => {
    if (!(await refundPayment(payment, payment.paymentId, reason, now))) return { result: 'skipped' }
    await releaseIfExpired(booking, now) // a hold that still runs stays (amount changed: the user can pay again)
    sendPaymentRefundedEmail(booking, payment).catch((error) => console.error(`[email] refund email for booking ${booking.bookingNumber} failed: ${error.message}`))
    return { result: 'refunded', reason }
  }

  if (!['pending', 'released'].includes(booking.status)) return refund('booking_closed')
  if (booking.pricing.totalPaise !== payment.amountPaise) return refund('amount_changed')

  const holdRuns = booking.status === 'pending' && booking.holdExpiresAt > now
  if (!holdRuns) {
    const show = await Show.findById(booking.showId, 'status startAt')
    if (!show || show.status !== 'scheduled' || show.startAt <= now) return refund('show_closed')
  }
  try {
    await confirmPaidBooking(booking, payment, payment.paymentId, now, { rebook: !holdRuns })
    return { result: 'confirmed' }
  } catch (error) {
    if (error instanceof PaymentTaken) return { result: 'skipped' } // the verify call was first
    if (error instanceof HoldGone || error?.code === 11000) return refund('seats_taken')
    throw error
  }
}
