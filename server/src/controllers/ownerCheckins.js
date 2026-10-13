import { Booking } from '../models/Booking.js'
import { getSettings } from '../models/Settings.js'
import { Show } from '../models/Show.js'
import { istDayToDate, istToday } from '../utils/time.js'
import { POPULATE, publicShow } from './ownerShows.js'

// O-10 check-in report (api.md Section 8): per show of one IST day, tickets booked vs came.
// One scan lets the whole booking in (S-04), so both numbers count seats (tickets).
// Booked = confirmed bookings (no holds, no cancelled); came = confirmed + scanned.

const DAY_MS = 24 * 60 * 60 * 1000
const MIN = 60 * 1000

// Gate state of a show (BR-08: open from start − checkinBeforeMinutes until the end)
export function gateState(show, opensAt, now = new Date()) {
  if (show.status === 'cancelled') return 'cancelled'
  if (now < opensAt) return 'not_open'
  if (now < show.endAt) return 'open'
  return 'over'
}

// GET /api/owner/checkin-report?date=YYYY-MM-DD&theatreId=
export async function checkinReport(req, res) {
  const { theatreId } = req.valid.query
  const date = req.valid.query.date ?? istToday()
  const dayStart = istDayToDate(date)
  const shows = await Show.find({
    ownerId: req.user._id, // own shows only (ROLE-02); another owner's theatreId gives an empty list
    ...(theatreId && { theatreId }),
    startAt: { $gte: dayStart, $lt: new Date(dayStart.getTime() + DAY_MS) },
  })
    .sort({ startAt: 1, _id: 1 })
    .populate(POPULATE)

  const counts = await Booking.aggregate([
    { $match: { ownerId: req.user._id, showId: { $in: shows.map((s) => s._id) }, status: 'confirmed' } },
    {
      $group: {
        _id: '$showId',
        booked: { $sum: { $size: '$seats' } },
        came: { $sum: { $cond: [{ $ifNull: ['$checkIn.usedAt', false] }, { $size: '$seats' }, 0] } },
      },
    },
  ])
  const byShow = new Map(counts.map((c) => [String(c._id), c]))

  const { checkinBeforeMinutes } = await getSettings()
  const now = new Date()
  const items = shows.map((show) => {
    const opensAt = new Date(show.startAt.getTime() - checkinBeforeMinutes * MIN)
    const { booked = 0, came = 0 } = byShow.get(String(show._id)) ?? {}
    return { ...publicShow(show), booked, came, gate: gateState(show, opensAt, now), gateOpensAt: opensAt }
  })
  const totals = items.reduce((sum, item) => ({ booked: sum.booked + item.booked, came: sum.came + item.came }), { booked: 0, came: 0 })
  res.json({ date, items, totals })
}
