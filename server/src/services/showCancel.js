import mongoose from 'mongoose'
import { writeAudit } from '../models/AuditLog.js'
import { Booking } from '../models/Booking.js'
import { Show } from '../models/Show.js'
import { ShowSeat } from '../models/ShowSeat.js'
import { emitSeatsUpdate } from '../sockets/index.js'
import { AppError } from '../utils/AppError.js'
import { refundFor } from './pricing.js'

// O-06 owner / admin cancels a show (flow 9.6, BR-06, BR-07):
//   ONE transaction: show → cancelled (only before the start), every confirmed booking →
//   cancelled_by_theatre with a 100% refund still to send, all booked + held seats freed,
//   unpaid holds released, audit log entry (A-14; this is how the admin is told, decided
//   2026-10-07). After it: live seat update, then JOB-04 (jobs/cancellationRefunds.js)
//   makes the credit notes, sends the refunds and the E-05 emails, one booking at a time.
// Someone paying at this moment: their hold is released here; the verify call or JOB-02
// refunds them ('show_closed').

// What the owner sees before saying yes: how many bookings and how much goes back
export async function showCancelPreview(show) {
  const bookings = await Booking.find({ showId: show._id, status: 'confirmed' }, 'pricing')
  return {
    bookings: bookings.length,
    refundPaise: bookings.reduce((sum, b) => sum + refundFor(b.pricing, 'theatre').refundPaise, 0),
  }
}

class NotScheduled extends Error {}

// → { show, bookings, refundPaise }. `req` is for the audit log (who, IP).
export async function cancelShow(show, reason, req, now = new Date()) {
  if (show.status === 'cancelled') throw closed('already_cancelled')
  if (show.startAt <= now) throw closed('started')

  let summary
  let freed = []
  try {
    await mongoose.connection.transaction(async (session) => {
      // The start is checked again here: the show may start while the owner was typing
      const changed = await Show.updateOne(
        { _id: show._id, status: 'scheduled', startAt: { $gt: now } },
        { $set: { status: 'cancelled', cancelReason: reason, cancelledBy: req.user._id, cancelledAt: now, bookedCount: 0 } },
        { session },
      )
      if (changed.modifiedCount !== 1) throw new NotScheduled()

      // BR-06: 100% of everything. The refund itself is sent after the transaction (JOB-04).
      const bookings = await Booking.find({ showId: show._id, status: 'confirmed' }, 'pricing', { session })
      const refunds = bookings.map((b) => refundFor(b.pricing, 'theatre').refundPaise)
      if (bookings.length) {
        await Booking.bulkWrite(
          bookings.map((b, i) => ({
            updateOne: {
              filter: { _id: b._id, status: 'confirmed' },
              update: { $set: { status: 'cancelled_by_theatre', cancellation: { at: now, by: req.user._id, reason, refundPaise: refunds[i], refundStatus: 'pending', emailStatus: 'pending' } } },
            },
          })),
          { session },
        )
      }
      // Unpaid holds end now (a paid one is refunded by verify / JOB-02)
      await Booking.updateMany({ showId: show._id, status: 'pending' }, { $set: { status: 'released', releasedAt: now }, $unset: { holdExpiresAt: 1 } }, { session })
      freed = await ShowSeat.find({ showId: show._id }, 'seatId', { session })
      await ShowSeat.deleteMany({ showId: show._id }, { session })

      summary = { bookings: bookings.length, refundPaise: refunds.reduce((sum, r) => sum + r, 0) }
      await writeAudit(req, { action: 'show.cancel', targetType: 'show', targetId: show._id, details: { reason, ...summary } }, { session })
    })
  } catch (error) {
    if (!(error instanceof NotScheduled)) throw error
    const fresh = await Show.findById(show._id, 'status')
    throw closed(fresh?.status === 'cancelled' ? 'already_cancelled' : 'started')
  }

  if (freed.length) emitSeatsUpdate(show._id, freed.map((s) => ({ seatId: s.seatId, status: 'available' })))
  return { show: await Show.findById(show._id), ...summary }
}

function closed(reason) {
  return reason === 'started'
    ? new AppError(400, 'RULE_BROKEN', 'This show has already started, so it cannot be cancelled.', { rule: 'BR-07', reason })
    : new AppError(400, 'RULE_BROKEN', 'This show is already cancelled.', { rule: 'O-06', reason })
}
