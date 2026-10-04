import { findOwned } from '../middleware/ownership.js'
import { Screen } from '../models/Screen.js'
import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { AppError } from '../utils/AppError.js'
import { buildLayout } from '../utils/seatLayout.js'

// O-04 owner screens + seat layout (api.md Section 8). Own theatres / screens only (ROLE-02).
// Rules (decided 2026-10-04):
// - screens can be added to pending and rejected theatres too (ROLE-04 still stops live shows)
// - the server makes row letters, seat IDs, seat counts and wheelchair-friendly (utils/seatLayout.js)
// - screens are never deleted (like theatres)
// - layout edits do not change existing shows (a show keeps its own copy, O-05)

// What the API sends. `withGrid: false` for lists (smaller answer).
export function publicScreen(screen, { withGrid = true } = {}) {
  const { balcony, first, second } = screen.seatCount
  return {
    id: String(screen._id),
    theatreId: String(screen.theatreId),
    name: screen.name,
    format: screen.format,
    cleaningBreakMinutes: screen.cleaningBreakMinutes,
    wheelchairFriendly: screen.wheelchairFriendly,
    seatCount: { balcony, first, second },
    totalSeats: balcony + first + second,
    layout: withGrid
      ? { rows: screen.layout.rows, cols: screen.layout.cols, grid: screen.layout.grid.map((row) => ({ label: row.label, cells: row.cells.map(publicCell) })) }
      : { rows: screen.layout.rows, cols: screen.layout.cols },
    createdAt: screen.createdAt,
  }
}

const publicCell = (cell) =>
  cell.type === 'seat' ? { type: 'seat', seatId: cell.seatId, seatClass: cell.seatClass, wheelchair: Boolean(cell.wheelchair) } : { type: cell.type }

const briefTheatre = (theatre) => ({ id: String(theatre._id), name: theatre.name, status: theatre.status })

// Layout input → the fields saved on the screen
function layoutFields(layoutInput) {
  const { layout, seatCount, wheelchairFriendly } = buildLayout(layoutInput.grid)
  return { layout, seatCount, wheelchairFriendly }
}

// Unique index { theatreId, name } → a clear message on the name field
async function saveScreen(screen) {
  try {
    return await screen.save()
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError(409, 'ALREADY_EXISTS', 'This theatre already has a screen with this name.', { name: 'This theatre already has a screen with this name.' })
    }
    throw error
  }
}

// GET /api/owner/theatres/:id/screens (sorted by name, so "Screen 1" comes before "Screen 2")
export async function listTheatreScreens(req, res) {
  const theatre = await findOwned(Theatre, req.valid.params.id, req.user, { theatreField: '_id' })
  const screens = await Screen.find({ theatreId: theatre._id }).collation({ locale: 'en', numericOrdering: true }).sort({ name: 1 })
  res.json({ theatre: briefTheatre(theatre), items: screens.map((s) => publicScreen(s, { withGrid: false })) })
}

// POST /api/owner/theatres/:id/screens
export async function createScreen(req, res) {
  const body = req.valid.body
  const theatre = await findOwned(Theatre, req.valid.params.id, req.user, { theatreField: '_id' })
  const cleaningBreakMinutes = body.cleaningBreakMinutes ?? (await getSettings()).defaultCleaningBreakMinutes

  const screen = await saveScreen(
    new Screen({
      theatreId: theatre._id,
      ownerId: theatre.ownerId,
      name: body.name,
      format: body.format,
      cleaningBreakMinutes,
      ...layoutFields(body.layout),
    }),
  )
  res.status(201).json({ screen: publicScreen(screen) })
}

// GET /api/owner/screens/:id (another owner's screen → 404)
export async function getMyScreen(req, res) {
  const screen = await findOwned(Screen, req.valid.params.id, req.user)
  const theatre = await Theatre.findById(screen.theatreId)
  res.json({ screen: publicScreen(screen), theatre: briefTheatre(theatre) })
}

// PATCH /api/owner/screens/:id
export async function updateScreen(req, res) {
  const body = req.valid.body
  const screen = await findOwned(Screen, req.valid.params.id, req.user)

  for (const key of ['name', 'format', 'cleaningBreakMinutes']) {
    if (body[key] !== undefined) screen[key] = body[key]
  }
  if (body.layout) screen.set(layoutFields(body.layout))

  await saveScreen(screen)
  const theatre = await Theatre.findById(screen.theatreId)
  res.json({ screen: publicScreen(screen), theatre: briefTheatre(theatre) })
}
