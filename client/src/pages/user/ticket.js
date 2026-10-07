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
    totalText: formatRupees(booking.pricing.totalPaise),
  }
}

// File names of the downloads (the server sends the same ticket name)
export const ticketFileName = (booking) => `Talkies-ticket-${booking.bookingNumber}.pdf`
export const invoiceFileName = (booking) => `Talkies-invoice-${booking.bookingNumber}.pdf`
