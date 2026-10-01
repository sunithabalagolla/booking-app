import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { Movie } from '../src/models/Movie.js'
import { posterSvg } from '../src/seed/posters.js'
import moviesStep from '../src/seed/steps/movies.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  await connectTestDB()
  await Movie.init()
})
beforeEach(clearTestDB)
afterAll(closeTestDB)

describe('seed step: movies (15.5)', () => {
  it('makes 6 sample movies: 4 now showing, 2 coming soon, with working poster links', async () => {
    await moviesStep.run()

    expect(await Movie.countDocuments({ isSample: true })).toBe(6)
    expect(await Movie.countDocuments({ status: 'now_showing' })).toBe(4)
    expect(await Movie.countDocuments({ status: 'coming_soon' })).toBe(2)
    expect(await Movie.countDocuments({ certificate: 'A' })).toBe(1) // for U-08

    // Coming soon movies are released after today
    const soon = await Movie.find({ status: 'coming_soon' })
    for (const movie of soon) expect(movie.releaseDate > istDayToDate(istToday())).toBe(true)

    const movie = await Movie.findOne({ title: 'Kadal Kaatru' })
    const poster = await request(app).get(movie.posterUrl)
    expect(poster.status).toBe(200)
    expect(poster.headers['content-type']).toMatch(/image\/svg\+xml/)
  })

  it('can run twice without duplicates', async () => {
    await moviesStep.run()
    await moviesStep.run()
    expect(await Movie.countDocuments()).toBe(6)
  })
})

describe('posterSvg', () => {
  it('escapes text, so a title cannot break the SVG', () => {
    const svg = posterSvg({ title: 'Tom & <Jerry>', tagline: '"Hi"', languages: ['Hindi'], certificate: 'U', background: '#000', accent: '#fff' })
    expect(svg).toContain('Tom &amp;')
    expect(svg).toContain('&lt;Jerry&gt;')
    expect(svg).not.toContain('<Jerry>')
  })
})
