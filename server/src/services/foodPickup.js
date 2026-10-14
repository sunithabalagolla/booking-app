import { Booking } from '../models/Booking.js'
import { findTicket, outsideWindow, rejected } from './checkIn.js'
import { ticketDetails } from './ticketText.js'

// O-11 food pickup at the canteen counter (SF-06). Owner (own theatres) or Gate Staff
// (their theatres). Checks in this order (decided 2026-10-13):
//   1. QR signature / current QR (bad_qr · transferred); a typed number skips the signature
//   2. the booking is for my theatre                     → wrong_theatre
//   3. inside the BR-08 window (same as the gate)        → too_early / too_late
//   4. confirmed                                         → cancelled
//   5. has food                                          → no_food
//   6. not collected yet                                 → already_collected
// The gate scan ("Entered") is NOT needed first. Collect = ONE atomic update (only one wins).
// Always an answer: { result: 'found' | 'collected', order } or { result: 'rejected', reason, … }

// The theatre check: staff → their theatres; owner → their own bookings (ROLE-02)
function isMine(booking, person) {
  if (person.role === 'owner') return String(booking.ownerId) === String(person._id)
  return (person.staff?.theatreIds ?? []).map(String).includes(String(booking.theatreId))
}

// What the counter needs to see
function orderView(booking) {
  const t = ticketDetails(booking)
  return {
    bookingNumber: t.bookingNumber,
    admit: t.admit,
    movieTitle: t.movieTitle,
    showText: t.showText,
    screenName: t.screenName,
    seatsText: t.seatsText,
    items: booking.food.map((f) => ({ name: f.name, isVeg: f.isVeg, qty: f.qty })),
    pickup: booking.foodPickup,
    pickupText: t.pickupText,
  }
}

async function checkOrder(input, person, now) {
  const { booking, rejection } = await findTicket(input)
  if (rejection) return { rejection }
  const base = { bookingNumber: booking.bookingNumber }
  if (!['confirmed', 'cancelled', 'cancelled_by_theatre'].includes(booking.status)) return { rejection: rejected('bad_qr') } // a hold is not a ticket
  if (!isMine(booking, person)) return { rejection: rejected('wrong_theatre', base) }
  const outside = await outsideWindow(booking, now)
  if (outside) return { rejection: outside }
  if (booking.status !== 'confirmed') return { rejection: rejected('cancelled', base) }
  if (!booking.food?.length) return { rejection: rejected('no_food', base) }
  if (booking.foodCollectedAt) return { rejection: rejected('already_collected', { ...base, collectedAt: booking.foodCollectedAt }) }
  return { booking }
}

// POST /api/food-pickup/lookup: show the order, change nothing
export async function lookupFood(input, person, now = new Date()) {
  const { booking, rejection } = await checkOrder(input, person, now)
  return rejection ?? { result: 'found', order: orderView(booking) }
}

// POST /api/food-pickup/collect: mark "Collected" once only
export async function collectFood(input, person, now = new Date()) {
  const { booking, rejection } = await checkOrder(input, person, now)
  if (rejection) return rejection
  const marked = await Booking.updateOne(
    { _id: booking._id, status: 'confirmed', foodCollectedAt: { $exists: false } },
    { $set: { foodCollectedAt: now, foodCollectedBy: person._id } },
  )
  if (marked.modifiedCount !== 1) {
    // Another counter won at the same moment, or the booking was just cancelled
    const fresh = await Booking.findById(booking._id)
    if (fresh.foodCollectedAt) return rejected('already_collected', { bookingNumber: booking.bookingNumber, collectedAt: fresh.foodCollectedAt })
    return rejected('cancelled', { bookingNumber: booking.bookingNumber })
  }
  return { result: 'collected', collectedAt: now, order: orderView(booking) }
}
