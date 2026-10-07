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
import { checkIn } from '../src/services/checkIn.js'
import { qrToken } from '../src/services/qr/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// T-07 QR check-in (S-02 … S-05, flow 9.7): valid, wrong theatre, too early, cancelled,
// used twice (+ too late, bad / old QR, typed number, two scans at once)

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second')] }])
const later = (minutes) => new Date(Date.now() + minutes * MIN)

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

let owner, theatre, otherTheatre, show, staffUser, staff, otherStaff, meena, meenaUser
const scan = (body, who = staff) => who.post('/api/staff/checkins', body)

async function makeShow(theatreDoc, startMinutes) {
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatreDoc._id, ownerId: owner._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  return Show.create({
    movieId: movie._id,
    theatreId: theatreDoc._id,
    screenId: screen._id,
    ownerId: owner._id,
    cityCode: 'hyderabad',
    startAt: later(startMinutes),
    endAt: later(startMinutes + 150),
    label: 'matinee',
    language: 'Tamil',
    format: '2D',
    prices: [{ seatClass: 'second', pricePaise: 12000 }],
    layout: built.layout,
    totalSeats: 3,
  })
}

// A confirmed booking through the real flow (hold → pay → verify), optionally with food
async function book(showDoc = show, seatIds = ['A1', 'A2'], { food } = {}) {
  const held = (await meena.post('/api/bookings/hold', { showId: String(showDoc._id), seatIds })).body.booking
  if (food) await meena.put(`/api/bookings/${held.id}/food`, { items: [{ foodItemId: String(food._id), qty: 2 }], pickup: 'interval' })
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
  owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  otherTheatre = await Theatre.create({ ownerId: owner._id, name: 'Sagar Talkies', cityCode: 'hyderabad', address: '3 Lake Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  staffUser = await createUser({ email: 'gate@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [theatre._id] } })
  await createUser({ email: 'gate2@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [otherTheatre._id] } })
  meenaUser = await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  show = await makeShow(theatre, 20) // starts in 20 min: check-in is open (BR-08: 30 min before)
  staff = as(await login('gate@example.com'))
  otherStaff = as(await login('gate2@example.com'))
  meena = as(await login('meena@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/staff/checkins (T-07)', () => {
  it('valid QR → ENTERED with movie, screen, seats, food; marked used once; enteredCount +1', async () => {
    const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
    const booking = await book(show, ['A2', 'A1'], { food: tea })
    const res = await scan({ qrToken: qrToken(booking) })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      result: 'entered',
      booking: { bookingNumber: booking.bookingNumber, admit: 2, movieTitle: 'Kadal Kaatru', theatreName: 'Chandni Talkies', screenName: 'Screen 1', classText: 'Second class', seatsText: 'A1, A2', foodText: '2 × Tea', pickupText: 'Interval' },
    })
    expect(res.body.booking.showText).toMatch(/^Matinee · /)
    const saved = await Booking.findById(booking._id)
    expect(String(saved.checkIn.staffId)).toBe(String(staffUser._id))
    expect(saved.checkIn.usedAt.toISOString()).toBe(res.body.usedAt)
    expect((await User.findById(meenaUser._id)).enteredCount).toBe(1)

    // Used twice → rejected with the time of the first scan; count stays 1
    const again = await scan({ qrToken: qrToken(booking) })
    expect(again.body).toEqual({ result: 'rejected', reason: 'already_used', bookingNumber: booking.bookingNumber, usedAt: res.body.usedAt })
    expect((await User.findById(meenaUser._id)).enteredCount).toBe(1)
  })

  it('typed booking number (any case, spaces) works like the QR', async () => {
    const booking = await book()
    const typed = ` ${booking.bookingNumber.slice(0, 5).toLowerCase()} ${booking.bookingNumber.slice(5)} `
    expect((await scan({ bookingNumber: typed })).body).toMatchObject({ result: 'entered', booking: { bookingNumber: booking.bookingNumber } })
    expect((await scan({ bookingNumber: 'TK2345ABCD' })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
  })

  it('bad QR: wrong signature, rubbish, an old QR (new nonce), a seat hold', async () => {
    const booking = await book()
    const token = qrToken(booking)
    expect((await scan({ qrToken: `${token.slice(0, -2)}xx` })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    expect((await scan({ qrToken: 'hello' })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })

    await Booking.updateOne({ _id: booking._id }, { qrNonce: 'new-nonce' })
    expect((await scan({ qrToken: token })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    await Booking.updateOne({ _id: booking._id }, { 'transfer.status': 'done' }) // SF-02 later: old QR after a transfer
    expect((await scan({ qrToken: token })).body).toMatchObject({ result: 'rejected', reason: 'transferred' })

    const held = (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A3'] })).body.booking
    expect((await scan({ qrToken: qrToken(await Booking.findById(held.id)) })).body).toEqual({ result: 'rejected', reason: 'bad_qr' })
    expect((await Booking.findById(booking._id)).checkIn?.usedAt).toBeUndefined()
  })

  it('wrong theatre → rejected (checked before the time)', async () => {
    const booking = await book()
    expect((await scan({ qrToken: qrToken(booking) }, otherStaff)).body).toMatchObject({ result: 'rejected', reason: 'wrong_theatre' })
    await Booking.updateOne({ _id: booking._id }, { 'show.startAt': later(600), 'show.endAt': later(750) })
    expect((await scan({ qrToken: qrToken(booking) }, otherStaff)).body.reason).toBe('wrong_theatre')
  })

  it('BR-08 window: too early 1 ms before 30 min, open exactly then, too late at the end', async () => {
    const booking = await book()
    const start = booking.show.startAt.getTime()
    const opensAt = new Date(start - 30 * MIN)
    const staffDoc = await User.findById(staffUser._id)
    expect(await checkIn({ bookingNumber: booking.bookingNumber }, staffDoc, new Date(opensAt.getTime() - 1))).toEqual({
      result: 'rejected',
      reason: 'too_early',
      bookingNumber: booking.bookingNumber,
      opensAt,
    })
    expect(await checkIn({ bookingNumber: booking.bookingNumber }, staffDoc, booking.show.endAt)).toMatchObject({ result: 'rejected', reason: 'too_late' })
    expect((await checkIn({ bookingNumber: booking.bookingNumber }, staffDoc, opensAt)).result).toBe('entered')

    // The setting decides (A-05)
    const second = await book(show, ['A3'])
    await Settings.updateOne({ _id: 'platform' }, { checkinBeforeMinutes: 10 })
    expect((await checkIn({ bookingNumber: second.bookingNumber }, staffDoc, new Date(start - 11 * MIN))).reason).toBe('too_early')
  })

  it('cancelled by the user or the theatre → rejected', async () => {
    const booking = await book()
    await Booking.updateOne({ _id: booking._id }, { status: 'cancelled' })
    expect((await scan({ qrToken: qrToken(booking) })).body).toMatchObject({ result: 'rejected', reason: 'cancelled' })
    await Booking.updateOne({ _id: booking._id }, { status: 'cancelled_by_theatre' })
    expect((await scan({ bookingNumber: booking.bookingNumber })).body).toMatchObject({ result: 'rejected', reason: 'cancelled' })
  })

  it('two scans at the same moment: exactly one ENTERED (S-04)', async () => {
    const booking = await book()
    const results = await Promise.all([scan({ qrToken: qrToken(booking) }), scan({ bookingNumber: booking.bookingNumber }), scan({ qrToken: qrToken(booking) })])
    expect(results.map((r) => r.body.result).sort()).toEqual(['entered', 'rejected', 'rejected'])
    expect(results.filter((r) => r.body.result === 'rejected').every((r) => r.body.reason === 'already_used')).toBe(true)
    expect((await User.findById(meenaUser._id)).enteredCount).toBe(1)
  })

  it('body: exactly one of qrToken / bookingNumber; only staff (403); rate limit', async () => {
    expect((await scan({})).status).toBe(400)
    expect((await scan({ qrToken: 'a', bookingNumber: 'TK2345ABCD' })).status).toBe(400)
    expect((await scan({ bookingNumber: '   ' })).status).toBe(400)
    expect((await meena.post('/api/staff/checkins', { bookingNumber: 'TK2345ABCD' })).status).toBe(403)
    expect((await as(await login('owner@example.com')).post('/api/staff/checkins', { bookingNumber: 'TK2345ABCD' })).status).toBe(403)

    for (let i = 0; i < LIMITS.scan.limit - 3; i++) await scan({ bookingNumber: 'TK2345ABCD' })
    expect((await scan({ bookingNumber: 'TK2345ABCD' })).status).toBe(429)
    expect((await scan({ bookingNumber: 'TK2345ABCD' }, otherStaff)).status).toBe(200) // per staff
  })
})

describe('after the gate', () => {
  it('GET /api/staff/theatres: my theatres only', async () => {
    const res = await staff.get('/api/staff/theatres')
    expect(res.body).toEqual({ items: [{ id: String(theatre._id), name: 'Chandni Talkies', cityCode: 'hyderabad' }] })
  })

  it('album: a scanned past ticket says Watched, a never-scanned one has no stamp; a used ticket cannot be cancelled', async () => {
    const scanned = await book(show, ['A1'])
    const skipped = await book(show, ['A2'])
    await scan({ qrToken: qrToken(scanned) })

    const preview = await meena.get(`/api/bookings/${scanned._id}/cancel-preview`)
    expect(preview.body).toMatchObject({ allowed: false, reason: 'used' })

    await Booking.updateMany({}, { 'show.endAt': later(-1) })
    const album = await meena.get('/api/bookings?tab=past')
    const stamps = Object.fromEntries(album.body.items.map((i) => [i.bookingNumber, i.stamp]))
    expect(stamps).toEqual({ [scanned.bookingNumber]: 'watched', [skipped.bookingNumber]: null })
  })
})
