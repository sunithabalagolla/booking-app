import { CLASS_NAMES, SEAT_CLASSES } from '../utils/seatLayout.js'

// Text for the ticket PDF and the E-03 email (U-17). All times in IST (NF-07, BR-21).

export const SHOW_LABEL_NAMES = { morning: 'Morning show', matinee: 'Matinee', first: 'First show', second: 'Second show' } // BR-22
const PICKUP_NAMES = { before_movie: 'Before movie', interval: 'Interval' } // SF-06
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// Date → { day: 'Wed 7 Oct 2026', time: '9:45 PM' } in IST
export function istDateTime(date) {
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MS)
  const h = ist.getUTCHours()
  const m = String(ist.getUTCMinutes()).padStart(2, '0')
  return {
    day: `${WEEKDAYS[ist.getUTCDay()]} ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`,
    time: `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`,
  }
}

// ₹150 plain, ₹38.10 with paise (decided 2026-10-06). `decimals: true` = always 2 (invoice).
export function rupees(paise, { decimals = false } = {}) {
  const twoDecimals = decimals || paise % 100 !== 0
  return `₹${(paise / 100).toLocaleString('en-IN', twoDecimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})}`
}

// Row letter first, then the number: A2, A10, B1
export const sortSeatIds = (ids) => [...ids].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

// Everything a ticket shows, as plain text
export function ticketDetails(booking) {
  const start = istDateTime(booking.show.startAt)
  const classes = SEAT_CLASSES.filter((c) => booking.seats.some((s) => s.seatClass === c)).map((c) => CLASS_NAMES[c])
  const food = (booking.food ?? []).map((f) => `${f.qty} × ${f.name}`)
  return {
    bookingNumber: booking.bookingNumber,
    admit: booking.seats.length,
    movieTitle: booking.show.movieTitle,
    movieInfo: [booking.show.certificate, booking.show.language, booking.show.format].join(' · '),
    showText: `${SHOW_LABEL_NAMES[booking.show.label] ?? booking.show.label} · ${start.day}, ${start.time}`,
    theatreName: booking.show.theatreName,
    theatreAddress: booking.show.theatreAddress,
    screenName: booking.show.screenName,
    classText: classes.join(', '),
    seatsText: sortSeatIds(booking.seats.map((s) => s.seatId)).join(', '),
    foodText: food.length ? food.join(', ') : null,
    pickupText: food.length && booking.foodPickup ? PICKUP_NAMES[booking.foodPickup] : null,
    totalText: rupees(booking.pricing.totalPaise),
  }
}
