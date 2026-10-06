import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { getSettings } from '../models/Settings.js'
import { ShowSeat, takenNow } from '../models/ShowSeat.js'
import { emitSeatsUpdate } from '../sockets/index.js'
import { AppError } from '../utils/AppError.js'
import { newBookingNumber, newQrNonce } from '../utils/bookingNumber.js'
import { CLASS_NAMES } from '../utils/seatLayout.js'

// U-12 seat hold (flow 9.2, 9.3, database.md Sections 2 + 3).
// Holding = insert one `showseats` document per seat + a `pending` booking, in ONE
// transaction. The unique index { showId, seatId } is the lock: if two users hold the
// same seat at the same moment, only one insert can win (T-02); the other transaction
// is aborted, so nobody ever gets half of their seats.
// A hold ends after holdMinutes (BR-01). The TTL index is slow (about 60 s), so every
// check here also looks at expiresAt / holdExpiresAt itself (T-03).

const MAX_NUMBER_TRIES = 3 // a booking number clash is very rare; just pick another one
const isDuplicate = (error) => error?.code === 11000 || error?.writeErrors?.some?.((e) => e.code === 11000)
const duplicateOn = (error, field) => isDuplicate(error) && JSON.stringify(error.keyPattern ?? error.writeErrors?.[0]?.err?.keyPattern ?? {}).includes(field)

// U-10 live map: tell the show's viewers which seats became free / held (after commit)
const seatsAs = (seatIds, status) => seatIds.map((seatId) => ({ seatId, status }))

// End a pending booking: status released, its held seats deleted (one transaction).
// Returns true when it was still pending. Safe to call twice.
// Only the seats really deleted here are sent as available: after the time is over
// somebody else may already hold the same seat (with their own booking).
export async function releaseBooking(bookingId, now = new Date()) {
  let released = false
  let freed = []
  await mongoose.connection.transaction(async (session) => {
    freed = []
    const result = await Booking.updateOne({ _id: bookingId, status: 'pending' }, { $set: { status: 'released', releasedAt: now }, $unset: { holdExpiresAt: 1 } }, { session })
    released = result.modifiedCount === 1
    if (released) {
      freed = await ShowSeat.find({ bookingId, status: 'held' }, 'showId seatId', { session })
      await ShowSeat.deleteMany({ bookingId, status: 'held' }, { session })
    }
  })
  if (freed.length) emitSeatsUpdate(freed[0].showId, seatsAs(freed.map((s) => s.seatId), 'available'))
  return released
}

// A pending booking whose time is over counts as released; tidy it up now
export async function releaseIfExpired(booking, now = new Date()) {
  if (booking.status === 'pending' && booking.holdExpiresAt <= now) {
    await releaseBooking(booking._id, now)
    return Booking.findById(booking._id)
  }
  return booking
}

// The user's running hold for a show (for the seat page after a refresh), or null
export async function currentHold(showId, userId, now = new Date()) {
  const booking = await Booking.findOne({ showId, userId, status: 'pending', holdExpiresAt: { $gt: now } })
  if (!booking) return null
  return {
    bookingId: String(booking._id),
    seatIds: booking.seats.map((s) => s.seatId),
    holdExpiresAt: booking.holdExpiresAt,
    remainingSeconds: Math.max(0, Math.round((booking.holdExpiresAt - now) / 1000)), // the client counts down from this (no clock trouble)
  }
}

// show: populated and open (loadShowForUsers). seatIds: unique, already checked by Zod.
export async function holdSeats({ show, user, seatIds, now = new Date() }) {
  const { holdMinutes, maxSeatsPerBooking } = await getSettings()
  if (seatIds.length > maxSeatsPerBooking) {
    throw new AppError(400, 'RULE_BROKEN', `You can pick up to ${maxSeatsPerBooking} seats in one booking.`, { rule: 'BR-02' })
  }

  // Every seat must be a real seat of this show's layout (blocked places and aisles are not)
  const cells = new Map(show.layout.grid.flatMap((row) => row.cells.filter((c) => c.type === 'seat').map((c) => [c.seatId, c])))
  const unknown = seatIds.filter((id) => !cells.has(id))
  if (unknown.length) {
    throw new AppError(400, 'VALIDATION_ERROR', `Seat ${unknown.join(', ')} cannot be booked.`, { seatIds: unknown })
  }

  const priceOf = new Map(show.prices.map((p) => [p.seatClass, p.pricePaise]))
  const seats = seatIds.map((seatId) => {
    const { seatClass } = cells.get(seatId)
    return { seatId, seatClass, className: CLASS_NAMES[seatClass], pricePaise: priceOf.get(seatClass) }
  })
  const expiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000)

  for (let attempt = 1; ; attempt++) {
    try {
      let booking
      let olderSeatIds = []
      await mongoose.connection.transaction(async (session) => {
        olderSeatIds = [] // the transaction may run again after a write conflict
        // 1. The user's older hold for this show is given back first (api.md)
        const older = await Booking.find({ showId: show._id, userId: user._id, status: 'pending' }, '_id', { session })
        if (older.length) {
          const ids = older.map((b) => b._id)
          await Booking.updateMany({ _id: { $in: ids } }, { $set: { status: 'released', releasedAt: now }, $unset: { holdExpiresAt: 1 } }, { session })
          olderSeatIds = (await ShowSeat.find({ bookingId: { $in: ids }, status: 'held' }, 'seatId', { session })).map((s) => s.seatId)
          await ShowSeat.deleteMany({ bookingId: { $in: ids }, status: 'held' }, { session })
        }
        // 2. Expired holds on these seats may still be there (slow TTL): clear them
        await ShowSeat.deleteMany({ showId: show._id, seatId: { $in: seatIds }, status: 'held', expiresAt: { $lte: now } }, { session })

        // 3. The booking + 4. one held seat each (the unique index decides who wins)
        ;[booking] = await Booking.create(
          [
            {
              bookingNumber: newBookingNumber(),
              userId: user._id,
              showId: show._id,
              movieId: show.movieId._id,
              theatreId: show.theatreId._id,
              screenId: show.screenId._id,
              ownerId: show.ownerId,
              cityCode: show.cityCode,
              status: 'pending',
              holdExpiresAt: expiresAt,
              show: {
                movieTitle: show.movieId.title,
                certificate: show.movieId.certificate,
                theatreName: show.theatreId.name,
                theatreAddress: show.theatreId.address,
                screenName: show.screenId.name,
                startAt: show.startAt,
                endAt: show.endAt,
                label: show.label,
                language: show.language,
                format: show.format,
              },
              seats,
              pricing: { ticketsPaise: seats.reduce((sum, s) => sum + s.pricePaise, 0) },
              qrNonce: newQrNonce(),
            },
          ],
          { session },
        )
        await ShowSeat.insertMany(
          seatIds.map((seatId) => ({ showId: show._id, seatId, status: 'held', bookingId: booking._id, userId: user._id, expiresAt })),
          { session, ordered: true },
        )
      })
      // U-10: the older hold's other seats are free again, the new ones are held
      const freed = olderSeatIds.filter((id) => !seatIds.includes(id))
      emitSeatsUpdate(show._id, [...seatsAs(freed, 'available'), ...seatsAs(seatIds, 'held')])
      return booking
    } catch (error) {
      if (duplicateOn(error, 'bookingNumber') && attempt < MAX_NUMBER_TRIES) continue
      if (isDuplicate(error)) {
        // Somebody else was faster. Tell which seats are taken now.
        const takenSeats = await ShowSeat.find({ showId: show._id, seatId: { $in: seatIds }, ...takenNow(now) }, 'seatId')
        const ids = takenSeats.map((s) => s.seatId).sort()
        const message = ids.length === 1 ? `Seat ${ids[0]} was just taken. Please pick another seat.` : ids.length ? `Seats ${ids.join(', ')} were just taken. Please pick other seats.` : 'A seat was just taken. Please pick again.'
        throw new AppError(409, 'SEAT_TAKEN', message, { seatIds: ids })
      }
      throw error
    }
  }
}
