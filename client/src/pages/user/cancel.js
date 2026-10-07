import { formatRupees } from '../../validation/food.js'
import { formatShortDay } from '../../validation/shows.js'

// U-20 cancel panel helpers (BR-04, BR-05). The amounts are the server's (cancel-preview).

// One row per refund line: "2 × Second class" · "75% back" · ₹172.50
export function refundRows(preview) {
  return preview.lines.map((l) => ({
    key: `${l.kind}-${l.description}`,
    text: l.kind === 'convenience_fee' ? 'Convenience fee' : l.description,
    note: l.percent === 0 ? 'not refunded' : `${l.percent}% back of ${formatRupees(l.paidPaise)}`,
    amountText: formatRupees(l.refundPaise),
  }))
}

// "Wed 7 Oct, 6:00 PM" (IST)
export function istShortDateTime(date) {
  const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
  const [h, m] = ist.slice(11, 16).split(':').map(Number)
  return `${formatShortDay(ist.slice(0, 10))}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const cutoffText = (preview) => `You can cancel until ${istShortDateTime(preview.cutoffAt)}.`

export const creditNoteFileName = (booking) => `Talkies-credit-note-${booking.bookingNumber}.pdf`
