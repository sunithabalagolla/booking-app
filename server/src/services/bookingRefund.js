import { Booking } from '../models/Booking.js'
import { Payment } from '../models/Payment.js'
import * as gateway from './payment/index.js'

// Sends the refund of a cancelled booking through the gateway (U-20, O-06, JOB-04).
// The payment gets the refund entry (PAY-04) and the booking `refundStatus: done`.
//
// The cancel request and JOB-04 may try the same booking at the same moment, so the
// refund is CLAIMED first (refundLockUntil). Only the one that wins the claim calls the
// gateway. A crash in between leaves the lock; it runs out after LOCK_MS and JOB-04
// tries again.
// → 'done' · 'failed' (left pending, JOB-04 tries again) · 'busy' (someone else has it)

const LOCK_MS = 2 * 60 * 1000

export const REFUND_REASONS = { cancelled: 'user_cancelled', cancelled_by_theatre: 'show_cancelled' }

export async function sendBookingRefund(booking, now = new Date()) {
  const claimed = await Booking.updateOne(
    {
      _id: booking._id,
      'cancellation.refundStatus': 'pending',
      $or: [{ 'cancellation.refundLockUntil': { $exists: false } }, { 'cancellation.refundLockUntil': { $lte: now } }],
    },
    { $set: { 'cancellation.refundLockUntil': new Date(now.getTime() + LOCK_MS) } },
  )
  if (claimed.modifiedCount !== 1) return 'busy'

  const fresh = await Booking.findById(booking._id) // the credit note may be newer than `booking`
  const { refundPaise, creditNoteId } = fresh.cancellation
  const finish = (set) => Booking.updateOne({ _id: booking._id }, { $set: set, $unset: { 'cancellation.refundLockUntil': 1 } })

  if (refundPaise === 0) {
    await finish({ 'cancellation.refundStatus': 'done' })
    return 'done'
  }
  const payment = await Payment.findOne({ bookingId: booking._id, status: 'success' })
  if (!payment) {
    // Nothing to refund through the gateway (e.g. a payment already refunded): stays pending, logged
    console.error(`[refund] booking ${fresh.bookingNumber}: no successful payment found, refund left pending`)
    await finish({})
    return 'failed'
  }
  try {
    const { refundId } = await gateway.refund({ paymentId: payment.paymentId, amountPaise: refundPaise })
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: { status: refundPaise >= payment.amountPaise ? 'refunded' : 'partially_refunded' },
        $push: { refunds: { refundId, amountPaise: refundPaise, reason: REFUND_REASONS[fresh.status], at: now, creditNoteId } },
      },
    )
    await finish({ 'cancellation.refundStatus': 'done' })
    return 'done'
  } catch (error) {
    console.error(`[refund] booking ${fresh.bookingNumber} failed, left pending: ${error.message}`)
    await finish({})
    return 'failed'
  }
}
