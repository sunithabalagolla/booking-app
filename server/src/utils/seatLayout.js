// O-04 seat layout: makes row letters, seat IDs and seat counts from a grid.
// The client sends only cell types; the server always makes the labels again.
//
// Rules (decided 2026-10-04):
// - grid[0] is the row FARTHEST from the screen (top of the map); the screen is
//   below the last row ("SCREEN THIS WAY")
// - row letters are automatic: A = the row with seats nearest the screen, then B, C… up to Z
// - rows without seats get no letter (label null)
// - seats are numbered 1, 2, 3… left to right; aisles and blocked cells are skipped
// - wheelchair-friendly = at least 1 wheelchair space (automatic)

export const SEAT_CLASSES = ['balcony', 'first', 'second']
export const CELL_TYPES = ['seat', 'aisle', 'blocked']
export const MAX_ROWS = 26 // A to Z
export const MAX_COLS = 40

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// grid: [{ cells: [{ type, seatClass?, wheelchair? }] }] (labels and seat IDs in the input are ignored)
// Returns { layout: { rows, cols, grid }, seatCount, totalSeats, wheelchairFriendly }
export function buildLayout(grid) {
  const seatCount = { balcony: 0, first: 0, second: 0 }
  let wheelchairSpaces = 0
  let letterIndex = 0

  // Walk from the screen (last row) up, so A is nearest the screen
  const built = new Array(grid.length)
  for (let r = grid.length - 1; r >= 0; r--) {
    const hasSeats = grid[r].cells.some((cell) => cell.type === 'seat')
    const label = hasSeats ? LETTERS[letterIndex++] : null
    let number = 0
    const cells = grid[r].cells.map((cell) => {
      if (cell.type !== 'seat') return { type: cell.type }
      number += 1
      seatCount[cell.seatClass] += 1
      if (cell.wheelchair) wheelchairSpaces += 1
      return { type: 'seat', seatId: `${label}${number}`, seatClass: cell.seatClass, wheelchair: Boolean(cell.wheelchair) }
    })
    built[r] = { label, cells }
  }

  return {
    layout: { rows: grid.length, cols: grid[0]?.cells.length ?? 0, grid: built },
    seatCount,
    totalSeats: seatCount.balcony + seatCount.first + seatCount.second,
    wheelchairFriendly: wheelchairSpaces > 0,
  }
}
