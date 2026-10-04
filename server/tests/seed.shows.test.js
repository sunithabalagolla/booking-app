import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Show } from '../src/models/Show.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import moviesStep from '../src/seed/steps/movies.js'
import screensStep from '../src/seed/steps/screens.js'
import settingsStep from '../src/seed/steps/settings.js'
import showsStep, { SEED_DAYS } from '../src/seed/steps/shows.js'
import theatresStep from '../src/seed/steps/theatres.js'
import usersStep from '../src/seed/steps/users.js'
import { showLabel } from '../src/utils/showTime.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  process.env.SEED_PASSWORD = 'test-only-seed-pass1'
  await connectTestDB()
  await Promise.all([User.init(), Theatre.init(), Screen.init(), Movie.init(), Show.init()])
})
beforeEach(async () => {
  await clearTestDB()
  for (const step of [settingsStep, usersStep, moviesStep, theatresStep, screensStep]) await step.run()
})
afterAll(closeTestDB)

describe('seed step: shows (15.5)', () => {
  it('makes 4 shows per screen per day for 7 days; running again adds nothing', async () => {
    await showsStep.run()
    await showsStep.run()
    expect(await Show.countDocuments({ isSample: true })).toBe(12 * 4 * SEED_DAYS)
  })

  it('no overlaps (T-08), right labels and prices, never parent-and-baby on an "A" movie', async () => {
    await showsStep.run()
    const movies = await Movie.find()
    for (const screen of await Screen.find()) {
      const shows = await Show.find({ screenId: screen._id }).sort({ startAt: 1 })
      for (let i = 1; i < shows.length; i++) expect(shows[i].startAt >= shows[i - 1].endAt, `${screen._id} ${i}`).toBe(true)
      for (const show of shows) {
        const movie = movies.find((m) => String(m._id) === String(show.movieId))
        expect(movie.status).toBe('now_showing')
        expect(movie.languages).toContain(show.language)
        expect(show.label).toBe(showLabel(show.startAt))
        expect(show.endAt - show.startAt).toBe((movie.durationMinutes + screen.cleaningBreakMinutes) * 60000)
        expect(show.prices.map((p) => p.seatClass)).toEqual(['balcony', 'first', 'second'].filter((c) => screen.seatCount[c] > 0))
        if (movie.certificate === 'A') expect(show.tags).not.toContain('parent_baby')
      }
    }
    expect(await Show.countDocuments({ tags: 'parent_baby' })).toBeGreaterThan(0)
    expect(await Show.countDocuments({ subtitles: true })).toBeGreaterThan(0)
  })
})
