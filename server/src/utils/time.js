// BR-21: store UTC, show IST (Asia/Kolkata, UTC+5:30, no daylight saving).

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// 'YYYY-MM-DD' (a day in IST) → the Date of 00:00 IST that day (stored in UTC)
export function istDayToDate(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS)
}

// Date → 'YYYY-MM-DD' of that moment in IST
export function dateToIstDay(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

// Today in IST as 'YYYY-MM-DD', plus `addDays`
export function istToday(addDays = 0, now = new Date()) {
  return dateToIstDay(new Date(now.getTime() + addDays * 24 * 60 * 60 * 1000))
}
