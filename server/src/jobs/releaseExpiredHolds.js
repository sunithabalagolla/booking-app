import { Booking } from '../models/Booking.js'
import { ShowSeat } from '../models/ShowSeat.js'
import { releaseBooking } from '../services/seatHold.js'
import { emitSeatsUpdate } from '../sockets/index.js'

// JOB-01 (every minute): release expired holds and push the seat updates (U-10, U-12).
// A backup to the TTL index, which is slow (about 60 s, database.md Section 3), so other
// viewers see a seat turn free soon after the hold time (BR-01) is over.
// `now` can be given by tests (T-03), so they never wait for real time.
export async function releaseExpiredHolds(now = new Date()) {
  // 1. Pending bookings whose time is over → released, their seats freed (+ pushed)
  const expired = await Booking.find({ status: 'pending', holdExpiresAt: { $lte: now } }, '_id')
  let bookings = 0
  for (const { _id } of expired) {
    if (await releaseBooking(_id, now)) bookings++
  }

  // 2. Expired held seats without a pending booking (left over). One by one with the
  //    expiry check again, so a seat that somebody holds afresh is never touched.
  const leftovers = await ShowSeat.find({ status: 'held', expiresAt: { $lte: now } }, 'showId seatId expiresAt')
  const freedByShow = new Map()
  for (const seat of leftovers) {
    const { deletedCount } = await ShowSeat.deleteOne({ _id: seat._id, status: 'held', expiresAt: { $lte: now } })
    if (!deletedCount) continue
    const key = String(seat.showId)
    freedByShow.set(key, [...(freedByShow.get(key) ?? []), { seatId: seat.seatId, status: 'available' }])
  }
  for (const [showId, seats] of freedByShow) emitSeatsUpdate(showId, seats)

  return { bookings, seats: [...freedByShow.values()].reduce((sum, list) => sum + list.length, 0) }
}
