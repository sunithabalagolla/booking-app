import mongoose from 'mongoose'
import { findOwned } from '../middleware/ownership.js'
import { Movie } from '../models/Movie.js'
import { Screen } from '../models/Screen.js'
import { Show } from '../models/Show.js'
import { Theatre } from '../models/Theatre.js'
import { cancelShow, showCancelPreview } from '../services/showCancel.js'
import { runCancellationsSoon } from '../jobs/cancellationRefunds.js'
import { AppError } from '../utils/AppError.js'
import { CLASS_NAMES, SEAT_CLASSES } from '../utils/seatLayout.js'
import { formatShortDay, istParts, istDateTime, showEnd, showLabel } from '../utils/showTime.js'
import { dateToIstDay, istDayToDate, istToday } from '../utils/time.js'
import { MAX_DAYS_AHEAD } from '../validation/shows.js'

// O-05 owner shows (api.md Section 8). Own screens / shows only (ROLE-02).
// Rules (requirements O-05, decided 2026-10-04):
// - the theatre must be approved (ROLE-04); the movie must not be inactive
// - language = one of the movie's languages; 3D only on a 3D screen (2D on 3D is fine)
// - parent-and-baby tag never on an "A" movie
// - a price (whole rupees ₹1–₹5,000) for every seat class the screen has
// - dates: start in the future, at most 30 days ahead, not before the movie's release day
// - end = start + duration + cleaning break (BR-10); label from the IST start (BR-22)
// - no overlap on the same screen (T-08); several dates = all or none
// - edit only while the show has no bookings; no delete (cancel = O-06)

const DAY_MS = 24 * 60 * 60 * 1000

const fieldErrors = (details) => new AppError(400, 'VALIDATION_ERROR', 'Please check the form.', details)

// What the API sends. movieId / theatreId / screenId may be populated.
export function publicShow(show) {
  const start = istParts(show.startAt)
  const end = istParts(show.endAt)
  const ref = (value, fields) => (value && value._id ? { id: String(value._id), ...Object.fromEntries(fields.map((f) => [f, value[f]])) } : { id: String(value) })
  return {
    id: String(show._id),
    movie: ref(show.movieId, ['title', 'certificate', 'durationMinutes']),
    theatre: ref(show.theatreId, ['name']),
    screen: ref(show.screenId, ['name']),
    startAt: show.startAt,
    endAt: show.endAt,
    date: start.date, // IST
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    label: show.label,
    language: show.language,
    format: show.format,
    subtitles: show.subtitles,
    tags: show.tags ?? [],
    wheelchairFriendly: show.wheelchairFriendly,
    prices: show.prices.map(({ seatClass, pricePaise }) => ({ seatClass, pricePaise })),
    totalSeats: show.totalSeats,
    bookedCount: show.bookedCount,
    status: show.status,
    cancelReason: show.cancelReason ?? null, // O-06
    cancelledAt: show.cancelledAt ?? null,
  }
}

export const POPULATE = [
  { path: 'movieId', select: 'title certificate durationMinutes' },
  { path: 'theatreId', select: 'name' },
  { path: 'screenId', select: 'name' },
]

// Screen (own), its theatre and the movie
async function loadContext(user, { movieId, screenId }) {
  const screen = await findOwned(Screen, screenId, user)
  const [theatre, movie] = await Promise.all([Theatre.findById(screen.theatreId), Movie.findById(movieId)])
  if (!movie) throw fieldErrors({ movieId: 'Please pick a movie.' })
  return { screen, theatre, movie }
}

// Every rule except overlap. Throws one error with all field problems.
function checkRules({ screen, theatre, movie }, input, days, now = new Date()) {
  if (theatre.status !== 'approved') {
    throw new AppError(400, 'RULE_BROKEN', 'Shows can be added only after the admin approves this theatre.', { rule: 'ROLE-04', reason: 'theatre_not_approved' })
  }

  const errors = {}
  if (movie.status === 'inactive') errors.movieId = 'This movie is inactive. Please pick another movie.'
  if (!movie.languages.includes(input.language)) errors.language = `${movie.title} is not in ${input.language}. Please pick one of: ${movie.languages.join(', ')}.`
  if (input.format === '3D' && screen.format !== '3D') errors.format = 'A 3D show needs a 3D screen.'
  if (input.tags.includes('parent_baby') && movie.certificate === 'A') errors.tags = 'Parent-and-baby shows are not allowed for "A" movies.'

  const needed = SEAT_CLASSES.filter((c) => screen.seatCount[c] > 0)
  const given = input.prices.map((p) => p.seatClass)
  if (needed.length !== given.length || needed.some((c) => !given.includes(c))) {
    errors.prices = `Please enter one price for each seat class of this screen: ${needed.map((c) => CLASS_NAMES[c]).join(', ')}.`
  }

  const lastDay = istToday(MAX_DAYS_AHEAD, now)
  const releaseDay = dateToIstDay(movie.releaseDate)
  const bad = []
  for (const day of days) {
    if (istDateTime(day, input.startTime) <= now) bad.push(`${formatShortDay(day)} (already started)`)
    else if (day > lastDay) bad.push(`${formatShortDay(day)} (more than ${MAX_DAYS_AHEAD} days ahead)`)
    else if (day < releaseDay) bad.push(`${formatShortDay(day)} (before the release on ${formatShortDay(releaseDay)})`)
  }
  if (bad.length) errors.dates = `These dates cannot be used: ${bad.join(', ')}.`

  if (Object.keys(errors).length) throw fieldErrors(errors)
}

// The show document for one IST day (layout copied from the screen)
function buildShow({ screen, theatre, movie }, input, day) {
  const startAt = istDateTime(day, input.startTime)
  const { balcony, first, second } = screen.seatCount
  return {
    movieId: movie._id,
    theatreId: theatre._id,
    screenId: screen._id,
    ownerId: theatre.ownerId,
    cityCode: theatre.cityCode,
    startAt,
    endAt: showEnd(startAt, movie.durationMinutes, screen.cleaningBreakMinutes),
    label: showLabel(startAt),
    language: input.language,
    format: input.format,
    subtitles: input.subtitles,
    tags: input.tags,
    wheelchairFriendly: screen.wheelchairFriendly,
    prices: SEAT_CLASSES.filter((c) => input.prices.some((p) => p.seatClass === c)).map((c) => input.prices.find((p) => p.seatClass === c)),
    layout: screen.toObject().layout,
    totalSeats: balcony + first + second,
    status: 'scheduled',
  }
}

// Saves inside a transaction with the overlap check (T-08). `save(session)` does the write.
// The screen's showLock is changed first, so two saves on one screen cannot both pass.
async function saveWithoutOverlap(screenId, docs, save, { exceptId } = {}) {
  let result
  await mongoose.connection.transaction(async (session) => {
    await Screen.updateOne({ _id: screenId }, { $inc: { showLock: 1 } }, { session })
    const clashes = await Show.find(
      {
        screenId,
        status: 'scheduled',
        ...(exceptId && { _id: { $ne: exceptId } }),
        $or: docs.map((d) => ({ startAt: { $lt: d.endAt }, endAt: { $gt: d.startAt } })),
      },
      null,
      { session },
    ).sort({ startAt: 1 })
    if (clashes.length) throw await overlapError(docs, clashes, session)
    result = await save(session)
  })
  return result
}

async function overlapError(docs, clashes, session) {
  const movies = await Movie.find({ _id: { $in: clashes.map((c) => c.movieId) } }, 'title', { session })
  const title = (id) => movies.find((m) => String(m._id) === String(id))?.title ?? 'a show'
  const dates = docs.filter((d) => clashes.some((c) => c.startAt < d.endAt && c.endAt > d.startAt)).map((d) => istParts(d.startAt).date)
  const list = clashes.map((c) => ({ date: istParts(c.startAt).date, startTime: istParts(c.startAt).time, endTime: istParts(c.endAt).time, movieTitle: title(c.movieId) }))
  return new AppError(409, 'SHOW_OVERLAP', 'This screen already has a show at that time (incl. the cleaning break). Nothing was saved.', { dates, clashes: list })
}

// GET /api/owner/movies: movies owners can pick (Now showing + Coming soon)
export async function listOwnerMovies(req, res) {
  const movies = await Movie.find({ status: { $in: ['now_showing', 'coming_soon'] } })
    .collation({ locale: 'en' })
    .sort({ title: 1 })
  res.json({
    items: movies.map((m) => ({
      id: String(m._id),
      title: m.title,
      languages: m.languages,
      durationMinutes: m.durationMinutes,
      certificate: m.certificate,
      status: m.status,
      releaseDate: dateToIstDay(m.releaseDate),
    })),
  })
}

// GET /api/owner/shows: my shows from `from` to `to` (IST days; default the next 7 days)
export async function listMyShows(req, res) {
  const { theatreId, screenId, page, limit } = req.valid.query
  const from = req.valid.query.from ?? istToday()
  const to = req.valid.query.to ?? dateToIstDay(new Date(istDayToDate(from).getTime() + 6 * DAY_MS))
  if (to < from) throw fieldErrors({ to: 'The end date must be on or after the start date.' })

  const filter = {
    ownerId: req.user._id,
    ...(theatreId && { theatreId }),
    ...(screenId && { screenId }),
    startAt: { $gte: istDayToDate(from), $lt: new Date(istDayToDate(to).getTime() + DAY_MS) },
  }
  const [items, total] = await Promise.all([
    Show.find(filter)
      .sort({ startAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE),
    Show.countDocuments(filter),
  ])
  res.json({ items: items.map(publicShow), page, limit, total, from, to })
}

// GET /api/owner/shows/:id
export async function getMyShow(req, res) {
  const show = await findOwned(Show, req.valid.params.id, req.user)
  await show.populate(POPULATE)
  res.json({ show: publicShow(show) })
}

// POST /api/owner/shows: one show per date, all or none
export async function createShows(req, res) {
  const input = req.valid.body
  const ctx = await loadContext(req.user, input)
  const days = [...input.dates].sort()
  checkRules(ctx, input, days)

  const docs = days.map((day) => buildShow(ctx, input, day))
  const created = await saveWithoutOverlap(ctx.screen._id, docs, (session) => Show.insertMany(docs, { session }))
  const shows = await Show.find({ _id: { $in: created.map((s) => s._id) } })
    .sort({ startAt: 1 })
    .populate(POPULATE)
  res.status(201).json({ items: shows.map(publicShow) })
}

// PATCH /api/owner/shows/:id: only before the start and while it has no bookings
export async function updateShow(req, res) {
  const show = await findOwned(Show, req.valid.params.id, req.user)
  if (show.status !== 'scheduled') throw new AppError(400, 'RULE_BROKEN', 'A cancelled show cannot be edited.', { rule: 'O-05', reason: 'cancelled' })
  if (show.startAt <= new Date()) throw new AppError(400, 'RULE_BROKEN', 'This show has already started, so it cannot be edited.', { rule: 'O-05', reason: 'started' })
  const hasBookings = await mongoose.connection.db.collection('bookings').countDocuments({ showId: show._id }, { limit: 1 })
  if (hasBookings) throw new AppError(409, 'IN_USE', 'This show already has bookings, so it cannot be edited. Cancel the show instead.')

  const body = req.valid.body
  const start = istParts(show.startAt)
  const input = {
    movieId: body.movieId ?? String(show.movieId),
    screenId: body.screenId ?? String(show.screenId),
    startTime: body.startTime ?? start.time,
    language: body.language ?? show.language,
    format: body.format ?? show.format,
    subtitles: body.subtitles ?? show.subtitles,
    tags: body.tags ?? [...show.tags],
    prices: body.prices ?? show.prices.map(({ seatClass, pricePaise }) => ({ seatClass, pricePaise })),
  }
  const day = body.date ?? start.date
  const ctx = await loadContext(req.user, input)
  checkRules(ctx, input, [day])

  const doc = buildShow(ctx, input, day)
  await saveWithoutOverlap(ctx.screen._id, [doc], (session) => show.set(doc).save({ session }), { exceptId: show._id })
  await show.populate(POPULATE)
  res.json({ show: publicShow(show) })
}

// O-06 (owner: own shows; admin: any show, same handlers, findOwned allows all for admin)
// GET /shows/:id/cancel-preview → { bookings, refundPaise } (BR-06: 100% back)
export async function cancelShowPreview(req, res) {
  const show = await findOwned(Show, req.valid.params.id, req.user)
  res.json(await showCancelPreview(show))
}

// POST /shows/:id/cancel { reason } → { show, bookings, refundPaise }. Refunds + E-05 by JOB-04.
export async function cancelOwnedShow(req, res) {
  const show = await findOwned(Show, req.valid.params.id, req.user)
  const result = await cancelShow(show, req.valid.body.reason, req)
  runCancellationsSoon() // JOB-04 now, not in up to a minute
  await result.show.populate(POPULATE)
  res.json({ show: publicShow(result.show), bookings: result.bookings, refundPaise: result.refundPaise })
}
