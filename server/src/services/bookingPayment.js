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
import * as gateway from './payment/index.js'
import { releaseIfExpired } from './seatHold.js'

// U-16 mock payment (flow 9.4, PAY-01 … PAY-04, T-04):
//   1. createBookingOrder: an order for the amount the server calculates
//   2. payOnGateway:       the fake Razorpay page (success → paymentId + signature)
//   3. verifyAndConfirm:   signature check, then ONE confirm transaction (database.md 2)
// Not here yet: GST invoice (11.3), E-03 email, QR ticket (U-17), JOB-02.

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

  // A new order replaces older unpaid ones of this booking (only the newest can be paid)
  await Payment.updateMany({ bookingId: booking._id, status: 'created' }, { $set: { status: 'failed', failureReason: 'replaced' } })
  const amountPaise = booking.pricing.totalPaise
  const { orderId } = await gateway.createOrder({ amountPaise })
  await Payment.create({ bookingId: booking._id, userId: user._id, orderId, amountPaise, status: 'created' })
  return { orderId, amountPaise }
}

// 2. POST /api/mock-gateway/pay → { paymentId, signature } or 400 PAYMENT_FAILED (the hold stays)
export async function payOnGateway({ orderId, method, upiId, card, bank }, user) {
  const payment = await Payment.findOne({ orderId, userId: user._id })
  if (!payment) throw notFound()
  if (payment.status !== 'created') {
    throw new AppError(400, 'RULE_BROKEN', 'This payment is closed. Please start the payment again.', { rule: 'U-16', reason: 'order_closed' })
  }
  const result = await gateway.pay({ orderId, method, upiId, card, bank })
  if (!result.ok) {
    await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'failed', method, failureReason: result.reason } })
    throw new AppError(400, 'PAYMENT_FAILED', 'Payment failed. No money was taken. You can try again.', { reason: result.reason })
  }
  await Payment.updateOne({ _id: payment._id }, { $set: { method } })
  return { paymentId: result.paymentId, signature: result.signature }
}

class HoldGone extends Error {}

// Give the money back at once (mock) and close the attempt as refunded
async function refundPayment(payment, paymentId, reason, now) {
  const { refundId } = await gateway.refund({ paymentId, amountPaise: payment.amountPaise })
  await Payment.updateOne(
    { _id: payment._id },
    { $set: { status: 'refunded', paymentId }, $push: { refunds: { refundId, amountPaise: payment.amountPaise, reason, at: now } } },
  )
}

// 3. POST /api/payments/verify { orderId, paymentId, signature } → the confirmed booking.
// A bad signature is refused (T-04). Verifying the same payment again gives the booking.
export async function verifyAndConfirm({ orderId, paymentId, signature }, user, now = new Date()) {
  const payment = await Payment.findOne({ orderId, userId: user._id })
  if (!payment) throw notFound()
  if (!gateway.verifySignature({ orderId, paymentId, signature })) {
    throw new AppError(400, 'RULE_BROKEN', 'We could not check this payment. No booking was made.', { rule: 'U-16', reason: 'bad_signature' })
  }
  if (payment.status === 'success' && payment.paymentId === paymentId) return Booking.findById(payment.bookingId) // again = fine
  if (payment.status !== 'created') {
    throw new AppError(400, 'RULE_BROKEN', 'This payment is closed. Please start the payment again.', { rule: 'U-16', reason: 'order_closed' })
  }

  const booking = await Booking.findById(payment.bookingId)
  // Food or coupon changed after the order: the amount paid is not the total any more
  if (booking.status === 'pending' && booking.pricing.totalPaise !== payment.amountPaise) {
    await refundPayment(payment, paymentId, 'amount_changed', now)
    throw new AppError(400, 'RULE_BROKEN', `Your total changed while you were paying. We refunded ${rupees(payment.amountPaise)}. Please pay again.`, {
      rule: 'U-16',
      reason: 'amount_changed',
    })
  }

  try {
    await mongoose.connection.transaction(async (session) => {
      // The hold must still run: the booking and every one of its seats
      const confirmed = await Booking.updateOne(
        { _id: booking._id, status: 'pending', holdExpiresAt: { $gt: now } },
        { $set: { status: 'confirmed', confirmedAt: now }, $unset: { holdExpiresAt: 1 } },
        { session },
      )
      if (confirmed.modifiedCount !== 1) throw new HoldGone()
      const seats = await ShowSeat.updateMany({ bookingId: booking._id, status: 'held', expiresAt: { $gt: now } }, { $set: { status: 'booked' }, $unset: { expiresAt: 1 } }, { session })
      if (seats.modifiedCount !== booking.seats.length) throw new HoldGone()

      const paid = await Payment.updateOne({ _id: payment._id, status: 'created' }, { $set: { status: 'success', paymentId } }, { session })
      if (paid.modifiedCount !== 1) throw new AppError(400, 'RULE_BROKEN', 'This payment is closed. Please start the payment again.', { rule: 'U-16', reason: 'order_closed' })

      // Coupon use counted here. Honoured even if the last use went to someone else a
      // moment ago (the user saw and paid this price; decided 2026-10-06).
      if (booking.couponId) {
        await Coupon.updateOne({ _id: booking.couponId }, { $inc: { usedCount: 1 } }, { session })
        await CouponUsage.create([{ couponId: booking.couponId, userId: booking.userId, bookingId: booking._id }], { session })
      }
      await Show.updateOne({ _id: booking.showId }, { $inc: { bookedCount: booking.seats.length } }, { session })
    })
  } catch (error) {
    if (!(error instanceof HoldGone)) throw error
    // Paid, but the hold ended first: money back at once (JOB-02 is only the backup)
    await refundPayment(payment, paymentId, 'hold_expired', now)
    await releaseIfExpired(await Booking.findById(booking._id), now)
    throw holdExpired(`Your seat hold ended before the payment finished. We refunded ${rupees(payment.amountPaise)}. Please pick seats again.`)
  }

  // U-10: the seats are booked for everybody looking at the map
  emitSeatsUpdate(booking.showId, booking.seats.map((s) => ({ seatId: s.seatId, status: 'booked' })))
  return Booking.findById(booking._id)
}
