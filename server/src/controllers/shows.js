import { Show } from '../models/Show.js'
import { ShowSeat, takenNow } from '../models/ShowSeat.js'
import { AppError } from '../utils/AppError.js'
import { CLASS_NAMES } from '../utils/seatLayout.js'
import { istParts } from '../utils/showTime.js'
import { currentHold } from '../services/seatHold.js'

// /api/shows (api.md Sections 5 + 6): one show for the seat page (U-10, UI-20)

const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this show. It may have started or been cancelled.')

// A show with its movie, theatre and screen. `problem`: null (open for users),
// 'missing' (unknown, inactive movie, theatre not approved: ROLE-04) or
// 'closed' (cancelled or already started). Also used by the seat hold (U-12).
export async function loadShowForUsers(id) {
  const show = await Show.findById(id).populate('movieId', 'title certificate posterUrl durationMinutes status').populate('theatreId', 'name address status').populate('screenId', 'name')
  if (!show || !show.movieId || show.movieId.status === 'inactive' || show.theatreId?.status !== 'approved') return { show, problem: 'missing' }
  if (show.status !== 'scheduled' || show.startAt <= new Date()) return { show, problem: 'closed' }
  return { show, problem: null }
}

// The seat page shows "not found" for both problems
async function findOpenShow(id) {
  const { show, problem } = await loadShowForUsers(id)
  if (problem) throw notFound()
  return show
}

// GET /api/shows/:id (guests too): show + movie + theatre + screen name + layout + prices.
// No seat states (those need a login: GET /api/shows/:id/seats).
export async function getShow(req, res) {
  const show = await findOpenShow(req.valid.params.id)
  const { date, time } = istParts(show.startAt)
  const movie = show.movieId
  const theatre = show.theatreId
  res.json({
    show: {
      id: String(show._id),
      startAt: show.startAt,
      date, // IST day
      startTime: time, // HH:mm IST
      label: show.label,
      language: show.language,
      format: show.format,
      subtitles: show.subtitles,
      tags: show.tags ?? [],
      housefull: show.bookedCount >= show.totalSeats,
      deal: { active: Boolean(show.deal?.active), percent: show.deal?.active ? show.deal.percent : null },
      movie: { id: String(movie._id), title: movie.title, certificate: movie.certificate, posterUrl: movie.posterUrl, durationMinutes: movie.durationMinutes },
      theatre: { id: String(theatre._id), name: theatre.name, address: theatre.address },
      screen: { name: show.screenId?.name ?? null },
      layout: {
        rows: show.layout.rows,
        cols: show.layout.cols,
        grid: show.layout.grid.map((row) => ({
          label: row.label,
          cells: row.cells.map((c) => (c.type === 'seat' ? { type: 'seat', seatId: c.seatId, seatClass: c.seatClass, wheelchair: Boolean(c.wheelchair) } : { type: c.type })),
        })),
      },
      prices: show.prices.map((p) => ({ seatClass: p.seatClass, className: CLASS_NAMES[p.seatClass], pricePaise: p.pricePaise })),
    },
  })
}

// GET /api/shows/:id/seats (logged in users): the taken seats right now + the user's own hold.
// Expired holds count as free even before the TTL monitor deletes them (database.md 3).
export async function getShowSeats(req, res) {
  const show = await findOpenShow(req.valid.params.id)
  const now = new Date()
  const [seats, myHold] = await Promise.all([ShowSeat.find({ showId: show._id, ...takenNow(now) }, 'seatId status').sort({ seatId: 1 }), currentHold(show._id, req.user._id, now)])
  // myHold: the user's own running hold (U-12), so the timer works after a refresh.
  // Its seats are in `taken` too (held).
  res.json({ taken: seats.map((s) => ({ seatId: s.seatId, status: s.status })), myHold })
}
