import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istParts } from '../src/utils/showTime.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-10 / UI-20 seat page data: GET /api/shows/:id (guests) + GET /api/shows/:id/seats (users)

const HOUR = 60 * 60 * 1000
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const getAs = (token, path) => request(app).get(path).set('Authorization', `Bearer ${token}`)

const S = (seatClass, wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })
// Back row: 2 balcony + aisle + blocked; front row: 2 second class (one wheelchair)
const built = buildLayout([{ cells: [S('balcony'), S('balcony'), { type: 'aisle' }, { type: 'blocked' }] }, { cells: [S('second'), S('second', true), { type: 'aisle' }, S('second')] }])

let movie, theatre, screen, userToken, ownerToken
const makeShow = (extra = {}) =>
  Show.create({
    movieId: movie._id,
    theatreId: theatre._id,
    screenId: screen._id,
    ownerId: theatre.ownerId,
    cityCode: 'hyderabad',
    startAt: new Date(Date.now() + 3 * HOUR),
    endAt: new Date(Date.now() + 6 * HOUR),
    label: 'matinee',
    language: 'Tamil',
    format: '2D',
    prices: [
      { seatClass: 'balcony', pricePaise: 25000 },
      { seatClass: 'second', pricePaise: 12000 },
    ],
    layout: built.layout,
    totalSeats: 5,
    ...extra,
  })

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init()])
})
beforeEach(async () => {
  await clearTestDB()
  const owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com' })
  movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  screen = await Screen.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: true })
  userToken = await login('meena@example.com')
  ownerToken = await login('owner@example.com')
})
afterAll(closeTestDB)

describe('GET /api/shows/:id (UI-20)', () => {
  it('guests get the show, movie, theatre, screen, layout and prices with class names', async () => {
    const show = await makeShow({ deal: { enabled: true, active: true, percent: 20 } })
    const res = await request(app).get(`/api/shows/${show._id}`)
    expect(res.status).toBe(200)
    const { date, time } = istParts(show.startAt)
    expect(res.body.show).toMatchObject({
      id: String(show._id),
      date,
      startTime: time,
      label: 'matinee',
      language: 'Tamil',
      housefull: false,
      deal: { active: true, percent: 20 },
      movie: { id: String(movie._id), title: 'Kadal Kaatru', certificate: 'U' },
      theatre: { name: 'Chandni Talkies', address: '12 Station Road' },
      screen: { name: 'Screen 1' },
      prices: [
        { seatClass: 'balcony', className: 'Balcony', pricePaise: 25000 },
        { seatClass: 'second', className: 'Second class', pricePaise: 12000 },
      ],
    })
    const { grid } = res.body.show.layout
    expect(grid.map((r) => r.label)).toEqual(['B', 'A']) // A = nearest the screen
    expect(grid[0].cells).toEqual([
      { type: 'seat', seatId: 'B1', seatClass: 'balcony', wheelchair: false },
      { type: 'seat', seatId: 'B2', seatClass: 'balcony', wheelchair: false },
      { type: 'aisle' },
      { type: 'blocked' },
    ])
    expect(grid[1].cells[1]).toEqual({ type: 'seat', seatId: 'A2', seatClass: 'second', wheelchair: true })
  })

  it('started, cancelled, unknown show, inactive movie or unapproved theatre → 404; bad ID → 400', async () => {
    const started = await makeShow({ startAt: new Date(Date.now() - 60 * 1000) })
    const cancelled = await makeShow({ status: 'cancelled', startAt: new Date(Date.now() + 9 * HOUR), endAt: new Date(Date.now() + 12 * HOUR) })
    for (const id of [started._id, cancelled._id, new mongoose.Types.ObjectId()]) {
      expect((await request(app).get(`/api/shows/${id}`)).status).toBe(404)
    }
    const show = await makeShow({ startAt: new Date(Date.now() + 20 * HOUR), endAt: new Date(Date.now() + 23 * HOUR) })
    await Movie.updateOne({ _id: movie._id }, { status: 'inactive' })
    expect((await request(app).get(`/api/shows/${show._id}`)).status).toBe(404)
    await Movie.updateOne({ _id: movie._id }, { status: 'now_showing' })
    await Theatre.updateOne({ _id: theatre._id }, { status: 'pending' })
    expect((await request(app).get(`/api/shows/${show._id}`)).status).toBe(404)
    expect((await request(app).get('/api/shows/not-an-id')).status).toBe(400)
  })
})

describe('GET /api/shows/:id/seats (U-10)', () => {
  it('login needed, users only', async () => {
    const show = await makeShow()
    expect((await request(app).get(`/api/shows/${show._id}/seats`)).status).toBe(401)
    expect((await getAs(ownerToken, `/api/shows/${show._id}/seats`)).status).toBe(403)
    expect((await getAs(userToken, `/api/shows/${show._id}/seats`)).body).toEqual({ taken: [], myHold: null })
  })

  it('booked + held seats; an expired hold counts as free (no waiting for the TTL monitor)', async () => {
    const show = await makeShow()
    const userId = new mongoose.Types.ObjectId()
    await ShowSeat.insertMany([
      { showId: show._id, seatId: 'B1', status: 'booked', userId },
      { showId: show._id, seatId: 'A1', status: 'held', userId, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { showId: show._id, seatId: 'A2', status: 'held', userId, expiresAt: new Date(Date.now() - 1000) }, // expired
    ])
    const res = await getAs(userToken, `/api/shows/${show._id}/seats`)
    expect(res.body.taken).toEqual([
      { seatId: 'A1', status: 'held' },
      { seatId: 'B1', status: 'booked' },
    ])
  })

  it('the same seat cannot be taken twice in one show (unique lock)', async () => {
    const show = await makeShow()
    const userId = new mongoose.Types.ObjectId()
    await ShowSeat.create({ showId: show._id, seatId: 'A1', status: 'booked', userId })
    await expect(ShowSeat.create({ showId: show._id, seatId: 'A1', status: 'held', userId, expiresAt: new Date(Date.now() + 60000) })).rejects.toThrow(/duplicate key/)
  })
})
