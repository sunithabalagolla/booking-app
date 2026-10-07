import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
import { Coupon } from '../src/models/Coupon.js'
import { CouponUsage } from '../src/models/CouponUsage.js'
import { FoodItem } from '../src/models/FoodItem.js'
import { Movie } from '../src/models/Movie.js'
import { Payment } from '../src/models/Payment.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { pay as gatewayPay, verifySignature } from '../src/services/payment/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-16 mock payment (9.4, PAY-01 … PAY-04) + T-04: bad signature refused, success confirms

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second')] }])
const NEXT_YEAR = String((new Date().getUTCFullYear() + 1) % 100).padStart(2, '0')
const GOOD_CARD = { number: '4111 1111 1111 1111', expiry: `12/${NEXT_YEAR}`, cvv: '123', name: 'Meena Iyer' }

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

let owner, show, meena, ravi, meenaUser
const hold = async (api = meena, seatIds = ['A1', 'A2']) => (await api.post('/api/bookings/hold', { showId: String(show._id), seatIds })).body.booking
const order = (booking, api = meena) => api.post(`/api/bookings/${booking.id}/payments`)
const payUpi = (orderId, upiId = 'success@test', api = meena) => api.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId })
const verify = (body, api = meena) => api.post('/api/payments/verify', body)
// hold → order → pay (UPI success) → { booking, orderId, paid }
async function payFor(booking) {
  const { orderId } = (await order(booking)).body
  const paid = (await payUpi(orderId)).body
  return { orderId, ...paid }
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init(), Payment.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  meenaUser = await createUser({ email: 'meena@example.com' })
  await createUser({ email: 'ravi@example.com' })
  const theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  show = await Show.create({
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
    prices: [{ seatClass: 'second', pricePaise: 12000 }],
    layout: built.layout,
    totalSeats: 3,
  })
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/bookings/:id/payments (create order, PAY-01)', () => {
  it('makes an order for the server total; a new order replaces an older unpaid one', async () => {
    const booking = await hold() // 2 × ₹120 + 2 × ₹30 = ₹300
    const first = await order(booking)
    expect(first.status).toBe(201)
    expect(first.body).toEqual({ orderId: expect.stringMatching(/^order_/), amountPaise: 30000 })
    const second = await order(booking)
    const payments = await Payment.find().sort({ createdAt: 1 })
    expect(payments.map((p) => [p.orderId, p.status, p.failureReason ?? null])).toEqual([
      [first.body.orderId, 'failed', 'replaced'],
      [second.body.orderId, 'created', null],
    ])
    expect(String(payments[1].userId)).toBe(String(meenaUser._id))
    // The replaced order cannot be paid any more
    expect((await payUpi(first.body.orderId)).body.error.details.reason).toBe('order_closed')
  })

  it('the coupon is checked again: one that stopped working is removed and the new total shown', async () => {
    const coupon = await Coupon.create({ code: 'TEN', discountType: 'flat', value: 1000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: owner._id })
    const booking = await hold()
    await meena.put(`/api/bookings/${booking.id}/coupon`, { code: 'TEN' })
    await Coupon.updateOne({ _id: coupon._id }, { endAt: new Date(Date.now() - 1000) }) // ended meanwhile
    const res = await order(booking)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'COUPON_INVALID', message: 'This coupon has ended. It was removed. Your new total is ₹300.', details: { reason: 'expired', removed: true, totalPaise: 30000 } })
    expect((await Booking.findById(booking.id)).pricing.discountType).toBeNull()
    expect(await Payment.countDocuments()).toBe(0)
  })

  it('hold over → 409 HOLD_EXPIRED; someone else’s booking → 404; owners → 403', async () => {
    const booking = await hold()
    expect((await order(booking, ravi)).status).toBe(404)
    expect((await order(booking, as(await login('owner@example.com')))).status).toBe(403)
    await meena.delete(`/api/bookings/${booking.id}/hold`)
    const late = await order(booking)
    expect(late.status).toBe(409)
    expect(late.body.error.code).toBe('HOLD_EXPIRED')
  })
})

describe('POST /api/mock-gateway/pay (PAY-02, PAY-03 test values)', () => {
  it('UPI success@test → paymentId + a good signature; other UPI IDs fail and close the order', async () => {
    const booking = await hold()
    const first = (await order(booking)).body.orderId
    const fail = await payUpi(first, 'fail@test')
    expect(fail.status).toBe(400)
    expect(fail.body.error).toMatchObject({ code: 'PAYMENT_FAILED', message: 'Payment failed. No money was taken. You can try again.' })
    expect(await Payment.findOne({ orderId: first })).toMatchObject({ status: 'failed', failureReason: 'declined', method: 'upi' })
    expect((await Booking.findById(booking.id)).status).toBe('pending') // the hold stays: try again
    expect((await payUpi((await order(booking)).body.orderId, 'meena@okbank')).status).toBe(400)

    const { orderId } = (await order(booking)).body
    const ok = await payUpi(orderId, 'SUCCESS@test')
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ paymentId: expect.stringMatching(/^pay_/), signature: expect.stringMatching(/^[0-9a-f]{64}$/) })
    expect(verifySignature({ orderId, ...ok.body })).toBe(true)
    // Mock "payment captured" webhook (JOB-02): the server knows about the money before verify
    expect(await Payment.findOne({ orderId })).toMatchObject({ method: 'upi', status: 'created', paymentId: ok.body.paymentId, capturedAt: expect.any(Date) })
    // An order is paid only once, and no new order while a paid one waits for its confirm
    expect((await payUpi(orderId)).body.error.details.reason).toBe('already_paid')
    expect((await order(booking)).body.error.details).toMatchObject({ rule: 'JOB-02', reason: 'payment_pending' })
  })

  it('card 4111 1111 1111 1111 succeeds, any other card fails; card data is checked and never stored', async () => {
    const booking = await hold()
    const cardPay = async (card) => meena.post('/api/mock-gateway/pay', { orderId: (await order(booking)).body.orderId, method: 'card', card })
    expect((await cardPay({ ...GOOD_CARD, number: '5555 5555 5555 4444' })).body.error.code).toBe('PAYMENT_FAILED')
    expect((await cardPay({ ...GOOD_CARD, number: '4111' })).body.error.code).toBe('VALIDATION_ERROR')
    expect((await cardPay({ ...GOOD_CARD, expiry: '01/20' })).body.error.code).toBe('VALIDATION_ERROR')
    expect((await cardPay({ ...GOOD_CARD, cvv: '12' })).body.error.code).toBe('VALIDATION_ERROR')
    expect((await cardPay(GOOD_CARD)).status).toBe(200)
    const stored = JSON.stringify(await Payment.find().lean())
    expect(stored).not.toContain('4111')
    expect(stored).not.toContain('5555')
  })

  it('netbanking: every bank succeeds except "Test Bank (fails)"', async () => {
    const booking = await hold()
    const bankPay = async (bank) => meena.post('/api/mock-gateway/pay', { orderId: (await order(booking)).body.orderId, method: 'netbanking', bank })
    expect((await bankPay('fail_test')).body.error.code).toBe('PAYMENT_FAILED')
    expect((await bankPay('no_bank')).body.error.code).toBe('VALIDATION_ERROR')
    expect((await bankPay('sbi_test')).status).toBe(200)
  })

  it('only the owner of the order can pay it', async () => {
    const { orderId } = (await order(await hold())).body
    expect((await payUpi(orderId, 'success@test', ravi)).status).toBe(404)
  })
})

describe('T-04: POST /api/payments/verify', () => {
  it('bad signature → 400, nothing confirmed', async () => {
    const booking = await hold()
    const { orderId, paymentId, signature } = await payFor(booking)
    const flipped = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1)
    const res = await verify({ orderId, paymentId, signature: flipped })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'RULE_BROKEN', details: { reason: 'bad_signature' } })
    // A signature of another payment does not fit either
    expect((await verify({ orderId, paymentId: 'pay_someoneelse1', signature })).body.error.details.reason).toBe('bad_signature')
    expect((await Booking.findById(booking.id)).status).toBe('pending')
    expect((await Payment.findOne({ orderId })).status).toBe('created')
    expect(await ShowSeat.countDocuments({ status: 'booked' })).toBe(0)
  })

  it('good signature → one transaction: booking confirmed, seats booked, payment success, show count, coupon counted', async () => {
    const coupon = await Coupon.create({ code: 'TEN', discountType: 'flat', value: 1000, totalLimit: 1, usedCount: 0, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: owner._id })
    const booking = await hold()
    await meena.put(`/api/bookings/${booking.id}/coupon`, { code: 'TEN' })
    const { orderId, paymentId, signature } = await payFor(booking)
    // The last use goes to someone else meanwhile: still honoured (decided 2026-10-06)
    await Coupon.updateOne({ _id: coupon._id }, { usedCount: 1 })

    const res = await verify({ orderId, paymentId, signature })
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({ id: booking.id, status: 'confirmed', holdExpiresAt: null, pricing: { totalPaise: 29000, couponCode: 'TEN' } })

    const saved = await Booking.findById(booking.id)
    expect(saved.confirmedAt).toBeInstanceOf(Date)
    expect(saved.holdExpiresAt).toBeUndefined()
    const seats = await ShowSeat.find({ bookingId: booking.id })
    expect(seats.map((s) => [s.seatId, s.status, s.expiresAt ?? null])).toEqual([
      ['A1', 'booked', null],
      ['A2', 'booked', null],
    ])
    expect(await Payment.findOne({ orderId })).toMatchObject({ status: 'success', paymentId, amountPaise: 29000 })
    expect((await Show.findById(show._id)).bookedCount).toBe(2)
    expect((await Coupon.findById(coupon._id)).usedCount).toBe(2)
    expect(await CouponUsage.countDocuments({ couponId: coupon._id, bookingId: booking.id })).toBe(1)

    // Verifying again is fine and changes nothing
    const again = await verify({ orderId, paymentId, signature })
    expect(again.body.booking.status).toBe('confirmed')
    expect((await Show.findById(show._id)).bookedCount).toBe(2)
    // Booked seats stay taken for others; the booking cannot be paid again
    expect((await ravi.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A1'] })).status).toBe(409)
    expect((await order(booking)).body.error.details.reason).toBe('already_paid')
  })

  it('hold ended during payment → 409 HOLD_EXPIRED, money back at once, seats free', async () => {
    const booking = await hold()
    const { orderId, paymentId, signature } = await payFor(booking)
    const past = new Date(Date.now() - 1000)
    await Booking.updateOne({ _id: booking.id }, { holdExpiresAt: past })
    await ShowSeat.updateMany({ bookingId: booking.id }, { expiresAt: past })

    const res = await verify({ orderId, paymentId, signature })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'HOLD_EXPIRED', message: 'Your seat hold ended before the payment finished. We refunded ₹300. Please pick seats again.' })
    const payment = await Payment.findOne({ orderId })
    expect(payment).toMatchObject({ status: 'refunded', paymentId })
    expect(payment.refunds).toHaveLength(1)
    expect(payment.refunds[0]).toMatchObject({ amountPaise: 30000, reason: 'hold_expired', refundId: expect.stringMatching(/^rfnd_/) })
    expect((await Booking.findById(booking.id)).status).toBe('released')
    expect(await ShowSeat.countDocuments()).toBe(0)
    expect((await Show.findById(show._id)).bookedCount).toBe(0)
  })

  it('total changed after the order (food added) → refunded, the hold stays for a new payment', async () => {
    const tea = await FoodItem.create({ theatreId: show.theatreId, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
    const booking = await hold()
    const { orderId, paymentId, signature } = await payFor(booking)
    await meena.put(`/api/bookings/${booking.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 1 }], pickup: 'interval' })

    const res = await verify({ orderId, paymentId, signature })
    expect(res.body.error).toMatchObject({ code: 'RULE_BROKEN', message: 'Your total changed while you were paying. We refunded ₹300. Please pay again.', details: { reason: 'amount_changed' } })
    expect((await Payment.findOne({ orderId })).status).toBe('refunded')
    expect((await Booking.findById(booking.id)).status).toBe('pending')
    // A new order has the new total and goes through
    const next = await payFor(booking)
    expect((await Payment.findOne({ orderId: next.orderId })).amountPaise).toBe(32000)
    expect((await verify({ orderId: next.orderId, paymentId: next.paymentId, signature: next.signature })).body.booking.status).toBe('confirmed')
  })

  it('a failed or replaced order cannot be verified; another user’s order → 404; bad input → 400', async () => {
    const booking = await hold()
    const old = (await order(booking)).body.orderId
    await order(booking) // replaces the unpaid order
    const signed = await gatewayPay({ orderId: old, method: 'upi', upiId: 'success@test' }) // a signature the gateway made for it
    expect((await verify({ orderId: old, ...signed })).body.error.details.reason).toBe('order_closed')
    const paid = await payFor(booking)
    expect((await verify(paid, ravi)).status).toBe(404)
    expect((await verify({ orderId: 'nope', paymentId: paid.paymentId, signature: paid.signature })).status).toBe(400)
  })
})

describe('rate limit: payment steps together, per user (api.md 1.7)', () => {
  it('10 in 10 minutes, then 429', async () => {
    const booking = await hold()
    for (let i = 0; i < 10; i++) expect((await order(booking)).status).toBe(201)
    expect((await order(booking)).status).toBe(429)
  })
})
