import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { User } from '../models/User.js'
import { verifyQrToken } from './qr/index.js'
import { ticketDetails } from './ticketText.js'

// S-03 + S-04 gate check-in (flow 9.7, T-07). Checks in this order (S-03):
//   1. QR signature valid and the QR is the booking's current one   → bad_qr (old QR after
//      a transfer → transferred). A typed booking number skips the signature (S-02 backup).
//   2. the booking is for one of this staff's theatres               → wrong_theatre
//   3. inside BR-08: from N minutes before the start until the end   → too_early / too_late
//   4. confirmed (not cancelled / transferred away)                  → cancelled
//   5. not used yet                                                  → already_used
// Then S-04: ONE atomic update marks it used (only one scan can win) + the user's
// enteredCount +1 (BR-23; badges come with U-24, Phase 10, decided 2026-10-07).
// Always an answer, never an error: { result: 'entered', … } or { result: 'rejected', reason, … }

const MIN = 60 * 1000

export const rejected = (reason, extra = {}) => ({ result: 'rejected', reason, ...extra })

// What the gate needs to see (S-05): movie, show, screen, seats, food + pickup
function gateView(booking) {
  const t = ticketDetails(booking)
  return {
    bookingNumber: t.bookingNumber,
    admit: t.admit,
    movieTitle: t.movieTitle,
    showText: t.showText,
    theatreName: t.theatreName,
    screenName: t.screenName,
    classText: t.classText,
    seatsText: t.seatsText,
    foodText: t.foodText,
    pickupText: t.pickupText,
  }
}

// { qrToken } or { bookingNumber } → the booking, or a rejection (also used by O-11 food pickup)
export async function findTicket({ qrToken, bookingNumber }) {
  if (bookingNumber) {
    const number = bookingNumber.replace(/\s+/g, '').toUpperCase()
    const booking = await Booking.findOne({ bookingNumber: number })
    return booking ? { booking } : { rejection: rejected('bad_qr') }
  }
  const token = verifyQrToken(qrToken)
  if (!token) return { rejection: rejected('bad_qr') }
  const booking = await Booking.findById(token.bookingId)
  if (!booking) return { rejection: rejected('bad_qr') }
  if (booking.qrNonce !== token.nonce) {
    // An old QR: after a ticket transfer (SF-02) the new owner has a new QR
    return { rejection: booking.transfer?.status === 'done' ? rejected('transferred', { bookingNumber: booking.bookingNumber }) : rejected('bad_qr') }
  }
  return { booking }
}

// BR-08: from checkinBeforeMinutes before the start until the end → null, else a rejection
// (also the O-11 food pickup window, decided 2026-10-13)
export async function outsideWindow(booking, now = new Date()) {
  const base = { bookingNumber: booking.bookingNumber }
  const { checkinBeforeMinutes } = await getSettings()
  const opensAt = new Date(new Date(booking.show.startAt).getTime() - checkinBeforeMinutes * MIN)
  if (now < opensAt) return rejected('too_early', { ...base, opensAt })
  if (now >= new Date(booking.show.endAt)) return rejected('too_late', { ...base, endedAt: booking.show.endAt })
  return null
}

export async function checkIn(input, staff, now = new Date()) {
  const { booking, rejection } = await findTicket(input)
  if (rejection) return rejection
  const base = { bookingNumber: booking.bookingNumber }

  // A pending / released hold was never a ticket
  if (!['confirmed', 'cancelled', 'cancelled_by_theatre'].includes(booking.status)) return rejected('bad_qr')

  const myTheatres = (staff.staff?.theatreIds ?? []).map(String)
  if (!myTheatres.includes(String(booking.theatreId))) return rejected('wrong_theatre', base)

  const outside = await outsideWindow(booking, now)
  if (outside) return outside

  if (booking.status !== 'confirmed') return rejected('cancelled', base)
  if (booking.checkIn?.usedAt) return rejected('already_used', { ...base, usedAt: booking.checkIn.usedAt })

  // S-04: the scan that changes the booking wins; a second one at the same moment loses
  let won = false
  await mongoose.connection.transaction(async (session) => {
    const marked = await Booking.updateOne(
      { _id: booking._id, status: 'confirmed', 'checkIn.usedAt': { $exists: false } },
      { $set: { checkIn: { usedAt: now, staffId: staff._id } } },
      { session },
    )
    won = marked.modifiedCount === 1
    if (won) await User.updateOne({ _id: booking.userId }, { $inc: { enteredCount: 1 } }, { session })
  })
  if (!won) {
    const fresh = await Booking.findById(booking._id)
    if (fresh.checkIn?.usedAt) return rejected('already_used', { ...base, usedAt: fresh.checkIn.usedAt })
    return rejected('cancelled', base) // cancelled at this very moment
  }
  return { result: 'entered', usedAt: now, booking: gateView(booking) }
}

// GET /api/staff/theatres: names for the scanner header
export async function staffTheatres(staff) {
  const ids = staff.staff?.theatreIds ?? []
  const theatres = await Theatre.find({ _id: { $in: ids } }, 'name cityCode').sort({ name: 1 })
  return theatres.map((t) => ({ id: String(t._id), name: t.name, cityCode: t.cityCode }))
}
