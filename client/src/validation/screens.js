import { z } from 'zod'

// O-04 screen form + seat layout editor helpers. Plain functions, so they are easy to test.
// Same rules as the server (server/src/utils/seatLayout.js, validation/screens.js);
// the server checks again and makes the real row letters and seat IDs.
//
// grid[0] = the row farthest from the screen (top of the map). The screen is below the last row.
// Row letters: A = the row with seats nearest the screen; rows without seats get no letter.
// Seat numbers: 1, 2, 3… left to right, aisles and blocked places skipped.

export const MAX_ROWS = 26
export const MAX_COLS = 40

// UI-22 class names
export const SEAT_CLASS_LABELS = { balcony: 'Balcony', first: 'First class', second: 'Second class' }

// Editor brushes. `mark` is shown on the place too, so it is not colour only (NF-04).
export const BRUSHES = [
  { key: 'balcony', label: 'Balcony', mark: 'B' },
  { key: 'first', label: 'First class', mark: 'F' },
  { key: 'second', label: 'Second class', mark: 'S' },
  { key: 'wheelchair', label: 'Wheelchair space', mark: '♿︎' }, // ︎ = plain text mark, not a coloured emoji
  { key: 'aisle', label: 'Aisle (gap)', mark: '' },
  { key: 'blocked', label: 'Blocked', mark: '—' },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const seat = (seatClass, wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })

// A new grid: every place a Second class seat
export function newGrid(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => seat('second')))
}

// Bigger / smaller grid. Keeps what fits; rows are added / removed at the bottom
// (front), columns at the right. New places are Second class seats.
export function resizeGrid(grid, rows, cols) {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => grid[r]?.[c] ?? seat('second')))
}

// One place painted with a brush.
// Class brush on a seat keeps its wheelchair mark. Wheelchair brush on one place
// switches the mark on / off (`toggle`); on a whole row / column it only switches it on.
export function paintCell(cell, brush, { toggle = true } = {}) {
  if (brush === 'aisle' || brush === 'blocked') return { type: brush }
  if (brush === 'wheelchair') {
    if (cell.type !== 'seat') return seat('second', true)
    return seat(cell.seatClass, toggle ? !cell.wheelchair : true)
  }
  return seat(brush, cell.type === 'seat' ? Boolean(cell.wheelchair) : false)
}

export const paintAt = (grid, r, c, brush) => grid.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? paintCell(cell, brush) : cell)) : row))
export const paintRow = (grid, r, brush) => grid.map((row, ri) => (ri === r ? row.map((cell) => paintCell(cell, brush, { toggle: false })) : row))
export const paintColumn = (grid, c, brush) => grid.map((row) => row.map((cell, ci) => (ci === c ? paintCell(cell, brush, { toggle: false }) : cell)))

// Row letters, seat IDs and the live seat summary for the editor
export function layoutPreview(grid) {
  const seatCount = { balcony: 0, first: 0, second: 0 }
  let wheelchairSpaces = 0
  let letterIndex = 0
  const labels = new Array(grid.length).fill(null)
  const seatIds = grid.map((row) => row.map(() => null))

  for (let r = grid.length - 1; r >= 0; r--) {
    if (!grid[r].some((cell) => cell.type === 'seat')) continue
    const label = LETTERS[letterIndex++] ?? '?'
    labels[r] = label
    let number = 0
    grid[r].forEach((cell, c) => {
      if (cell.type !== 'seat') return
      seatIds[r][c] = `${label}${++number}`
      seatCount[cell.seatClass] += 1
      if (cell.wheelchair) wheelchairSpaces += 1
    })
  }
  const totalSeats = seatCount.balcony + seatCount.first + seatCount.second
  return { labels, seatIds, seatCount, totalSeats, wheelchairSpaces, wheelchairFriendly: wheelchairSpaces > 0 }
}

// Screen reader text for one place (NF-03), e.g. "Seat B3, Balcony, wheelchair space"
export function cellLabel(cell, seatId, r, c) {
  if (cell.type === 'seat') return `Seat ${seatId}, ${SEAT_CLASS_LABELS[cell.seatClass]}${cell.wheelchair ? ', wheelchair space' : ''}`
  return `Row ${r + 1} place ${c + 1}, ${cell.type === 'aisle' ? 'aisle' : 'blocked'}`
}

// Screen form (the grid needs at least 1 seat)
export const screenFormSchema = z.object({
  name: z.string().trim().min(1, { error: 'Please enter the screen name.' }).max(50, { error: 'The name can have at most 50 characters.' }),
  format: z.enum(['2D', '3D'], { error: 'Please pick 2D or 3D.' }),
  // '' = the platform default (BR-09, the server fills it in)
  cleaningBreakMinutes: z
    .string()
    .trim()
    .regex(/^\d*$/, { error: 'Please enter whole minutes.' })
    .transform((text) => (text === '' ? undefined : Number(text)))
    .refine((n) => n === undefined || n <= 120, { error: 'The cleaning break must be 0 to 120 minutes.' }),
  grid: z.array(z.array(z.object({ type: z.string() }).loose())).refine((grid) => grid.some((row) => row.some((cell) => cell.type === 'seat')), {
    error: 'The screen needs at least 1 seat.',
  }),
})

export const DEFAULT_ROWS = 8
export const DEFAULT_COLS = 12

// A new screen. Empty cleaning break = the platform default.
export function emptyScreenForm() {
  return { name: '', format: '2D', cleaningBreakMinutes: '', grid: newGrid(DEFAULT_ROWS, DEFAULT_COLS) }
}

// A screen from the API → form values
export function screenToForm(screen) {
  return {
    name: screen.name,
    format: screen.format,
    cleaningBreakMinutes: String(screen.cleaningBreakMinutes),
    grid: screen.layout.grid.map((row) => row.cells.map((cell) => (cell.type === 'seat' ? seat(cell.seatClass, cell.wheelchair) : { type: cell.type }))),
  }
}

// Checked form values → API body. Cells carry only what the server needs (keeps the request small).
export function formToBody({ name, format, cleaningBreakMinutes, grid }) {
  return {
    name,
    format,
    ...(cleaningBreakMinutes !== undefined && { cleaningBreakMinutes }),
    layout: {
      rows: grid.length,
      cols: grid[0]?.length ?? 0,
      grid: grid.map((row) => ({ cells: row.map((cell) => (cell.type === 'seat' ? seat(cell.seatClass, Boolean(cell.wheelchair)) : { type: cell.type })) })),
    },
  }
}
