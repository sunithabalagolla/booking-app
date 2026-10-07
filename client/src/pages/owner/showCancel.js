import { formatRupees } from '../../validation/food.js'

// O-06 cancel show panel helpers (BR-06, BR-07). Amounts are the server's (cancel-preview).

export const REASON_MIN = 5
export const REASON_MAX = 300

// Only a show that is still on and has not started (BR-07)
export const canCancelShow = (show, now) => show.status === 'scheduled' && new Date(show.startAt).getTime() > now

// "2 bookings · ₹480 goes back to the users in full (tickets, food and convenience fee)."
export function cancelSummaryText({ bookings, refundPaise }) {
  if (bookings === 0) return 'Nobody has booked this show yet, so there is nothing to refund.'
  return `${bookings} ${bookings === 1 ? 'booking' : 'bookings'} · ${formatRupees(refundPaise)} goes back to the users in full (tickets, food and convenience fee).`
}

// Same check as the server, so the owner sees it before sending
export function reasonProblem(reason) {
  const text = reason.trim()
  if (text.length < REASON_MIN) return `Please give a reason (at least ${REASON_MIN} characters).`
  if (text.length > REASON_MAX) return `The reason can have at most ${REASON_MAX} characters.`
  return null
}

// The message on the Shows page after the cancel
export function cancelledMessage({ bookings }) {
  if (bookings === 0) return 'Show cancelled.'
  return `Show cancelled. ${bookings} ${bookings === 1 ? 'booking is' : 'bookings are'} refunded in full and the ${bookings === 1 ? 'user gets' : 'users get'} an email.`
}
