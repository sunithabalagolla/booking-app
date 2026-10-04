import { Movie } from '../../models/Movie.js'
import { Screen } from '../../models/Screen.js'
import { Show } from '../../models/Show.js'
import { Theatre } from '../../models/Theatre.js'
import { SEAT_CLASSES } from '../../utils/seatLayout.js'
import { istDateTime, showEnd, showLabel } from '../../utils/showTime.js'
import { istToday } from '../../utils/time.js'
import { SAMPLE } from '../sample.js'

// Seed step: sample shows for the next 7 days (today + 6) on every sample screen (15.5).
// 4 shows a day per screen, with the "Now showing" movies taking turns. Times leave room
// for the longest movie + cleaning break, so seeded shows never overlap (T-08).
// Some shows have subtitles or the parent-and-baby tag (never on an "A" movie), for SF-08.
// Existing shows are never changed ($setOnInsert): running the seed on another day only
// adds the new days. A time that would overlap a show made by hand is skipped.

export const SHOW_TIMES = {
  'Screen 1': ['09:30', '13:00', '16:30', '20:00'],
  'Screen 2': ['10:00', '14:00', '18:00', '21:45'],
}
export const SAMPLE_PRICES = { balcony: 25000, first: 18000, second: 12000 } // GST included
const EXTRA_3D_PAISE = 5000
export const SEED_DAYS = 7

export default {
  name: 'shows',
  async run() {
    const movies = await Movie.find({ status: 'now_showing', isSample: true }).sort({ title: 1 }) // sample movies only, never real ones
    if (movies.length === 0) return ['Shows: none (no Now showing movies)']

    const theatres = await Theatre.find({ isSample: true, status: 'approved' })
    const screens = await Screen.find({ theatreId: { $in: theatres.map((t) => t._id) }, isSample: true })
    let added = 0
    let skipped = 0

    for (const screen of screens) {
      const theatre = theatres.find((t) => String(t._id) === String(screen.theatreId))
      const times = SHOW_TIMES[screen.name] ?? SHOW_TIMES['Screen 1']
      const screenNo = screens.indexOf(screen)
      const { balcony, first, second } = screen.seatCount
      // This screen's shows, read once (the checks below run in memory)
      const existing = await Show.find({ screenId: screen._id, status: 'scheduled', endAt: { $gt: istDateTime(istToday(), '00:00') } }, 'startAt endAt')
      const writes = []

      for (let d = 0; d < SEED_DAYS; d++) {
        const day = istToday(d)
        // Turns based on the calendar day, so a day keeps its movies when the seed runs again
        const dayNo = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000)
        for (const [slot, time] of times.entries()) {
          const movie = movies[(dayNo + slot + screenNo) % movies.length]
          const startAt = istDateTime(day, time)
          const endAt = showEnd(startAt, movie.durationMinutes, screen.cleaningBreakMinutes)

          if (existing.some((s) => s.startAt.getTime() === startAt.getTime())) continue // already seeded
          if (existing.some((s) => s.startAt < endAt && s.endAt > startAt)) {
            skipped += 1
            continue
          }

          const parentBaby = slot === 0 && screen.name === 'Screen 1' && dayNo % 2 === 0 && movie.certificate !== 'A'
          const extra = screen.format === '3D' ? EXTRA_3D_PAISE : 0
          writes.push({
            updateOne: {
              filter: { screenId: screen._id, startAt },
              upsert: true,
              update: {
                $setOnInsert: {
                  movieId: movie._id,
                  theatreId: theatre._id,
                  screenId: screen._id,
                  ownerId: theatre.ownerId,
                  cityCode: theatre.cityCode,
                  startAt,
                  endAt,
                  label: showLabel(startAt),
                  language: movie.languages[slot % movie.languages.length],
                  format: screen.format,
                  subtitles: slot === 1,
                  tags: parentBaby ? ['parent_baby'] : [],
                  wheelchairFriendly: screen.wheelchairFriendly,
                  prices: SEAT_CLASSES.filter((c) => screen.seatCount[c] > 0).map((c) => ({ seatClass: c, pricePaise: SAMPLE_PRICES[c] + extra })),
                  layout: screen.toObject().layout,
                  totalSeats: balcony + first + second,
                  bookedCount: 0,
                  status: 'scheduled',
                  ...SAMPLE,
                },
              },
            },
          })
        }
      }
      if (writes.length) added += (await Show.bulkWrite(writes)).upsertedCount
    }
    const lines = [`Shows: ${added} new sample shows (next ${SEED_DAYS} days, 4 per screen per day)`]
    if (skipped) lines.push(`Shows: ${skipped} skipped (would overlap a show made by hand)`)
    return lines
  },
}
