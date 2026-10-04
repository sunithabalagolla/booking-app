import mongoose from 'mongoose'
import { Movie } from '../models/Movie.js'
import { AppError } from '../utils/AppError.js'
import { dateToIstDay, istDayToDate } from '../utils/time.js'
import { escapeRegex } from '../utils/escapeRegex.js'

// A-02 admin movies (api.md Section 10: /api/admin/movies)

// What the API sends for a movie. releaseDate as the IST day 'YYYY-MM-DD'.
export function publicMovie(movie) {
  return {
    id: String(movie._id),
    title: movie.title,
    posterUrl: movie.posterUrl,
    trailerUrl: movie.trailerUrl ?? null,
    cast: (movie.cast ?? []).map((c) => ({ name: c.name, photoUrl: c.photoUrl ?? null })),
    genres: movie.genres,
    languages: movie.languages,
    durationMinutes: movie.durationMinutes,
    certificate: movie.certificate,
    releaseDate: dateToIstDay(movie.releaseDate),
    status: movie.status,
    ratingAvg: movie.ratingAvg,
    ratingCount: movie.ratingCount,
  }
}

// Body → database fields (empty trailer link = no trailer)
function toDb(body) {
  const fields = { ...body }
  if (body.releaseDate !== undefined) fields.releaseDate = istDayToDate(body.releaseDate)
  if (body.trailerUrl === '') fields.trailerUrl = undefined
  return fields
}

const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this movie.')

// GET /api/admin/movies?q=&status=&page=&limit=  (newest release first)
export async function listMovies(req, res) {
  const { q, status, page, limit } = req.valid.query
  const filter = {}
  if (status) filter.status = status
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' } // part of the title, any case

  const [items, total] = await Promise.all([
    Movie.find(filter).sort({ releaseDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Movie.countDocuments(filter),
  ])
  res.json({ items: items.map(publicMovie), page, limit, total })
}

// GET /api/admin/movies/:id (for the edit form; inactive ones too)
export async function getMovie(req, res) {
  const movie = await Movie.findById(req.valid.params.id)
  if (!movie) throw notFound()
  res.json({ movie: publicMovie(movie), inUse: await isInUse(movie._id) })
}

// POST /api/admin/movies
export async function createMovie(req, res) {
  const movie = await Movie.create(toDb(req.valid.body))
  res.status(201).json({ movie: publicMovie(movie) })
}

// PATCH /api/admin/movies/:id. Status 'inactive' hides it from users and owners.
export async function updateMovie(req, res) {
  const changes = toDb(req.valid.body)
  const update = { $set: {}, $unset: {} }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined && key === 'trailerUrl') update.$unset.trailerUrl = 1
    else if (value !== undefined) update.$set[key] = value
  }
  if (Object.keys(update.$unset).length === 0) delete update.$unset
  const movie = await Movie.findByIdAndUpdate(req.valid.params.id, update, { returnDocument: 'after', runValidators: true })
  if (!movie) throw notFound()
  res.json({ movie: publicMovie(movie) })
}

// Has this movie got shows or bookings? Reads the collections directly, so it
// works before the Show / Booking models exist (O-05, Phase 5).
async function isInUse(movieId) {
  const db = mongoose.connection.db
  const [shows, bookings] = await Promise.all([
    db.collection('shows').countDocuments({ movieId }, { limit: 1 }),
    db.collection('bookings').countDocuments({ movieId }, { limit: 1 }),
  ])
  return shows + bookings > 0
}

// DELETE /api/admin/movies/:id. Only when no shows and no bookings (A-02).
export async function deleteMovie(req, res) {
  const movie = await Movie.findById(req.valid.params.id)
  if (!movie) throw notFound()
  if (await isInUse(movie._id)) {
    throw new AppError(409, 'IN_USE', 'This movie has shows or bookings, so it cannot be deleted. Make it inactive instead.')
  }
  await movie.deleteOne()
  res.status(204).end()
}
