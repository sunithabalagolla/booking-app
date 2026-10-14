import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { LIMITS, resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
import { Counter } from '../src/models/Counter.js'
import { FoodItem } from '../src/models/FoodItem.js'
import { Invoice } from '../src/models/Invoice.js'
import { Movie } from '../src/models/Movie.js'
import { Payment } from '../src/models/Payment.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { collectFood, lookupFood } from '../src/services/foodPickup.js'
import { qrToken } from '../src/services/qr/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-11 food pickup at the canteen counter (SF-06): scan → order → "Collected" once only.
// Owner (own theatres) or Gate Staff (their theatres). Window = BR-08; gate scan not needed.

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second')] }])
const later = (minutes) => new Date(Date.now() + minutes * MIN)

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

let ownerUser, owner, otherOwner, theatre, otherTheatre, show, staffUser, staff, otherStaff, meena, tea, samosa
const lookup = (body, who = staff) => who.post('/api/food-pickup/lookup', body)
const collect = (body, who = staff) => who.post('/api/food-pickup/collect', body)

async function makeShow(theatreDoc, startMinutes) {
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatreDoc._id, ownerId: theatreDoc.ownerId, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  return Show.create({ movieId: movie._id, theatreId: theatreDoc._id, screenId: screen._id, ownerId: theatreDoc.ownerId, cityCode: 'hyderabad', startAt: later(startMinutes), endAt: later(startMinutes + 150), label: 'matinee', language: 'Tamil', format: '2D', prices: [{ seatClass: 'second', pricePaise: 12000 }], layout: built.layout, totalSeats: 3 })
}

// A confirmed booking through the real flow (hold → food → pay → verify)
async function book(showDoc = show, seatIds = ['A1', 'A2'], items = [{ food: tea, qty: 2 }, { food: samosa, qty: 1 }]) {
  const held = (await meena.post('/api/bookings/hold', { showId: String(showDoc._id), seatIds })).body.booking
  if (items.length) await meena.put(`/api/bookings/${held.id}/food`, { items: items.map((i) => ({ foodItemId: String(i.food._id), qty: i.qty })), pickup: 'interval' })
  const { orderId } = (await meena.post(`/api/bookings/${held.id}/payments`)).body
  const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  await meena.post('/api/payments/verify', { orderId, ...paid })
  return Booking.findById(held.id)
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Payment.init(), Invoice.init(), Counter.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  ownerUser = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'other@example.com', role: 'owner', phone: '9400000002', owner: { businessName: 'C', approvalStatus: 'approved' } })
  theatre = await Theatre.create({ ownerId: ownerUser._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  otherTheatre = await Theatre.create({ ownerId: ownerUser._id, name: 'Sagar Talkies', cityCode: 'hyderabad', address: '3 Lake Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  staffUser = await createUser({ email: 'gate@example.com', role: 'staff', staff: { ownerId: ownerUser._id, theatreIds: [theatre._id] } })
  await createUser({ email: 'gate2@example.com', role: 'staff', staff: { ownerId: ownerUser._id, theatreIds: [otherTheatre._id] } })
  await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  await createUser({ email: 'admin@example.com', role: 'admin' })
  tea = await FoodItem.create({ theatreId: theatre._id, ownerId: ownerUser._id, name: 'Tea', pricePaise: 2000, isVeg: true })
  samosa = await FoodItem.create({ theatreId: theatre._id, ownerId: ownerUser._id, name: 'Chicken Samosa', pricePaise: 4000, isVeg: false })
  show = await makeShow(theatre, 20) // starts in 20 min: the window is open (BR-08: 30 min before)
  owner = as(await login('owner@example.com'))
  otherOwner = as(await login('other@example.com'))
  staff = as(await login('gate@example.com'))
  otherStaff = as(await login('gate2@example.com'))
  meena = as(await login('meena@example.com'))
})
afterAll(closeTestDB)

describe('O-11 food pickup', () => {
  it('lookup shows the order and changes nothing; collect marks it once; second time rejected', async () => {
    const booking = await book()
    const found = await lookup({ qrToken: qrToken(booking) })
    expect(found.status).toBe(200)
    expect(found.body).toMatchObject({
      result: 'found',
      order: {
        bookingNumber: booking.bookingNumber,
        admit: 2,
        movieTitle: 'Kadal Kaatru',
        screenName: 'Screen 1',
        seatsText: 'A1, A2',
        items: [
          { name: 'Tea', isVeg: true, qty: 2 },
          { name: 'Chicken Samosa', isVeg: false, qty: 1 },
        ],
        pickup: 'interval',
        pickupText: 'Interval',
      },
    })
    expect(found.body.order.showText).toMatch(/^Matinee · /)
    expect((await Booking.findById(booking._id)).foodCollectedAt).toBeUndefined()

    const done = await collect({ qrToken: qrToken(booking) })
    expect(done.body).toMatchObject({ result: 'collected', order: { bookingNumber: booking.bookingNumber } })
    const saved = await Booking.findById(booking._id)
    expect(saved.foodCollectedAt.toISOString()).toBe(done.body.collectedAt)
    expect(String(saved.foodCollectedBy)).toBe(String(staffUser._id))
    expect(saved.checkIn?.usedAt).toBeUndefined() // the gate scan is separate and not needed first

    const twice = { result: 'rejected', reason: 'already_collected', bookingNumber: booking.bookingNumber, collectedAt: done.body.collectedAt }
    expect((await collect({ qrToken: qrToken(booking) })).body).toEqual(twice)
    expect((await lookup({ bookingNumber: booking.bookingNumber })).body).toEqual(twice)

    // The gate still lets the ticket in after the food pickup
    expect((await staff.post('/api/staff/checkins', { qrToken: qrToken(booking) })).body.result).toBe('entered')
  })

  it('typed booking number (any case, spaces); the owner can use the counter too', async () => {
    const booking = await book()
    const typed = ` ${booking.bookingNumber.slice(0, 4).toLowerCase()} ${booking.bookingNumber.slice(4)} `
    expect((await lookup({ bookingNumber: typed }, owner)).body.result).toBe('found')
    expect((await collect({ bookingNumber: typed }, owner)).body.result).toBe('collected')
    expect(String((await Booking.findById(booking._id)).foodCollectedBy)).toBe(String(ownerUser._id))
  })

  it('two collects at the same moment: exactly one wins', async () => {
    const booking = await book()
    const results = await Promise.all([collect({ qrToken: qrToken(booking) }), collect({ bookingNumber: booking.bookingNumber }, owner), collect({ qrToken: qrToken(booking) })])
    expect(results.map((r) => r.body.result).sort()).toEqual(['collected', 'rejected', 'rejected'])
    expect(results.filter((r) => r.body.result === 'rejected').every((r) => r.body.reason === 'already_collected')).toBe(true)
  })

  it('bad QR, old QR after a transfer, a seat hold', async () => {
    const booking = await book()
    const token = qrToken(booking)
    expect((await lookup({ qrToken: `${token.slice(0, -2)}xx` })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    expect((await collect({ bookingNumber: 'TK2345ABCD' })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    await Booking.updateOne({ _id: booking._id }, { qrNonce: 'new-nonce', 'transfer.status': 'done' })
    expect((await collect({ qrToken: token })).body).toMatchObject({ result: 'rejected', reason: 'transferred' })

    const held = (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A3'] })).body.booking
    await meena.put(`/api/bookings/${held.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 1 }], pickup: 'before_movie' })
    expect((await collect({ qrToken: qrToken(await Booking.findById(held.id)) })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    expect(await Booking.countDocuments({ foodCollectedAt: { $exists: true } })).toBe(0)
  })

  it('wrong theatre: staff of another theatre, another owner (checked before the time)', async () => {
    const booking = await book()
    expect((await collect({ qrToken: qrToken(booking) }, otherStaff)).body).toMatchObject({ result: 'rejected', reason: 'wrong_theatre' })
    expect((await lookup({ bookingNumber: booking.bookingNumber }, otherOwner)).body).toMatchObject({ result: 'rejected', reason: 'wrong_theatre' })
    await Booking.updateOne({ _id: booking._id }, { 'show.startAt': later(600), 'show.endAt': later(750) })
    expect((await collect({ qrToken: qrToken(booking) }, otherStaff)).body.reason).toBe('wrong_theatre')
    expect((await Booking.findById(booking._id)).foodCollectedAt).toBeUndefined()
  })

  it('BR-08 window: too early 1 ms before, open exactly then, too late at the end', async () => {
    const booking = await book()
    const staffDoc = await User.findById(staffUser._id)
    const opensAt = new Date(booking.show.startAt.getTime() - 30 * MIN)
    const input = { bookingNumber: booking.bookingNumber }
    expect(await lookupFood(input, staffDoc, new Date(opensAt.getTime() - 1))).toEqual({ result: 'rejected', reason: 'too_early', bookingNumber: booking.bookingNumber, opensAt })
    expect(await collectFood(input, staffDoc, booking.show.endAt)).toMatchObject({ result: 'rejected', reason: 'too_late' })
    expect((await collectFood(input, staffDoc, opensAt)).result).toBe('collected')
  })

  it('cancelled booking; booking without food', async () => {
    const plain = await book(show, ['A3'], [])
    expect((await lookup({ qrToken: qrToken(plain) })).body).toEqual({ result: 'rejected', reason: 'no_food', bookingNumber: plain.bookingNumber })

    const booking = await book()
    await Booking.updateOne({ _id: booking._id }, { status: 'cancelled' })
    expect((await collect({ qrToken: qrToken(booking) })).body).toMatchObject({ result: 'rejected', reason: 'cancelled' })
    await Booking.updateOne({ _id: booking._id }, { status: 'cancelled_by_theatre' })
    expect((await lookup({ bookingNumber: booking.bookingNumber }, owner)).body).toMatchObject({ result: 'rejected', reason: 'cancelled' })
  })

  it('who: 401, 403 for a user / admin / pending owner, blocked staff; body; rate limit per person', async () => {
    expect((await request(app).post('/api/food-pickup/lookup').send({ bookingNumber: 'TK2345ABCD' })).status).toBe(401)
    expect((await lookup({ bookingNumber: 'TK2345ABCD' }, meena)).status).toBe(403)
    expect((await collect({ bookingNumber: 'TK2345ABCD' }, as(await login('admin@example.com')))).status).toBe(403)
    await createUser({ email: 'pending@example.com', role: 'owner', phone: '9400000003', owner: { businessName: 'P', approvalStatus: 'pending' } })
    expect((await lookup({ bookingNumber: 'TK2345ABCD' }, as(await login('pending@example.com')))).status).toBe(403)

    expect((await lookup({})).status).toBe(400)
    expect((await collect({ qrToken: 'a', bookingNumber: 'TK2345ABCD' })).status).toBe(400)

    for (let i = 0; i < LIMITS.scan.limit - 2; i++) await lookup({ bookingNumber: 'TK2345ABCD' })
    expect((await collect({ bookingNumber: 'TK2345ABCD' })).status).toBe(429) // lookup + collect share the count
    expect((await lookup({ bookingNumber: 'TK2345ABCD' }, otherStaff)).status).toBe(200) // per person

    await User.updateOne({ _id: staffUser._id }, { status: 'blocked' })
    resetRateLimits()
    expect((await lookup({ bookingNumber: 'TK2345ABCD' })).status).toBe(403)
  })
})
