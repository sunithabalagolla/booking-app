import { Booking } from '../models/Booking.js'
import { qrDataUrl } from './qr/index.js'

// U-18 ticket album (UI-28): the user's real bookings, never seat holds.
//   upcoming = confirmed, mine, show not ended yet (BR-08: the QR works until the show ends);
//              soonest first, each with its QR
//   past     = everything else: show ended, cancelled (by me or the theatre), transferred
//              away (transfer.fromUserId = me, SF-02); newest first, no QR
// Stamp: 'cancelled' · 'transferred' · null. "Watched" comes with gate check-in (Phase 7,
// decided 2026-10-07: no stamp until then).

const CANCELLED = ['cancelled', 'cancelled_by_theatre']

function filterFor(tab, userId, now) {
  if (tab === 'upcoming') return { userId, status: 'confirmed', 'show.endAt': { $gt: now } }
  return {
    $or: [
      { userId, status: 'confirmed', 'show.endAt': { $lte: now } },
      { userId, status: { $in: CANCELLED } },
      { 'transfer.fromUserId': userId, 'transfer.status': 'done', userId: { $ne: userId } },
    ],
  }
}

function stampFor(booking, userId) {
  if (String(booking.userId) !== String(userId)) return 'transferred'
  if (CANCELLED.includes(booking.status)) return 'cancelled'
  return null
}

// → { items, page, limit, total } (api.md 1.6)
export async function ticketAlbum(userId, { tab, page, limit }, now = new Date()) {
  const filter = filterFor(tab, userId, now)
  const sort = tab === 'upcoming' ? { 'show.startAt': 1, _id: 1 } : { 'show.startAt': -1, _id: -1 }
  const [bookings, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Booking.countDocuments(filter),
  ])
  const items = await Promise.all(
    bookings.map(async (b) => {
      const mine = String(b.userId) === String(userId)
      return {
        id: String(b._id),
        bookingNumber: b.bookingNumber,
        status: b.status,
        stamp: stampFor(b, userId),
        canOpen: mine, // a ticket transferred away belongs to the friend now
        show: b.show,
        seats: b.seats.map((s) => ({ seatId: s.seatId, seatClass: s.seatClass, className: s.className })),
        food: (b.food ?? []).map((f) => ({ name: f.name, qty: f.qty })),
        foodPickup: b.foodPickup ?? null,
        totalPaise: b.pricing.totalPaise,
        invoiceId: mine && b.invoiceId ? String(b.invoiceId) : null,
        qrDataUrl: tab === 'upcoming' ? await qrDataUrl(b) : null, // also for offline later (U-19)
      }
    }),
  )
  return { items, page, limit, total }
}
