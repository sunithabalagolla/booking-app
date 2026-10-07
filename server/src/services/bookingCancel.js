import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { Invoice } from '../models/Invoice.js'
import { Payment } from '../models/Payment.js'
import { getSettings } from '../models/Settings.js'
import { Show } from '../models/Show.js'
import { ShowSeat } from '../models/ShowSeat.js'
import { emitSeatsUpdate } from '../sockets/index.js'
import { AppError } from '../utils/AppError.js'
import { sendBookingCancelledEmail } from './bookingEmail.js'
import { createCreditNote } from './invoice.js'
import * as gateway from './payment/index.js'
import { refundFor } from './pricing.js'

// U-20 user cancels a booking (flow 9.5, BR-04, BR-05, GST-02, E-04, T-06):
//   1. ONE transaction (database.md 2): booking → cancelled, its seats freed, show count −,
//      credit note (own number series) against the invoice
//   2. after it: the mock gateway refunds (never inside the transaction: a retried
//      transaction would refund twice). If that fails the refund stays 'pending' (JOB-04 later).
//   3. live seat update + E-04 email (refund amount + credit note PDF)
// Not here yet: waitlist offer (SF-04, Phase 9), "not after check-in" (Phase 7).

const MIN = 60 * 1000

// BR-04: cancel up to (and exactly at) N minutes before the start. N is copied into the
// booking at hold time (A-05, decided 2026-10-07); older bookings use the current setting.
export async function cancelCutoffAt(booking) {
  const minutes = booking.pricing.rates?.cancelCutoffMinutes ?? (await getSettings()).cancelCutoffMinutes
  return new Date(new Date(booking.show.startAt).getTime() - minutes * MIN)
}

// GET /api/bookings/:id/cancel-preview → what the user would get back (BR-05)
export async function cancelPreview(booking, now = new Date()) {
  const cutoffAt = await cancelCutoffAt(booking)
  const { lines, refundPaise } = refundFor(booking.pricing, 'user')
  let reason = null
  if (booking.status !== 'confirmed') reason = 'not_confirmed'
  else if (now > cutoffAt) reason = 'cutoff'
  return {
    allowed: reason === null,
    reason,
    cutoffAt,
    refundPaise,
    lines: lines.map((l) => ({ kind: l.kind, description: l.description, paidPaise: l.paidPaise, percent: l.percent, refundPaise: l.amountPaise })),
  }
}

const refused = (reason) =>
  new AppError(
    400,
    'RULE_BROKEN',
    reason === 'cutoff' ? 'Cancellation is closed: it is allowed only until 2 hours before the show.' : 'This booking cannot be cancelled.',
    { rule: reason === 'cutoff' ? 'BR-04' : 'U-20', reason },
  )

class NotConfirmed extends Error {}

// POST /api/bookings/:id/cancel → the cancelled booking
export async function cancelBooking(booking, user, now = new Date()) {
  const preview = await cancelPreview(booking, now)
  if (!preview.allowed) throw refused(preview.reason)
  const refund = refundFor(booking.pricing, 'user')

  let creditNoteId = null
  try {
    await mongoose.connection.transaction(async (session) => {
      creditNoteId = null
      const cancelled = await Booking.updateOne(
        { _id: booking._id, status: 'confirmed' }, // cancelling twice at the same moment: only one wins
        { $set: { status: 'cancelled', cancellation: { at: now, by: user._id, refundPaise: refund.refundPaise, refundStatus: 'pending' } } },
        { session },
      )
      if (cancelled.modifiedCount !== 1) throw new NotConfirmed()
      await ShowSeat.deleteMany({ bookingId: booking._id, status: 'booked' }, { session })
      await Show.updateOne({ _id: booking.showId }, { $inc: { bookedCount: -booking.seats.length } }, { session })
      // GST-02 credit note (bookings confirmed before U-17 have no invoice, so no credit note)
      if (booking.invoiceId) {
        const invoice = await Invoice.findById(booking.invoiceId).session(session)
        const note = await createCreditNote(invoice, refund, { session, now })
        creditNoteId = note._id
        await Booking.updateOne({ _id: booking._id }, { $set: { 'cancellation.creditNoteId': note._id } }, { session })
      }
    })
  } catch (error) {
    if (error instanceof NotConfirmed) throw refused('not_confirmed')
    throw error
  }

  await sendRefund(booking, refund.refundPaise, creditNoteId, now)

  // U-10: the seats are free for everybody looking at the map
  emitSeatsUpdate(booking.showId, booking.seats.map((s) => ({ seatId: s.seatId, status: 'available' })))
  const fresh = await Booking.findById(booking._id)
  sendBookingCancelledEmail(fresh).catch((error) => console.error(`[email] E-04 for booking ${fresh.bookingNumber} failed: ${error.message}`))
  return fresh
}

// Money back through the gateway; the payment gets the refund entry (PAY-04)
async function sendRefund(booking, refundPaise, creditNoteId, now) {
  const done = () => Booking.updateOne({ _id: booking._id }, { $set: { 'cancellation.refundStatus': 'done' } })
  if (refundPaise === 0) return done()
  const payment = await Payment.findOne({ bookingId: booking._id, status: 'success' })
  if (!payment) {
    console.error(`[U-20] booking ${booking.bookingNumber}: no successful payment found, refund left pending`)
    return
  }
  try {
    const { refundId } = await gateway.refund({ paymentId: payment.paymentId, amountPaise: refundPaise })
    await Payment.updateOne(
      { _id: payment._id },
      {
        $set: { status: refundPaise >= payment.amountPaise ? 'refunded' : 'partially_refunded' },
        $push: { refunds: { refundId, amountPaise: refundPaise, reason: 'user_cancelled', at: now, creditNoteId } },
      },
    )
    await done()
  } catch (error) {
    console.error(`[U-20] refund for booking ${booking.bookingNumber} failed, left pending: ${error.message}`)
  }
}
