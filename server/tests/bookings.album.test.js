import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
import { User } from '../src/models/User.js'
import { newBookingNumber, newQrNonce } from '../src/utils/bookingNumber.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-18 ticket album: GET /api/bookings?tab=upcoming|past (UI-28)

const MIN = 60 * 1000
const HOUR = 60 * MIN
const id = () => new mongoose.Types.ObjectId()
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({ get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`) })

let meena, ravi, api
// A booking straight in the database. `startsIn` in hours from now; shows last 3 hours.
function makeBooking({ user = meena, status = 'confirmed', startsIn = 24, title = 'Kadal Kaatru', transfer } = {}) {
  const startAt = new Date(Date.now() + startsIn * HOUR)
  return Booking.create({
    bookingNumber: newBookingNumber(),
    userId: user._id,
    showId: id(),
    movieId: id(),
    theatreId: id(),
    screenId: id(),
    ownerId: id(),
    cityCode: 'hyderabad',
    status,
    confirmedAt: status === 'pending' ? undefined : new Date(),
    holdExpiresAt: status === 'pending' ? new Date(Date.now() + 10 * MIN) : undefined,
    show: { movieTitle: title, certificate: 'U', theatreName: 'Chandni Talkies', theatreAddress: '12 Station Road', screenName: 'Screen 1', startAt, endAt: new Date(startAt.getTime() + 3 * HOUR), label: 'first', language: 'Tamil', format: '2D' },
    seats: [{ seatId: 'A1', seatClass: 'second', className: 'Second class', pricePaise: 12000 }],
    food: [{ foodItemId: id(), name: 'Tea', isVeg: true, unitPricePaise: 2000, qty: 1 }],
    foodPickup: 'interval',
    pricing: { ticketsPaise: 12000, foodPaise: 2000, totalPaise: 17000 },
    qrNonce: newQrNonce(),
    invoiceId: status === 'pending' ? undefined : id(),
    transfer,
  })
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Booking.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  meena = await createUser({ email: 'meena@example.com' })
  ravi = await createUser({ email: 'ravi@example.com' })
  api = as(await login('meena@example.com'))
})
afterAll(closeTestDB)

const titles = (res) => res.body.items.map((i) => i.show.movieTitle)

describe('GET /api/bookings (U-18 ticket album)', () => {
  it('upcoming: my confirmed bookings whose show has not ended, soonest first, with QR', async () => {
    await makeBooking({ title: 'Later', startsIn: 48 })
    await makeBooking({ title: 'Running now', startsIn: -1 }) // started 1 h ago, ends in 2 h (BR-08)
    await makeBooking({ title: 'Tomorrow', startsIn: 24 })
    await makeBooking({ title: 'Ended', startsIn: -5 })
    await makeBooking({ title: 'A hold', status: 'pending' })
    await makeBooking({ title: 'Released', status: 'released' })
    await makeBooking({ title: 'Cancelled', status: 'cancelled' })
    await makeBooking({ title: 'Ravi’s', user: ravi })

    const res = await api.get('/api/bookings?tab=upcoming')
    expect(res.status).toBe(200)
    expect(titles(res)).toEqual(['Running now', 'Tomorrow', 'Later'])
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 3 })
    const item = res.body.items[0]
    expect(item).toMatchObject({ status: 'confirmed', stamp: null, canOpen: true, totalPaise: 17000, foodPickup: 'interval', food: [{ name: 'Tea', qty: 1 }], seats: [{ seatId: 'A1', seatClass: 'second', className: 'Second class' }] })
    expect(item.qrDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(item.invoiceId).toMatch(/^[0-9a-f]{24}$/)
    expect(item).not.toHaveProperty('qrNonce')
    expect((await api.get('/api/bookings')).body.total).toBe(3) // upcoming is the default
  })

  it('past: ended, cancelled (by me or the theatre) and transferred away, newest first, stamps, no QR', async () => {
    await makeBooking({ title: 'Ended last week', startsIn: -24 * 7 })
    await makeBooking({ title: 'Ended today', startsIn: -5 })
    await makeBooking({ title: 'I cancelled', status: 'cancelled', startsIn: 24 })
    await makeBooking({ title: 'Theatre cancelled', status: 'cancelled_by_theatre', startsIn: -48 })
    await makeBooking({ title: 'Given to Ravi', user: ravi, startsIn: 72, transfer: { status: 'done', fromUserId: meena._id, toUserId: ravi._id, toEmail: 'ravi@example.com' } })
    await makeBooking({ title: 'Transfer waiting', startsIn: 96, transfer: { status: 'pending_claim', fromUserId: meena._id, toEmail: 'friend@example.com' } }) // still mine: upcoming
    await makeBooking({ title: 'Upcoming', startsIn: 2 })
    await makeBooking({ title: 'Released', status: 'released', startsIn: -5 })

    const res = await api.get('/api/bookings?tab=past')
    expect(titles(res)).toEqual(['Given to Ravi', 'I cancelled', 'Ended today', 'Theatre cancelled', 'Ended last week'])
    expect(res.body.items.map((i) => [i.show.movieTitle, i.stamp, i.canOpen])).toEqual([
      ['Given to Ravi', 'transferred', false],
      ['I cancelled', 'cancelled', true],
      ['Ended today', null, true], // "Watched" comes with gate check-in (Phase 7)
      ['Theatre cancelled', 'cancelled', true],
      ['Ended last week', null, true],
    ])
    expect(res.body.items.every((i) => i.qrDataUrl === null)).toBe(true)
    expect(res.body.items[0].invoiceId).toBeNull() // the transferred ticket is Ravi's now
    expect(titles(await api.get('/api/bookings?tab=upcoming'))).toEqual(['Upcoming', 'Transfer waiting'])

    // Ravi sees the ticket he got as his own upcoming ticket
    expect(titles(await as(await login('ravi@example.com')).get('/api/bookings'))).toEqual(['Given to Ravi'])
  })

  it('pages of 10; bad query → 400; guests 401; owners 403', async () => {
    for (let i = 1; i <= 12; i++) await makeBooking({ title: `Show ${String(i).padStart(2, '0')}`, startsIn: i })
    const first = await api.get('/api/bookings?tab=upcoming')
    expect(first.body.items).toHaveLength(10)
    expect(first.body.total).toBe(12)
    const second = await api.get('/api/bookings?tab=upcoming&page=2')
    expect(titles(second)).toEqual(['Show 11', 'Show 12'])
    expect((await api.get('/api/bookings?tab=old')).status).toBe(400)
    expect((await api.get('/api/bookings?limit=500')).status).toBe(400)
    expect((await request(app).get('/api/bookings')).status).toBe(401)
    await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
    expect((await as(await login('owner@example.com')).get('/api/bookings')).status).toBe(403)
  })

  it('an empty album', async () => {
    expect((await api.get('/api/bookings?tab=past')).body).toEqual({ items: [], page: 1, limit: 10, total: 0 })
  })
})
