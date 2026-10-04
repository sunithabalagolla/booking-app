import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-05 owner shows + T-08 overlap check on the same screen (BR-10)

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
})

let phone = 9400000000
const makeOwner = (email) => createUser({ email, role: 'owner', phone: String(phone++), owner: { businessName: 'B', approvalStatus: 'approved' } })
const makeTheatre = (ownerId, status = 'approved') =>
  Theatre.create({ ownerId, name: `T ${phone++}`, cityCode: 'hyderabad', address: '12 Station Road, Hyderabad', gstin: '36AABCS1234A1Z5', status })

const S = (seatClass, wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })
async function makeScreen(theatre, { name = 'Screen 1', format = '2D', cleaningBreakMinutes = 15 } = {}) {
  // Balcony + Second class only, 1 wheelchair space
  const built = buildLayout([{ cells: [S('balcony'), S('balcony')] }, { cells: [S('second'), S('second', true)] }])
  return Screen.create({ theatreId: theatre._id, ownerId: theatre.ownerId, name, format, cleaningBreakMinutes, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: built.wheelchairFriendly })
}
const makeMovie = (fields = {}) =>
  Movie.create({
    title: 'Sapnon Ka Safar',
    posterUrl: '/api/uploads/files/p.png',
    genres: ['Drama'],
    languages: ['Hindi', 'English'],
    durationMinutes: 120,
    certificate: 'UA',
    releaseDate: istDayToDate(istToday(-10)),
    status: 'now_showing',
    ...fields,
  })

const DAY1 = istToday(1)
const DAY2 = istToday(2)
const DAY3 = istToday(3)
const PRICES = [
  { seatClass: 'balcony', pricePaise: 25000 },
  { seatClass: 'second', pricePaise: 12000 },
]

let ravi, theatre, screen, movie, aMovie
const body = (change = {}) => ({ movieId: String(movie._id), screenId: String(screen._id), dates: [DAY1], startTime: '14:00', language: 'Hindi', format: '2D', subtitles: false, tags: [], prices: PRICES, ...change })

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), Theatre.init(), Screen.init(), Movie.init(), Show.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await Settings.create({ _id: 'platform', cities: CITIES })
  const owner = await makeOwner('ravi@example.com')
  theatre = await makeTheatre(owner._id)
  screen = await makeScreen(theatre)
  movie = await makeMovie()
  aMovie = await makeMovie({ title: 'Ghost of Gulmohar Lane', certificate: 'A' })
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/owner/shows (O-05)', () => {
  it('makes one show per date with label, end time, copies and IST times', async () => {
    const res = await ravi.post('/api/owner/shows', body({ dates: [DAY2, DAY1], startTime: '14:30', subtitles: true }))
    expect(res.status).toBe(201)
    expect(res.body.items).toHaveLength(2)
    const [first] = res.body.items
    expect(first).toMatchObject({
      date: DAY1, // sorted by start
      startTime: '14:30',
      endTime: '16:45', // 120 min + 15 min cleaning (BR-10)
      label: 'matinee', // BR-22
      language: 'Hindi',
      format: '2D',
      subtitles: true,
      tags: [],
      wheelchairFriendly: true, // copy from the screen
      totalSeats: 4,
      bookedCount: 0,
      status: 'scheduled',
      movie: { title: 'Sapnon Ka Safar' },
      screen: { name: 'Screen 1' },
      theatre: { name: theatre.name },
    })
    expect(first.startAt).toBe(new Date(istDayToDate(DAY1).getTime() + (14 * 60 + 30) * 60000).toISOString())

    const saved = await Show.findById(first.id)
    expect(saved.cityCode).toBe('hyderabad')
    expect(saved.layout.grid.map((r) => r.label)).toEqual(['B', 'A'])
  })

  it('later layout edits do not change the show (it keeps its copy)', async () => {
    const id = (await ravi.post('/api/owner/shows', body())).body.items[0].id
    await ravi.patch(`/api/owner/screens/${screen._id}`, { layout: { rows: 1, cols: 1, grid: [{ cells: [S('first')] }] } })
    const saved = await Show.findById(id)
    expect(saved.layout.rows).toBe(2)
    expect(saved.totalSeats).toBe(4)
  })

  it('ROLE-04: pending or rejected theatre → 400 RULE_BROKEN, nothing saved', async () => {
    for (const status of ['pending', 'rejected']) {
      await Theatre.updateOne({ _id: theatre._id }, { status })
      const res = await ravi.post('/api/owner/shows', body())
      expect(res.status, status).toBe(400)
      expect(res.body.error).toMatchObject({ code: 'RULE_BROKEN', details: { rule: 'ROLE-04' } })
    }
    expect(await Show.countDocuments()).toBe(0)
  })

  it('refuses each broken rule with a message on its field', async () => {
    const inactive = await makeMovie({ title: 'Old', status: 'inactive' })
    const soon = await makeMovie({ title: 'Soon', status: 'coming_soon', releaseDate: istDayToDate(istToday(5)) })
    const cases = [
      ['movieId', { movieId: String(inactive._id) }],
      ['movieId', { movieId: String(new mongoose.Types.ObjectId()) }],
      ['language', { language: 'Tamil' }], // not a language of the movie
      ['format', { format: '3D' }], // 2D screen
      ['tags', { movieId: String(aMovie._id), tags: ['parent_baby'] }], // never on an "A" movie
      ['prices', { prices: [PRICES[0]] }], // Second class missing
      ['prices', { prices: [...PRICES, { seatClass: 'first', pricePaise: 18000 }] }], // no First class on this screen
      ['prices', { prices: [{ seatClass: 'balcony', pricePaise: 24950 }, PRICES[1]] }], // not whole rupees
      ['prices', { prices: [{ seatClass: 'balcony', pricePaise: 500100 }, PRICES[1]] }], // over ₹5,000
      ['dates', { dates: [istToday(-1)] }], // already started
      ['dates', { dates: [istToday(31)] }], // more than 30 days ahead
      ['dates', { movieId: String(soon._id), dates: [istToday(4)] }], // before the release
      ['dates', { dates: Array.from({ length: 15 }, (_, i) => istToday(i + 1)) }], // more than 14
      ['dates', { dates: [DAY1, DAY1] }],
      ['startTime', { startTime: '24:00' }],
    ]
    for (const [field, change] of cases) {
      const res = await ravi.post('/api/owner/shows', body(change))
      expect(res.status, JSON.stringify(change)).toBe(400)
      expect(Object.keys(res.body.error.details ?? {}).some((k) => k.startsWith(field)), `${field}: ${JSON.stringify(res.body.error)}`).toBe(true)
    }
    expect(await Show.countDocuments()).toBe(0)
  })

  it('the dates message names the days like "Sun 4 Oct"', async () => {
    const res = await ravi.post('/api/owner/shows', body({ dates: [istToday(-1)] }))
    expect(res.body.error.details.dates).toMatch(/^These dates cannot be used: (Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} [A-Z][a-z]{2} \(already started\)\.$/)
  })

  it('allowed: 2D on a 3D screen, "A" movie without the tag, parent-and-baby on a U/A movie, coming soon from its release day', async () => {
    const screen3d = await makeScreen(theatre, { name: 'Screen 2', format: '3D' })
    const soon = await makeMovie({ title: 'Soon', status: 'coming_soon', releaseDate: istDayToDate(istToday(5)) })
    const ok = [
      { screenId: String(screen3d._id), format: '2D' },
      { screenId: String(screen3d._id), format: '3D', dates: [DAY2] },
      { movieId: String(aMovie._id), dates: [DAY3] },
      { tags: ['parent_baby'], dates: [istToday(4)] },
      { movieId: String(soon._id), dates: [istToday(5)] },
      { dates: [istToday(30)] },
    ]
    for (const change of ok) expect((await ravi.post('/api/owner/shows', body(change))).status, JSON.stringify(change)).toBe(201)
  })

  it("another owner's screen → 404", async () => {
    const other = await makeOwner('sita@example.com')
    const otherScreen = await makeScreen(await makeTheatre(other._id))
    expect((await ravi.post('/api/owner/shows', body({ screenId: String(otherScreen._id) }))).status).toBe(404)
  })
})

describe('T-08: no overlap on the same screen (BR-10)', () => {
  // Existing show on DAY1: 14:00 → 16:15 (120 min + 15 min cleaning)
  beforeEach(async () => {
    expect((await ravi.post('/api/owner/shows', body())).status).toBe(201)
  })

  it('refuses a show that overlaps in any way; the cleaning break counts', async () => {
    const long = await makeMovie({ title: 'Long', durationMinutes: 300 })
    const cases = [
      { startTime: '15:00' }, // starts inside
      { startTime: '13:00' }, // ends inside (13:00 → 15:15)
      { startTime: '16:10' }, // inside the cleaning break
      { startTime: '13:00', movieId: String(long._id) }, // covers it all
      { startTime: '14:00' }, // same time
    ]
    for (const change of cases) {
      const res = await ravi.post('/api/owner/shows', body(change))
      expect(res.status, JSON.stringify(change)).toBe(409)
      expect(res.body.error.code).toBe('SHOW_OVERLAP')
      expect(res.body.error.details).toMatchObject({ dates: [DAY1], clashes: [{ date: DAY1, startTime: '14:00', endTime: '16:15', movieTitle: 'Sapnon Ka Safar' }] })
    }
    expect(await Show.countDocuments()).toBe(1)
  })

  it('touching edges are fine: ends exactly at the start, starts exactly at the end', async () => {
    expect((await ravi.post('/api/owner/shows', body({ startTime: '11:45' }))).status).toBe(201) // 11:45 → 14:00
    expect((await ravi.post('/api/owner/shows', body({ startTime: '16:15' }))).status).toBe(201) // 16:15 → 18:30
  })

  it('another screen at the same time is fine; a cancelled show does not block', async () => {
    const screen2 = await makeScreen(theatre, { name: 'Screen 2' })
    expect((await ravi.post('/api/owner/shows', body({ screenId: String(screen2._id) }))).status).toBe(201)
    await Show.updateMany({ screenId: screen._id }, { status: 'cancelled' })
    expect((await ravi.post('/api/owner/shows', body())).status).toBe(201)
  })

  it('several dates: all or none; the refused dates are listed', async () => {
    const res = await ravi.post('/api/owner/shows', body({ dates: [DAY3, DAY1, DAY2] }))
    expect(res.status).toBe(409)
    expect(res.body.error.details.dates).toEqual([DAY1])
    expect(await Show.countDocuments()).toBe(1)
  })

  it('two saves at the same moment on the same screen: exactly one wins', async () => {
    const [a, b] = await Promise.all([
      ravi.post('/api/owner/shows', body({ dates: [DAY2], startTime: '10:00' })),
      ravi.post('/api/owner/shows', body({ dates: [DAY2], startTime: '11:00' })),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await Show.countDocuments({ startAt: { $gte: istDayToDate(DAY2) } })).toBe(1)
  })
})

describe('PATCH /api/owner/shows/:id (O-05 edit)', () => {
  let id
  beforeEach(async () => {
    id = (await ravi.post('/api/owner/shows', body())).body.items[0].id
  })

  it('new time and date → new label and end; it never clashes with itself', async () => {
    let res = await ravi.patch(`/api/owner/shows/${id}`, { startTime: '14:30' }) // overlaps its old self only
    expect(res.status).toBe(200)
    res = await ravi.patch(`/api/owner/shows/${id}`, { startTime: '20:30', date: DAY2, language: 'English' })
    expect(res.body.show).toMatchObject({ date: DAY2, startTime: '20:30', endTime: '22:45', label: 'second', language: 'English' })
  })

  it('refuses an edit that overlaps another show', async () => {
    await ravi.post('/api/owner/shows', body({ startTime: '18:00' }))
    const res = await ravi.patch(`/api/owner/shows/${id}`, { startTime: '17:00' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SHOW_OVERLAP')
  })

  it('checks the same rules (e.g. parent-and-baby on an "A" movie)', async () => {
    const res = await ravi.patch(`/api/owner/shows/${id}`, { movieId: String(aMovie._id), tags: ['parent_baby'] })
    expect(res.status).toBe(400)
    expect(res.body.error.details.tags).toMatch(/"A"/)
  })

  it('no edit after the start or once it has a booking', async () => {
    await mongoose.connection.db.collection('bookings').insertOne({ showId: new mongoose.Types.ObjectId(id) })
    expect((await ravi.patch(`/api/owner/shows/${id}`, { startTime: '15:00' })).body.error.code).toBe('IN_USE')

    const started = await Show.create({ ...(await Show.findById(id)).toObject(), _id: undefined, startAt: new Date(Date.now() - 60000) })
    const res = await ravi.patch(`/api/owner/shows/${started._id}`, { startTime: '15:00' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('started')
  })

  it("another owner's show → 404", async () => {
    await makeOwner('sita@example.com')
    const sita = as(await login('sita@example.com'))
    expect((await sita.patch(`/api/owner/shows/${id}`, { startTime: '15:00' })).status).toBe(404)
    expect((await sita.get(`/api/owner/shows/${id}`)).status).toBe(404)
  })
})

describe('GET shows and movies (O-05)', () => {
  it('lists my shows of the next 7 days in time order, with filters and pages', async () => {
    const screen2 = await makeScreen(theatre, { name: 'Screen 2' })
    await ravi.post('/api/owner/shows', body({ dates: [DAY2, DAY1], startTime: '18:00' }))
    await ravi.post('/api/owner/shows', body({ dates: [DAY1], startTime: '10:00', screenId: String(screen2._id) }))
    await ravi.post('/api/owner/shows', body({ dates: [istToday(8)] })) // after the 7 days

    // Another owner's show is never listed
    const other = await makeOwner('sita@example.com')
    const otherTheatre = await makeTheatre(other._id)
    const sita = as(await login('sita@example.com'))
    await sita.post('/api/owner/shows', body({ screenId: String((await makeScreen(otherTheatre))._id) }))

    let res = await ravi.get('/api/owner/shows')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ total: 3, from: istToday(), to: istToday(6) })
    expect(res.body.items.map((s) => `${s.date} ${s.startTime} ${s.screen.name}`)).toEqual([`${DAY1} 10:00 Screen 2`, `${DAY1} 18:00 Screen 1`, `${DAY2} 18:00 Screen 1`])

    res = await ravi.get(`/api/owner/shows?screenId=${screen2._id}`)
    expect(res.body.total).toBe(1)
    res = await ravi.get(`/api/owner/shows?from=${istToday(8)}&to=${istToday(8)}`)
    expect(res.body.total).toBe(1)
    res = await ravi.get('/api/owner/shows?limit=2&page=2')
    expect(res.body.items).toHaveLength(1)
    expect((await ravi.get(`/api/owner/shows?from=${DAY2}&to=${DAY1}`)).status).toBe(400)
  })

  it('movie picker: Now showing + Coming soon, not inactive', async () => {
    await makeMovie({ title: 'Old', status: 'inactive' })
    await makeMovie({ title: 'Soon', status: 'coming_soon', releaseDate: istDayToDate(istToday(5)) })
    const res = await ravi.get('/api/owner/movies')
    expect(res.body.items.map((m) => m.title)).toEqual(['Ghost of Gulmohar Lane', 'Sapnon Ka Safar', 'Soon'])
    expect(res.body.items[2]).toMatchObject({ status: 'coming_soon', releaseDate: istToday(5), languages: ['Hindi', 'English'], durationMinutes: 120 })
  })

  it('A-02: a movie with shows cannot be deleted', async () => {
    await ravi.post('/api/owner/shows', body())
    await createUser({ email: 'admin@example.com', role: 'admin' })
    const res = await request(app)
      .delete(`/api/admin/movies/${movie._id}`)
      .set('Authorization', `Bearer ${await login('admin@example.com')}`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('IN_USE')
  })
})
