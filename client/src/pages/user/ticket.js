import { formatRupees } from '../../validation/food.js'
import { CLASS_NAMES, formatShortDay, SEAT_CLASSES } from '../../validation/shows.js'
import { showTimeText } from '../public/showList.js'
import { sortSeatIds } from './seats.js'
import { pickupText } from './summary.js'

// U-17 / UI-27 paper ticket helpers. Everything comes from the confirmed booking.

// Booking → the text on the ticket (show time in IST)
export function ticketInfo(booking) {
  const ist = new Date(new Date(booking.show.startAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
  const seats = sortSeatIds(booking.seats.map((s) => s.seatId))
  return {
    admit: booking.seats.length,
    movieInfo: [booking.show.certificate, booking.show.language, booking.show.format].join(' · '),
    showText: `${formatShortDay(ist.slice(0, 10))} · ${showTimeText({ label: booking.show.label, startTime: ist.slice(11, 16) })}`,
    classText: SEAT_CLASSES.filter((c) => booking.seats.some((s) => s.seatClass === c))
      .map((c) => CLASS_NAMES[c])
      .join(', '),
    seatLabel: seats.length === 1 ? 'Seat' : 'Seats',
    seatsText: seats.join(', '),
    foodText: booking.food.length ? booking.food.map((f) => `${f.qty} × ${f.name}`).join(', ') : null,
    pickup: pickupText(booking),
    totalText: formatRupees(booking.pricing?.totalPaise ?? booking.totalPaise), // album items have totalPaise
  }
}

// File names of the downloads (the server sends the same ticket name)
export const ticketFileName = (booking) => `Talkies-ticket-${booking.bookingNumber}.pdf`
export const invoiceFileName = (booking) => `Talkies-invoice-${booking.bookingNumber}.pdf`

// U-18 ticket album (UI-28): each ticket is "pasted" slightly tilted. The tilt comes from
// the booking ID, so a ticket keeps its tilt every time the page opens.
const TILTS = [-1.5, -0.75, 0.75, 1.5]
export function tiltFor(id) {
  let sum = 0
  for (const ch of String(id)) sum += ch.charCodeAt(0)
  return TILTS[sum % TILTS.length]
}

// Past stubs: rubber stamp text + tone ("Watched" comes with gate check-in, Phase 7)
export const STAMPS = { cancelled: { text: 'Cancelled', tone: 'maroon' }, transferred: { text: 'Transferred', tone: 'mustard' } }

// Short date for a stub: "Wed 7 Oct 2026 · 9:45 PM" (IST)
export function stubDateText(show) {
  const ist = new Date(new Date(show.startAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
  const [h, m] = ist.slice(11, 16).split(':').map(Number)
  return `${formatShortDay(ist.slice(0, 10))} ${ist.slice(0, 4)} · ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
