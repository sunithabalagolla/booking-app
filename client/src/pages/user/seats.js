import { formatRupees } from '../../validation/food.js'

// U-10 seat page (UI-20, UI-21, NF-04) helpers. Plain functions, so they are easy to test.

export const SEAT_STATES = ['available', 'selected', 'booked', 'held']

// NF-04: every state has a mark, not only a colour. The legend uses the same marks.
export const SEAT_MARKS = { available: '', selected: '✓', booked: '✕', held: '🔒', blocked: '–', wheelchair: '♿︎' } // U+FE0E after ♿ = plain text mark, not a coloured emoji (like the screen editor)
export const STATE_NAMES = { available: 'available', selected: 'selected', booked: 'booked', held: 'held by someone' }

// taken: [{ seatId, status }] from GET /api/shows/:id/seats → Map seatId → 'held' | 'booked'.
// The user's own held seats (myHold, U-12) are left out: they show as their pick.
export const takenMap = (taken = [], mySeatIds = []) => new Map(taken.filter((t) => !mySeatIds.includes(t.seatId)).map((t) => [t.seatId, t.status]))

export function seatState(seatId, taken, selected) {
  if (taken.has(seatId)) return taken.get(seatId)
  return selected.includes(seatId) ? 'selected' : 'available'
}

// "Seat F4, First class, wheelchair space, available" (UI-21 aria-label)
export function seatLabel(cell, className, state) {
  return ['Seat ' + cell.seatId, className, cell.wheelchair && 'wheelchair space', STATE_NAMES[state]].filter(Boolean).join(', ')
}

// Click on a seat: add / remove it, up to `max` (BR-02). Taken seats cannot be picked.
// Returns { selected, error } (error = text to show, or null).
export function toggleSeat(selected, seatId, taken, max) {
  if (selected.includes(seatId)) return { selected: selected.filter((id) => id !== seatId), error: null }
  if (taken.has(seatId)) return { selected, error: null }
  if (selected.length >= max) return { selected, error: `You can pick up to ${max} seats in one booking.` }
  return { selected: [...selected, seatId], error: null }
}

// Seats someone else took since they were picked (live updates) drop out of the selection
export const dropTaken = (selected, taken) => selected.filter((id) => !taken.has(id))

// Rows grouped into class sections, top (back) to bottom (screen), for the "BALCONY · ₹250"
// headings. A row belongs to the class of its first seat; rows without seats stay in the
// section above them (a walkway).
export function classSections(grid) {
  const sections = []
  for (const row of grid) {
    const seatClass = row.cells.find((c) => c.type === 'seat')?.seatClass
    const current = sections.at(-1)
    if (!seatClass || seatClass === current?.seatClass) {
      if (current) current.rows.push(row)
      else sections.push({ seatClass: null, rows: [row] })
    } else if (current && current.seatClass === null) {
      current.seatClass = seatClass // empty rows at the very top join the first class
      current.rows.push(row)
    } else {
      sections.push({ seatClass, rows: [row] })
    }
  }
  return sections
}

// seatId → { seatClass, pricePaise } for the selected seats summary
export function seatInfo(grid, prices) {
  const priceOf = new Map(prices.map((p) => [p.seatClass, p.pricePaise]))
  const info = new Map()
  for (const row of grid) for (const c of row.cells) if (c.type === 'seat') info.set(c.seatId, { seatClass: c.seatClass, pricePaise: priceOf.get(c.seatClass) ?? 0 })
  return info
}

// Seat IDs in a natural order: A2 before A10, then by row letter
export const sortSeatIds = (ids) => [...ids].sort((a, b) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)))

// Bottom bar: "2 seats: F4, F5" + tickets total (prices include GST; the fee comes in Phase 5)
export function selectionSummary(selected, info) {
  if (selected.length === 0) return { text: 'No seats picked yet', totalText: '' }
  const ids = sortSeatIds(selected)
  const total = ids.reduce((sum, id) => sum + (info.get(id)?.pricePaise ?? 0), 0)
  return { text: `${ids.length} seat${ids.length === 1 ? '' : 's'}: ${ids.join(', ')}`, totalText: `Tickets ${formatRupees(total)}` }
}

// U-12 hold timer. The server sends remainingSeconds; we count down from the moment the
// answer arrived (fetchedAt), so a wrong phone clock does not matter.
export const secondsLeft = (remainingSeconds, fetchedAt, now = Date.now()) => Math.max(0, Math.ceil(remainingSeconds - (now - fetchedAt) / 1000))

// 545 → "9:05"
export const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

// Screen readers: "9 minutes 5 seconds"
export function clockWords(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return [m && `${m} minute${m === 1 ? '' : 's'}`, (s || !m) && `${s} second${s === 1 ? '' : 's'}`].filter(Boolean).join(' ')
}
