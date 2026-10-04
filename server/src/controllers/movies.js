import { Movie } from '../models/Movie.js'
import { Show } from '../models/Show.js'
import { dateToIstDay, istDayToDate, istToday } from '../utils/time.js'

// Public movie lists for users and guests (api.md Section 5: GET /api/movies).
// U-05 (decided 2026-10-04):
// - now_showing = "Now showing" movies with a scheduled show in the city from now
//   until the end of day 7 (today … +6, like U-09). Most shows first (the first one is
//   the marquee banner), then the newest release, then A to Z.
// - coming_soon = all "Coming soon" movies, the same in every city, soonest release first.
// Search and filters (U-06, SF-08) come later.

export function listMovie(movie) {
  return {
    id: String(movie._id),
    title: movie.title,
    posterUrl: movie.posterUrl,
    certificate: movie.certificate,
    languages: movie.languages,
    genres: movie.genres,
    durationMinutes: movie.durationMinutes,
    releaseDate: dateToIstDay(movie.releaseDate),
    status: movie.status,
  }
}

// GET /api/movies?city=&status=
export async function listMovies(req, res) {
  const { city, status, page, limit } = req.valid.query
  const skip = (page - 1) * limit

  if (status === 'coming_soon') {
    const filter = { status: 'coming_soon' }
    const [items, total] = await Promise.all([
      Movie.find(filter).collation({ locale: 'en' }).sort({ releaseDate: 1, title: 1 }).skip(skip).limit(limit),
      Movie.countDocuments(filter),
    ])
    return res.json({ items: items.map(listMovie), page, limit, total })
  }

  // Shows per movie in this city, in the next 7 days (started shows do not count)
  const counts = await Show.aggregate([
    { $match: { cityCode: city, status: 'scheduled', startAt: { $gte: new Date(), $lt: istDayToDate(istToday(7)) } } },
    { $group: { _id: '$movieId', shows: { $sum: 1 } } },
  ])
  const showsOf = new Map(counts.map((c) => [String(c._id), c.shows]))
  const movies = await Movie.find({ _id: { $in: counts.map((c) => c._id) }, status: 'now_showing' })
  movies.sort(
    (a, b) => showsOf.get(String(b._id)) - showsOf.get(String(a._id)) || b.releaseDate - a.releaseDate || a.title.localeCompare(b.title, 'en'),
  )
  res.json({ items: movies.slice(skip, skip + limit).map(listMovie), page, limit, total: movies.length })
}
