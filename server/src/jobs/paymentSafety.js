import { STUCK_ORDER_MINUTES, VERIFY_GRACE_MINUTES } from '../config/payment.js'
import { getSettings } from '../models/Settings.js'
import { Payment } from '../models/Payment.js'
import { settleCapturedPayment } from '../services/bookingPayment.js'
import { releaseBooking } from '../services/seatHold.js'

// JOB-02 payment safety check (every 5 minutes, PAY-05):
//  1. Paid at the gateway (captured) but never verified, e.g. the browser closed after
//     paying: confirm if the seats can still be kept, else refund + email
//     (services/bookingPayment.js settleCapturedPayment). Waits VERIFY_GRACE_MINUTES first.
//  2. Orders never paid, older than max(STUCK_ORDER_MINUTES, seat hold time) → failed
//     ('timeout'); a booking still pending is released and its seats freed (+ pushed).
// `now` can be given by tests. One payment going wrong is logged and does not stop the rest.
const MIN = 60 * 1000

export async function paymentSafetyCheck(now = new Date()) {
  const counts = { confirmed: 0, refunded: 0, failed: 0, released: 0 }

  // 1. Captured, not verified
  const captured = await Payment.find({ status: 'created', capturedAt: { $lte: new Date(now - VERIFY_GRACE_MINUTES * MIN) } })
  for (const payment of captured) {
    try {
      const { result, reason } = await settleCapturedPayment(payment, now)
      if (result === 'skipped') continue
      counts[result]++
      console.log(`[JOB-02] payment ${payment.orderId}: ${result}${reason ? ` (${reason})` : ''}`)
    } catch (error) {
      console.error(`[JOB-02] payment ${payment.orderId} failed: ${error.message}`)
    }
  }

  // 2. Never paid
  const { holdMinutes } = await getSettings()
  const cutoff = new Date(now - Math.max(STUCK_ORDER_MINUTES, holdMinutes) * MIN)
  const stuck = await Payment.find({ status: 'created', capturedAt: { $exists: false }, createdAt: { $lte: cutoff } }, '_id bookingId')
  for (const payment of stuck) {
    // Same check again in the update: the user may pay at this very moment
    const failed = await Payment.updateOne({ _id: payment._id, status: 'created', capturedAt: { $exists: false } }, { $set: { status: 'failed', failureReason: 'timeout' } })
    if (failed.modifiedCount !== 1) continue
    counts.failed++
    if (await releaseBooking(payment.bookingId, now)) counts.released++
  }

  return counts
}
