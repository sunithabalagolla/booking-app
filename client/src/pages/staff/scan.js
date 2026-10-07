// S-02 … S-05 gate scanner helpers. Times are IST (BR-21).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "6:05 PM", or "Thu 8 Oct, 9:30 AM" when it is not today (IST)
export function gateTime(date, now = Date.now()) {
  const ist = new Date(new Date(date).getTime() + IST_OFFSET_MS)
  const today = new Date(now + IST_OFFSET_MS)
  const h = ist.getUTCHours()
  const time = `${h % 12 || 12}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  if (ist.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) return time
  return `${WEEKDAYS[ist.getUTCDay()]} ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${time}`
}

// The reason in plain words (S-05, e.g. "Already used at 6:05 PM.")
export function rejectionText(result, now = Date.now()) {
  switch (result.reason) {
    case 'wrong_theatre':
      return 'This ticket is for another theatre.'
    case 'too_early':
      return `Too early. Check-in opens at ${gateTime(result.opensAt, now)}.`
    case 'too_late':
      return 'This show is already over.'
    case 'cancelled':
      return 'This booking is cancelled.'
    case 'transferred':
      return 'This ticket was given to someone else. Please show the new ticket.'
    case 'already_used':
      return `Already used at ${gateTime(result.usedAt, now)}.`
    default:
      return 'This is not a valid Talkies ticket.'
  }
}

// S-02 typed backup: TK + 8 characters without 0, O, 1, I (spaces and small letters are fine)
export const cleanBookingNumber = (text) => text.replace(/\s+/g, '').toUpperCase()

export function bookingNumberProblem(text) {
  const number = cleanBookingNumber(text)
  if (!number) return 'Please type the booking number.'
  if (!/^TK[A-HJ-NP-Z2-9]{8}$/.test(number)) return 'A booking number is TK + 8 letters or numbers, e.g. TK7F3K9QXM.'
  return null
}
