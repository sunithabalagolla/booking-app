import http from 'node:http'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { io as connect } from 'socket.io-client'
import request from 'supertest'
import app from '../src/app.js'
import { releaseExpiredHolds } from '../src/jobs/releaseExpiredHolds.js'
import { Booking } from '../src/models/Booking.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { attachSockets, closeSockets } from '../src/sockets/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-10 live seat map (api.md Section 12) + JOB-01 (release expired holds, push updates).
// A real HTTP server with Socket.io on a free port; the "browsers" are socket.io-client.

const MIN = 60 * 1000
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('balcony'), S('balcony'), S('balcony')] }, { cells: [S('second'), S('second'), S('second')] }])

let server, url, show, otherShow, meena, ravi
const sockets = []

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})
const holdAs = (api, seatIds, showId = show._id) => api.post('/api/bookings/hold', { showId: String(showId), seatIds })

async function makeShow() {
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
    totalSeats: 6,
  })
}

// A viewer: connects, joins the show room, and records every seats:update
async function viewer(showId) {
  const socket = connect(url, { transports: ['websocket'], forceNew: true })
  sockets.push(socket)
  const updates = []
  socket.on('seats:update', (data) => updates.push(data))
  const joined = await socket.timeout(2000).emitWithAck('show:join', { showId: String(showId) })
  return { socket, updates, joined }
}

// Wait until a viewer has `count` updates (or fail after 2 s)
async function waitFor(v, count = 1) {
  const until = Date.now() + 2000
  while (v.updates.length < count) {
    if (Date.now() > until) throw new Error(`expected ${count} seats:update, got ${v.updates.length}`)
    await new Promise((r) => setTimeout(r, 10))
  }
  return v.updates[count - 1]
}
const settle = () => new Promise((r) => setTimeout(r, 150)) // time for a wrong event to arrive
const sorted = (seats) => [...seats].sort((a, b) => a.seatId.localeCompare(b.seatId))

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init()])
  server = http.createServer(app)
  attachSockets(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
})
beforeEach(async () => {
  await clearTestDB()
  await Settings.create({})
  await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com' })
  await createUser({ email: 'ravi@example.com' })
  show = await makeShow()
  otherShow = await makeShow()
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
})
afterEach(() => {
  for (const s of sockets.splice(0)) s.disconnect()
})
afterAll(async () => {
  await closeSockets()
  await new Promise((resolve) => server.close(resolve))
  await closeTestDB()
})

describe('Socket.io seat rooms (U-10)', () => {
  it('a viewer of the show sees a hold at once; a viewer of another show does not', async () => {
    const watching = await viewer(show._id)
    const elsewhere = await viewer(otherShow._id)
    expect(watching.joined).toEqual({ ok: true })

    expect((await holdAs(meena, ['A1', 'B2'])).status).toBe(201)
    expect(await waitFor(watching)).toEqual({ showId: String(show._id), seats: [{ seatId: 'A1', status: 'held' }, { seatId: 'B2', status: 'held' }] })
    await settle()
    expect(elsewhere.updates).toEqual([])
  })

  it('Give up seats → available; holding again frees the older seats that are not picked again', async () => {
    const watching = await viewer(show._id)
    const first = await holdAs(meena, ['A1', 'A2'])
    await waitFor(watching, 1)

    // Meena changes her pick: A1 stays held, A2 is free, A3 is new
    expect((await holdAs(meena, ['A1', 'A3'])).status).toBe(201)
    expect(sorted((await waitFor(watching, 2)).seats)).toEqual([
      { seatId: 'A1', status: 'held' },
      { seatId: 'A2', status: 'available' },
      { seatId: 'A3', status: 'held' },
    ])

    // The first booking is already released; giving it up again sends nothing new
    expect((await meena.delete(`/api/bookings/${first.body.booking.id}/hold`)).status).toBe(200)
    await settle()
    expect(watching.updates).toHaveLength(2)

    const second = await Booking.findOne({ status: 'pending' })
    expect((await meena.delete(`/api/bookings/${second._id}/hold`)).status).toBe(200)
    expect(sorted((await waitFor(watching, 3)).seats)).toEqual([
      { seatId: 'A1', status: 'available' },
      { seatId: 'A3', status: 'available' },
    ])
  })

  it('a lost race (409 SEAT_TAKEN) sends no update', async () => {
    await holdAs(meena, ['B1'])
    const watching = await viewer(show._id)
    expect((await holdAs(ravi, ['B1', 'B2'])).status).toBe(409)
    await settle()
    expect(watching.updates).toEqual([])
  })

  it('show:leave stops the updates; bad show IDs are refused', async () => {
    const watching = await viewer(show._id)
    expect(await watching.socket.timeout(2000).emitWithAck('show:leave', { showId: String(show._id) })).toEqual({ ok: true })
    await holdAs(meena, ['A1'])
    await settle()
    expect(watching.updates).toEqual([])

    expect(await watching.socket.timeout(2000).emitWithAck('show:join', { showId: 'not-an-id' })).toEqual({ ok: false })
    expect(await watching.socket.timeout(2000).emitWithAck('show:join', {})).toEqual({ ok: false })
  })
})

describe('JOB-01: release expired holds + push seat updates', () => {
  // Fake "now": 11 minutes later (BR-01 is 10), so nothing waits for real time (T-03)
  const later = () => new Date(Date.now() + 11 * MIN)

  it('releases bookings whose time is over and frees their seats for all viewers', async () => {
    const old = await holdAs(meena, ['A1', 'A2'])
    const watching = await viewer(show._id)

    expect(await releaseExpiredHolds(later())).toEqual({ bookings: 1, seats: 0 })
    expect(sorted((await waitFor(watching)).seats)).toEqual([
      { seatId: 'A1', status: 'available' },
      { seatId: 'A2', status: 'available' },
    ])
    const booking = await Booking.findById(old.body.booking.id)
    expect(booking.status).toBe('released')
    expect(booking.holdExpiresAt).toBeUndefined()
    expect(await ShowSeat.countDocuments()).toBe(0)
  })

  it('leaves running holds alone and does nothing the second time', async () => {
    await holdAs(meena, ['A1'])
    const watching = await viewer(show._id)
    expect(await releaseExpiredHolds()).toEqual({ bookings: 0, seats: 0 }) // real now: still running
    expect(await ShowSeat.countDocuments()).toBe(1)

    expect(await releaseExpiredHolds(later())).toEqual({ bookings: 1, seats: 0 })
    expect(await releaseExpiredHolds(later())).toEqual({ bookings: 0, seats: 0 })
    await settle()
    expect(watching.updates).toHaveLength(1)
  })

  it('a seat somebody else holds afresh is not sent as available', async () => {
    // Meena's hold on A1 + A2 ran out; Ravi then took A1 (the expired seat is cleared by his hold)
    const old = await holdAs(meena, ['A1', 'A2'])
    const past = new Date(Date.now() - 1000)
    await Booking.updateOne({ _id: old.body.booking.id }, { holdExpiresAt: past })
    await ShowSeat.updateMany({ bookingId: old.body.booking.id }, { expiresAt: past })
    expect((await holdAs(ravi, ['A1'])).status).toBe(201)

    const watching = await viewer(show._id)
    expect(await releaseExpiredHolds()).toEqual({ bookings: 1, seats: 0 })
    expect((await waitFor(watching)).seats).toEqual([{ seatId: 'A2', status: 'available' }])
    expect(await ShowSeat.findOne({ seatId: 'A1' })).toMatchObject({ status: 'held' })
  })

  it('also clears left-over expired held seats without a pending booking', async () => {
    const owner = await User.findOne({ role: 'owner' })
    await ShowSeat.create({ showId: show._id, seatId: 'B3', status: 'held', userId: owner._id, expiresAt: new Date(Date.now() - 1000) })
    await ShowSeat.create({ showId: show._id, seatId: 'B2', status: 'booked', userId: owner._id }) // booked: never touched
    const watching = await viewer(show._id)

    expect(await releaseExpiredHolds()).toEqual({ bookings: 0, seats: 1 })
    expect(await waitFor(watching)).toEqual({ showId: String(show._id), seats: [{ seatId: 'B3', status: 'available' }] })
    expect(await ShowSeat.countDocuments()).toBe(1)
  })
})
