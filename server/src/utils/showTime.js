// O-05 show times. All in IST (BR-21): stored as UTC dates, worked out in IST.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
const MINUTE_MS = 60 * 1000

export const SHOW_LABELS = ['morning', 'matinee', 'first', 'second']

// 'YYYY-MM-DD' + 'HH:mm' (both IST) → Date (UTC)
export function istDateTime(day, time) {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS)
}

// Date → { date: 'YYYY-MM-DD', time: 'HH:mm' } in IST
export function istParts(date) {
  const iso = new Date(date.getTime() + IST_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

// BR-22, from the start time in IST: before 12:00 Morning · 12:00–3:59 PM Matinee ·
// 4:00–7:59 PM First show · 8:00 PM and later Second show
export function showLabel(startAt) {
  const hour = Number(istParts(startAt).time.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 16) return 'matinee'
  if (hour < 20) return 'first'
  return 'second'
}

// BR-10: end = start + movie duration + cleaning break
export function showEnd(startAt, durationMinutes, cleaningBreakMinutes) {
  return new Date(startAt.getTime() + (durationMinutes + cleaningBreakMinutes) * MINUTE_MS)
}

// 'YYYY-MM-DD' (already IST) → 'Sun 4 Oct', for messages
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatShortDay(day) {
  const date = new Date(`${day}T00:00:00Z`)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}
