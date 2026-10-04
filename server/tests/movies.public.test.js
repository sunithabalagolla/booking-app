import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Movie } from '../src/models/Movie.js'
import { Show } from '../src/models/Show.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// U-05 GET /api/movies (guests): Now showing in a city + Coming soon

const makeMovie = (title, fields = {}) =>
  Movie.create({
    title,
    posterUrl: '/api/uploads/files/p.png',
    genres: ['Drama'],
    languages: ['Hindi'],
    durationMinutes: 120,
    certificate: 'UA',
    releaseDate: istDayToDate(istToday(-10)),
    status: 'now_showing',
    ...fields,
  })

const HOUR = 60 * 60 * 1000
// A show only needs the fields the list looks at (inserted raw, no full layout)
const makeShow = (movie, { cityCode = 'hyderabad', startAt = new Date(Date.now() + 24 * HOUR), status = 'scheduled', ...extra } = {}) =>
  Show.collection.insertOne({
    movieId: movie._id,
    cityCode,
    startAt,
    endAt: new Date(startAt.getTime() + 2 * HOUR),
    status,
    language: 'Hindi',
    format: '2D',
    subtitles: false,
    wheelchairFriendly: false,
    tags: [],
    ...extra,
  })

const list = (query) => request(app).get(`/api/movies?${query}`)

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([Movie.init(), Show.init()])
})
beforeEach(clearTestDB)
afterAll(closeTestDB)

describe('GET /api/movies?status=now_showing (U-05)', () => {
  it('only movies with a scheduled show in this city in the next 7 days; most shows first', async () => {
    const busy = await makeMovie('Busy')
    const quiet = await makeMovie('Quiet')
    const elsewhere = await makeMovie('Elsewhere')
    const later = await makeMovie('Next Week')
    const old = await makeMovie('Started')
    const cancelled = await makeMovie('Cancelled')
    const inactive = await makeMovie('Inactive', { status: 'inactive' })

    await makeShow(busy)
    await makeShow(busy, { startAt: new Date(Date.now() + 48 * HOUR) })
    await makeShow(quiet)
    await makeShow(elsewhere, { cityCode: 'chennai' })
    await makeShow(later, { startAt: istDayToDate(istToday(7)) }) // day 8 starts: too late
    await makeShow(old, { startAt: new Date(Date.now() - HOUR) }) // already started
    await makeShow(cancelled, { status: 'cancelled' })
    await makeShow(inactive)

    const res = await list('city=hyderabad')
    expect(res.status).toBe(200)
    expect(res.body.items.map((m) => m.title)).toEqual(['Busy', 'Quiet'])
    expect(res.body).toMatchObject({ total: 2, page: 1 })
    expect(res.body.items[0]).toEqual({
      id: String(busy._id),
      title: 'Busy',
      tagline: null,
      posterUrl: '/api/uploads/files/p.png',
      trailerUrl: null,
      certificate: 'UA',
      languages: ['Hindi'],
      genres: ['Drama'],
      durationMinutes: 120,
      releaseDate: istToday(-10),
      status: 'now_showing',
    })
  })

  it('same number of shows → newest release first, then A to Z; pages work', async () => {
    const older = await makeMovie('Older', { releaseDate: istDayToDate(istToday(-20)) })
    const b = await makeMovie('B Movie')
    const a = await makeMovie('A Movie')
    for (const m of [older, b, a]) await makeShow(m)

    expect((await list('city=hyderabad')).body.items.map((m) => m.title)).toEqual(['A Movie', 'B Movie', 'Older'])
    const page2 = await list('city=hyderabad&limit=2&page=2')
    expect(page2.body.items.map((m) => m.title)).toEqual(['Older'])
    expect(page2.body.total).toBe(3)
  })

  it('a city with no shows → empty list; no city → 400', async () => {
    expect((await list('city=mumbai')).body).toMatchObject({ items: [], total: 0 })
    expect((await list('')).status).toBe(400)
  })
})

describe('GET /api/movies?status=coming_soon (U-05)', () => {
  it('all Coming soon movies in every city, soonest release first', async () => {
    await makeMovie('Far', { status: 'coming_soon', releaseDate: istDayToDate(istToday(20)) })
    await makeMovie('Near', { status: 'coming_soon', releaseDate: istDayToDate(istToday(3)) })
    await makeMovie('Showing')

    for (const city of ['hyderabad', 'mumbai']) {
      const res = await list(`city=${city}&status=coming_soon`)
      expect(res.body.items.map((m) => m.title), city).toEqual(['Near', 'Far'])
    }
    expect((await list(`city=x&status=coming_soon&limit=1`)).body).toMatchObject({ total: 2, items: [{ title: 'Near' }] })
  })

  it('an unknown status → 400', async () => {
    expect((await list('city=hyderabad&status=inactive')).status).toBe(400)
  })
})

// The aggregate uses the movie IDs; make sure an ID with no movie is simply skipped
it('a show of a deleted movie is ignored', async () => {
  await Show.collection.insertOne({ movieId: new mongoose.Types.ObjectId(), cityCode: 'hyderabad', startAt: new Date(Date.now() + HOUR), status: 'scheduled' })
  expect((await list('city=hyderabad')).body.items).toEqual([])
})

describe('U-06 search + filters, SF-08 (combine with AND)', () => {
  let monsoon, kadal, ghost
  const titles = async (query) => (await list(`city=hyderabad&${query}`)).body.items.map((m) => m.title).sort()

  beforeEach(async () => {
    monsoon = await makeMovie('Operation Monsoon', { languages: ['Hindi', 'Tamil'], genres: ['Action', 'Thriller'] })
    kadal = await makeMovie('Kadal Kaatru', { languages: ['Tamil', 'Telugu'], genres: ['Romance', 'Musical'] })
    ghost = await makeMovie('Ghost of Gulmohar Lane', { languages: ['Hindi'], genres: ['Horror'], certificate: 'A' })
    await makeShow(monsoon, { language: 'Hindi', format: '3D', subtitles: true }) // only Hindi shows here
    await makeShow(monsoon, { language: 'Hindi', format: '2D', wheelchairFriendly: true })
    await makeShow(kadal, { language: 'Telugu', tags: ['parent_baby'], wheelchairFriendly: true })
    await makeShow(ghost, { language: 'Hindi', subtitles: true })
  })

  it('q = part of the title, any case; special characters are plain letters', async () => {
    expect(await titles('q=monso')).toEqual(['Operation Monsoon'])
    expect(await titles('q=KAAT')).toEqual(['Kadal Kaatru'])
    expect(await titles('q=.*')).toEqual([])
  })

  it('language = the language of a show in this city (not just the movie)', async () => {
    expect(await titles('language=Tamil')).toEqual([]) // Monsoon and Kadal exist in Tamil, but no Tamil shows here
    expect(await titles('language=Telugu')).toEqual(['Kadal Kaatru'])
    expect(await titles('language=Tamil,Telugu')).toEqual(['Kadal Kaatru']) // several = any of them
  })

  it('genre: any of the picked genres', async () => {
    expect(await titles('genre=Horror')).toEqual(['Ghost of Gulmohar Lane'])
    expect(await titles('genre=Horror,Romance')).toEqual(['Ghost of Gulmohar Lane', 'Kadal Kaatru'])
  })

  it('format and SF-08 filters', async () => {
    expect(await titles('format=3D')).toEqual(['Operation Monsoon'])
    expect(await titles('subtitles=true')).toEqual(['Ghost of Gulmohar Lane', 'Operation Monsoon'])
    expect(await titles('wheelchair=true')).toEqual(['Kadal Kaatru', 'Operation Monsoon'])
    expect(await titles('parentBaby=true')).toEqual(['Kadal Kaatru'])
  })

  it('filters combine with AND; show filters must match the SAME show', async () => {
    expect(await titles('subtitles=true&genre=Action')).toEqual(['Operation Monsoon'])
    expect(await titles('format=3D&wheelchair=true')).toEqual([]) // Monsoon: the 3D show has no wheelchair space, the wheelchair show is 2D
    expect(await titles('format=2D&wheelchair=true')).toEqual(['Kadal Kaatru', 'Operation Monsoon'])
    expect(await titles('q=o&language=Hindi&subtitles=true')).toEqual(['Ghost of Gulmohar Lane', 'Operation Monsoon'])
  })

  it('coming soon: name, movie language and genre; any show filter → empty', async () => {
    await makeMovie('Chandamama Express', { status: 'coming_soon', languages: ['Kannada', 'Telugu'], genres: ['Family'], releaseDate: istDayToDate(istToday(5)) })
    const soon = async (query) => (await list(`city=hyderabad&status=coming_soon&${query}`)).body.items.map((m) => m.title)
    expect(await soon('q=chanda')).toEqual(['Chandamama Express'])
    expect(await soon('language=Telugu')).toEqual(['Chandamama Express']) // the movie's language: no shows yet
    expect(await soon('genre=Horror')).toEqual([])
    expect(await soon('format=2D')).toEqual([])
    expect(await soon('subtitles=true')).toEqual([])
  })

  it('refuses unknown values', async () => {
    for (const query of ['language=Klingon', 'genre=Western', 'format=4D', 'subtitles=yes', `q=${'x'.repeat(101)}`]) {
      expect((await list(`city=hyderabad&${query}`)).status, query).toBe(400)
    }
  })
})
