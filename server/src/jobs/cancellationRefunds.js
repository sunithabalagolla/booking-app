import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { Invoice } from '../models/Invoice.js'
import { sendShowCancelledEmail } from '../services/bookingEmail.js'
import { sendBookingRefund } from '../services/bookingRefund.js'
import { createCreditNote } from '../services/invoice.js'
import { refundFor } from '../services/pricing.js'

// JOB-04 (every minute, and once straight after a show is cancelled): cancellation refunds.
// For every cancelled booking with something still to do, one booking at a time:
//   1. show cancelled by the theatre (O-06): the credit note (GST-02), own small transaction
//   2. the gateway refund (also U-20 refunds that failed before)
//   3. show cancelled by the theatre: the E-05 email, once ("refunded", or "on its way"
//      when the gateway failed; the refund is tried again next minute)
// One booking failing is logged and never stops the others.

export async function processCancellations(now = new Date()) {
  const todo = await Booking.find(
    { status: { $in: ['cancelled', 'cancelled_by_theatre'] }, $or: [{ 'cancellation.refundStatus': 'pending' }, { 'cancellation.emailStatus': 'pending' }] },
    '_id',
  ).sort({ 'cancellation.at': 1 })
  const result = { refunded: 0, failed: 0, emailed: 0 }
  for (const { _id } of todo) {
    try {
      const booking = await Booking.findById(_id)
      if (booking.status === 'cancelled_by_theatre') await makeCreditNote(booking, now)
      if (booking.cancellation.refundStatus === 'pending') {
        const refund = await sendBookingRefund(booking, now)
        if (refund === 'done') result.refunded++
        if (refund === 'failed') result.failed++
        if (refund === 'busy') continue // someone else is sending it; the email waits for that
      }
      if (await sendEmailOnce(booking)) result.emailed++
    } catch (error) {
      console.error(`[JOB-04] booking ${_id} failed: ${error.message}`)
    }
  }
  if (todo.length) console.log(`[JOB-04] ${todo.length} cancelled bookings: ${result.refunded} refunded, ${result.failed} refund failed, ${result.emailed} emails`)
  return result
}

class AlreadyMade extends Error {}

// GST-02: credit note for the full refund (bookings from before U-17 have no invoice: none)
async function makeCreditNote(booking, now) {
  if (booking.cancellation.creditNoteId || !booking.invoiceId) return
  try {
    await mongoose.connection.transaction(async (session) => {
      const invoice = await Invoice.findById(booking.invoiceId).session(session)
      const note = await createCreditNote(invoice, refundFor(booking.pricing, 'theatre'), { session, now })
      // Only one credit note per booking: two runs at once → the second rolls back (number too)
      const saved = await Booking.updateOne({ _id: booking._id, 'cancellation.creditNoteId': { $exists: false } }, { $set: { 'cancellation.creditNoteId': note._id } }, { session })
      if (saved.modifiedCount !== 1) throw new AlreadyMade()
    })
  } catch (error) {
    if (!(error instanceof AlreadyMade)) throw error
  }
}

// E-05: claimed first, so it goes out only once; a failed send is tried again next minute
async function sendEmailOnce(booking) {
  const claimed = await Booking.updateOne({ _id: booking._id, 'cancellation.emailStatus': 'pending' }, { $set: { 'cancellation.emailStatus': 'sent' } })
  if (claimed.modifiedCount !== 1) return false
  try {
    await sendShowCancelledEmail(await Booking.findById(booking._id))
    return true
  } catch (error) {
    await Booking.updateOne({ _id: booking._id }, { $set: { 'cancellation.emailStatus': 'pending' } })
    console.error(`[email] E-05 for booking ${booking.bookingNumber} failed: ${error.message}`)
    return false
  }
}

// Straight after a show cancel: run now instead of waiting up to a minute. Never twice at
// the same time inside this server; a call during a run starts one more run after it, so
// bookings cancelled during the run are not left for the next minute.
let running = null
let again = false
export function runCancellationsSoon() {
  if (running) {
    again = true
    return running
  }
  running = processCancellations()
    .catch((error) => console.error(`[JOB-04] failed: ${error.message}`))
    .finally(() => {
      running = null
      if (again) {
        again = false
        runCancellationsSoon()
      }
    })
  return running
}
