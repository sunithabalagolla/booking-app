import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Booking } from '../src/models/Booking.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat, takenNow } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { currentHold, releaseIfExpired } from '../src/services/seatHold.js'
import { BOOKING_NUMBER_CHARS } from '../src/utils/bookingNumber.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-12 seat hold (9.2, 9.3) + T-02 (two users, same seat, same moment: exactly one wins)
// + T-03 (a hold ends after BR-01 and the seats are free again; no waiting for the TTL)

const MIN = 60 * 1000
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

const S = (seatClass) => ({ type: 'seat', seatClass })
// Back row: 3 balcony + blocked; front row: 4 second class
const built = buildLayout([{ cells: [S('balcony'), S('balcony'), S('balcony'), { type: 'blocked' }] }, { cells: [S('second'), S('second'), S('second'), S('second')] }])

let show, meena, ravi, ownerApi
const makeShow = async (extra = {}) => {
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const owner = await User.findOne({ role: 'owner' })
  const theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  return Show.create({
    movieId: movie._id,
    theatreId: theatre._id,
    screenId: screen._id,
    ownerId: owner._id,
    cityCode: 'hyderabad',
    startAt: new Date(Date.now() + 180 * MIN),
    endAt: new Date(Date.now() + 360 * MIN),
    label: 'matinee',
    language: 'Tamil',
    format: '2D',
    prices: [
      { seatClass: 'balcony', pricePaise: 25000 },
      { seatClass: 'second', pricePaise: 12000 },
    ],
    layout: built.layout,
    totalSeats: 7,
    ...extra,
  })
}
const holdAs = (api, seatIds, showId = show._id) => api.post('/api/bookings/hold', { showId: String(showId), seatIds })
// T-03 without waiting: move a hold's end time into the past, like 10 minutes went by
const timePasses = (bookingId) =>
  Promise.all([Booking.updateOne({ _id: bookingId }, { holdExpiresAt: new Date(Date.now() - 1000) }), ShowSeat.updateMany({ bookingId }, { expiresAt: new Date(Date.now() - 1000) })])

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init()])
})
beforeEach(async () => {
  await clearTestDB()
  await createTestSettings() // defaults: holdMinutes 10 (BR-01), maxSeatsPerBooking 10 (BR-02)
  await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com' })
  await createUser({ email: 'ravi@example.com' })
  show = await makeShow()
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
  ownerApi = as(await login('owner@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/bookings/hold (U-12)', () => {
  it('holds the seats for 10 minutes: a pending booking with prices from the server', async () => {
    const before = Date.now()
    const res = await holdAs(meena, ['A2', 'B1'])
    expect(res.status).toBe(201)
    const { booking } = res.body
    expect(booking).toMatchObject({
      status: 'pending',
      showId: String(show._id),
      seats: [
        { seatId: 'A2', seatClass: 'second', className: 'Second class', pricePaise: 12000 },
        { seatId: 'B1', seatClass: 'balcony', className: 'Balcony', pricePaise: 25000 },
      ],
      pricing: { ticketsPaise: 37000 },
      show: { movieTitle: 'Kadal Kaatru', theatreName: 'Chandni Talkies', screenName: 'Screen 1', label: 'matinee' },
    })
    expect(booking.bookingNumber).toMatch(new RegExp(`^TK[${BOOKING_NUMBER_CHARS}]{8}$`))
    const expires = new Date(booking.holdExpiresAt).getTime()
    expect(expires - before).toBeGreaterThanOrEqual(10 * MIN - 1000)
    expect(expires - Date.now()).toBeLessThanOrEqual(10 * MIN)
    expect(booking.remainingSeconds).toBeGreaterThan(590)

    // Other users see them as held; the holder gets myHold (timer after a refresh)
    const seen = await ravi.get(`/api/shows/${show._id}/seats`)
    expect(seen.body).toEqual({ taken: [{ seatId: 'A2', status: 'held' }, { seatId: 'B1', status: 'held' }], myHold: null })
    const mine = await meena.get(`/api/shows/${show._id}/seats`)
    expect(mine.body.myHold).toMatchObject({ bookingId: booking.id, seatIds: ['A2', 'B1'] })
    expect(mine.body.myHold.remainingSeconds).toBeGreaterThan(590)
  })

  it('a seat that is taken → 409 SEAT_TAKEN, and none of the other seats are held', async () => {
    await holdAs(meena, ['A1'])
    const res = await holdAs(ravi, ['A2', 'A1', 'A3'])
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'SEAT_TAKEN', message: 'Seat A1 was just taken. Please pick another seat.', details: { seatIds: ['A1'] } })
    expect(await ShowSeat.countDocuments({ showId: show._id })).toBe(1) // all or none
    expect(await Booking.countDocuments({ userId: (await User.findOne({ email: 'ravi@example.com' }))._id })).toBe(0)
  })

  it('holding again on the same show gives back the older hold first', async () => {
    const first = (await holdAs(meena, ['A1', 'A2'])).body.booking
    const second = await holdAs(meena, ['A2', 'A3'])
    expect(second.status).toBe(201)
    expect((await Booking.findById(first.id)).status).toBe('released')
    const held = await ShowSeat.find({ showId: show._id }).sort({ seatId: 1 })
    expect(held.map((s) => s.seatId)).toEqual(['A2', 'A3'])
  })

  it('refuses: more than maxSeatsPerBooking (BR-02), blocked / unknown seats, bad input, started or cancelled show', async () => {
    await Settings.updateOne({}, { maxSeatsPerBooking: 2 })
    expect((await holdAs(meena, ['A1', 'A2', 'A3'])).body.error).toMatchObject({ code: 'RULE_BROKEN', details: { rule: 'BR-02' } })
    expect((await holdAs(meena, ['B4'])).body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: { seatIds: ['B4'] } }) // blocked place
    expect((await holdAs(meena, ['C1'])).status).toBe(400) // no row C
    expect((await holdAs(meena, [])).status).toBe(400)
    expect((await holdAs(meena, ['A1', 'A1'])).status).toBe(400)
    expect((await holdAs(meena, ['a1'])).status).toBe(400)

    const started = await makeShow({ startAt: new Date(Date.now() - MIN) })
    expect((await holdAs(meena, ['A1'], started._id)).body.error).toMatchObject({ code: 'RULE_BROKEN', details: { rule: 'U-12' } })
    await Show.updateOne({ _id: show._id }, { status: 'cancelled' })
    expect((await holdAs(meena, ['A1'])).status).toBe(400)
    expect((await holdAs(meena, ['A1'], new mongoose.Types.ObjectId())).status).toBe(404)
    expect(await ShowSeat.countDocuments()).toBe(0)
  })

  it('login needed, users only', async () => {
    expect((await request(app).post('/api/bookings/hold').send({ showId: String(show._id), seatIds: ['A1'] })).status).toBe(401)
    expect((await holdAs(ownerApi, ['A1'])).status).toBe(403)
  })
})

describe('T-02: two users hold the same seat at the same moment', () => {
  it('exactly one wins, every time (10 rounds)', async () => {
    for (let round = 0; round < 10; round++) {
      await ShowSeat.deleteMany({})
      await Booking.deleteMany({})
      const results = await Promise.all([holdAs(meena, ['A1', 'A2']), holdAs(ravi, ['A2', 'A3'])])
      const statuses = results.map((r) => r.status).sort()
      expect(statuses, `round ${round}`).toEqual([201, 409])
      // The seats in the database belong to the winner only (all or none for the loser)
      const winner = results.find((r) => r.status === 201).body.booking
      const seats = await ShowSeat.find({ showId: show._id })
      expect(seats.every((s) => String(s.bookingId) === winner.id)).toBe(true)
      expect(seats.map((s) => s.seatId).sort()).toEqual(winner.seats.map((s) => s.seatId).sort())
      expect(await Booking.countDocuments({ status: 'pending' })).toBe(1)
    }
  })
})

describe('T-03: a hold ends after BR-01 and the seats become available', () => {
  it('fake "now" 10 minutes later: seats free, no running hold, booking released', async () => {
    const { booking } = (await holdAs(meena, ['A1', 'A2'])).body
    const later = new Date(new Date(booking.holdExpiresAt).getTime() + 1000)
    // The TTL monitor has not run: the documents are still there, but they do not count
    expect(await ShowSeat.countDocuments({ showId: show._id })).toBe(2)
    expect(await ShowSeat.countDocuments({ showId: show._id, ...takenNow(later) })).toBe(0)
    expect(await currentHold(show._id, (await User.findOne({ email: 'meena@example.com' }))._id, later)).toBeNull()
    const released = await releaseIfExpired(await Booking.findById(booking.id), later)
    expect(released.status).toBe('released')
    expect(await ShowSeat.countDocuments({ showId: show._id })).toBe(0)
  })

  it('after the time is over another user can hold the same seats, and the API shows the old hold as released', async () => {
    const { booking } = (await holdAs(meena, ['A1', 'A2'])).body
    await timePasses(booking.id)
    expect((await ravi.get(`/api/shows/${show._id}/seats`)).body.taken).toEqual([]) // expired = free
    expect((await meena.get(`/api/shows/${show._id}/seats`)).body.myHold).toBeNull()
    expect((await holdAs(ravi, ['A2'])).status).toBe(201) // the old held seat is cleared in the same transaction
    const old = await meena.get(`/api/bookings/${booking.id}`)
    expect(old.body.booking).toMatchObject({ status: 'released', holdExpiresAt: null, remainingSeconds: null })
    expect((await ShowSeat.find({ showId: show._id })).map((s) => s.seatId)).toEqual(['A2'])
  })
})

describe('GET /api/bookings/:id + DELETE /api/bookings/:id/hold ("Give up seats")', () => {
  it('own booking only; others get 404', async () => {
    const { booking } = (await holdAs(meena, ['A1'])).body
    expect((await meena.get(`/api/bookings/${booking.id}`)).body.booking).toMatchObject({ id: booking.id, status: 'pending' })
    expect((await ravi.get(`/api/bookings/${booking.id}`)).status).toBe(404)
    expect((await ravi.delete(`/api/bookings/${booking.id}/hold`)).status).toBe(404)
    expect((await meena.get(`/api/bookings/${new mongoose.Types.ObjectId()}`)).status).toBe(404)
  })

  it('give up: released, seats free at once; calling it again is fine', async () => {
    const { booking } = (await holdAs(meena, ['A1', 'A2'])).body
    const res = await meena.delete(`/api/bookings/${booking.id}/hold`)
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({ status: 'released', holdExpiresAt: null })
    expect(await ShowSeat.countDocuments()).toBe(0)
    expect((await meena.delete(`/api/bookings/${booking.id}/hold`)).status).toBe(200)
    expect((await holdAs(ravi, ['A1', 'A2'])).status).toBe(201)
  })
})
