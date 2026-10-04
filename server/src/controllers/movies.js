import { Movie } from '../models/Movie.js'
import { Show } from '../models/Show.js'
import { escapeRegex } from '../utils/escapeRegex.js'
import { dateToIstDay, istDayToDate, istToday } from '../utils/time.js'

// Public movie lists for users and guests (api.md Section 5: GET /api/movies).
// U-05 (decided 2026-10-04):
// - now_showing = "Now showing" movies with a scheduled show in the city from now
//   until the end of day 7 (today … +6, like U-09). Most shows first (the first one is
//   the marquee banner), then the newest release, then A to Z.
// - coming_soon = all "Coming soon" movies, the same in every city, soonest release first.
// U-06 + SF-08 filters (decided 2026-10-04), all combined with AND:
// - q = part of the title, any case
// - language / genre = any of the picked values. For now_showing the language is the
//   language of a SHOW in the city (a Hindi + Tamil movie may have only Hindi shows here);
//   for coming_soon (no shows yet) it is the movie's languages
// - format, subtitles, wheelchair, parentBaby look at the shows: one show must match all
//   of them. Coming soon movies have no shows, so these filters leave that list empty.

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

// Show filters of the request (empty object = none)
function showFilters({ format, subtitles, wheelchair, parentBaby }) {
  return {
    ...(format && { format }),
    ...(subtitles && { subtitles: true }),
    ...(wheelchair && { wheelchairFriendly: true }),
    ...(parentBaby && { tags: 'parent_baby' }),
  }
}

// GET /api/movies?city=&status=&q=&language=&genre=&format=&subtitles=&wheelchair=&parentBaby=
export async function listMovies(req, res) {
  const { city, status, q, language, genre, page, limit } = req.valid.query
  const skip = (page - 1) * limit
  const movieFilter = {
    ...(q && { title: { $regex: escapeRegex(q), $options: 'i' } }),
    ...(genre?.length && { genres: { $in: genre } }),
  }
  const byShow = showFilters(req.valid.query)

  if (status === 'coming_soon') {
    // No shows yet, so a show filter can never match
    if (Object.keys(byShow).length) return res.json({ items: [], page, limit, total: 0 })
    const filter = { ...movieFilter, status: 'coming_soon', ...(language?.length && { languages: { $in: language } }) }
    const [items, total] = await Promise.all([
      Movie.find(filter).collation({ locale: 'en' }).sort({ releaseDate: 1, title: 1 }).skip(skip).limit(limit),
      Movie.countDocuments(filter),
    ])
    return res.json({ items: items.map(listMovie), page, limit, total })
  }

  // Matching shows per movie in this city, in the next 7 days (started shows do not count)
  const counts = await Show.aggregate([
    {
      $match: {
        cityCode: city,
        status: 'scheduled',
        startAt: { $gte: new Date(), $lt: istDayToDate(istToday(7)) },
        ...byShow,
        ...(language?.length && { language: { $in: language } }),
      },
    },
    { $group: { _id: '$movieId', shows: { $sum: 1 } } },
  ])
  const showsOf = new Map(counts.map((c) => [String(c._id), c.shows]))
  const movies = await Movie.find({ ...movieFilter, _id: { $in: counts.map((c) => c._id) }, status: 'now_showing' })
  movies.sort(
    (a, b) => showsOf.get(String(b._id)) - showsOf.get(String(a._id)) || b.releaseDate - a.releaseDate || a.title.localeCompare(b.title, 'en'),
  )
  res.json({ items: movies.slice(skip, skip + limit).map(listMovie), page, limit, total: movies.length })
}
