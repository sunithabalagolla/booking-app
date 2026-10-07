import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { paymentSafetyCheck } from '../src/jobs/paymentSafety.js'
import { releaseExpiredHolds } from '../src/jobs/releaseExpiredHolds.js'
import { Booking } from '../src/models/Booking.js'
import { Counter } from '../src/models/Counter.js'
import { Coupon } from '../src/models/Coupon.js'
import { CouponUsage } from '../src/models/CouponUsage.js'
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
import { sendEmail } from '../src/services/email/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// JOB-02 payment safety check (PAY-05): paid but never verified → confirm or refund + email;
// never paid → failed after max(15 min, seat hold time) and the seats freed.

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

let owner, theatre, show, meena, ravi
const hold = async (api = meena, seatIds = ['A1', 'A2']) => (await api.post('/api/bookings/hold', { showId: String(show._id), seatIds })).body.booking
const order = async (booking) => (await meena.post(`/api/bookings/${booking.id}/payments`)).body.orderId
// Hold → order → pay at the gateway, then the browser "closes": no verify call
async function paidNotVerified(seatIds) {
  const booking = await hold(meena, seatIds)
  const orderId = await order(booking)
  const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  return { booking, orderId, ...paid }
}
const emailsTo = (subjectStart) => sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.subject.startsWith(subjectStart))

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init(), Payment.init(), Invoice.init(), Counter.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockReset()
  sendEmail.mockResolvedValue()
  await createTestSettings() // hold time 10 minutes
  owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  await createUser({ email: 'ravi@example.com' })
  theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  show = await Show.create({
    movieId: movie._id,
    theatreId: theatre._id,
    screenId: screen._id,
    ownerId: owner._id,
    cityCode: 'hyderabad',
    startAt: later(180),
    endAt: later(360),
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

describe('JOB-02 part 1: paid at the gateway, never verified', () => {
  it('waits 2 minutes; then, with the hold still running, confirms (invoice + E-03); a late verify is fine', async () => {
    const paid = await paidNotVerified()
    expect(await paymentSafetyCheck(later(1))).toEqual({ confirmed: 0, refunded: 0, failed: 0, released: 0 }) // grace time
    expect((await Payment.findOne({ orderId: paid.orderId })).status).toBe('created')

    expect(await paymentSafetyCheck(later(3))).toEqual({ confirmed: 1, refunded: 0, failed: 0, released: 0 })
    const booking = await Booking.findById(paid.booking.id)
    expect(booking.status).toBe('confirmed')
    expect(booking.invoiceId).toBeTruthy()
    expect(await Payment.findOne({ orderId: paid.orderId })).toMatchObject({ status: 'success', paymentId: paid.paymentId })
    expect(await ShowSeat.find({ bookingId: booking._id }).distinct('status')).toEqual(['booked'])
    expect((await Show.findById(show._id)).bookedCount).toBe(2)
    await vi.waitFor(() => expect(emailsTo('Talkies – booking confirmed')).toHaveLength(1))

    // The browser comes back and verifies: same booking, nothing twice
    const late = await meena.post('/api/payments/verify', { orderId: paid.orderId, paymentId: paid.paymentId, signature: paid.signature })
    expect(late.status).toBe(200)
    expect(late.body.booking).toMatchObject({ id: paid.booking.id, status: 'confirmed' })
    expect(await Invoice.countDocuments()).toBe(1)
    expect(await paymentSafetyCheck(later(10))).toEqual({ confirmed: 0, refunded: 0, failed: 0, released: 0 }) // run again = nothing
  })

  it('hold over (even released by JOB-01) but the seats are still free → takes them again and confirms', async () => {
    const paid = await paidNotVerified()
    await releaseExpiredHolds(later(12))
    expect((await Booking.findById(paid.booking.id)).status).toBe('released')
    expect(await ShowSeat.countDocuments()).toBe(0)

    expect((await paymentSafetyCheck(later(13))).confirmed).toBe(1)
    const booking = await Booking.findById(paid.booking.id)
    expect(booking).toMatchObject({ status: 'confirmed', releasedAt: undefined })
    expect((await ShowSeat.find({ bookingId: booking._id })).map((s) => [s.seatId, s.status]).sort()).toEqual([
      ['A1', 'booked'],
      ['A2', 'booked'],
    ])
    expect((await Payment.findOne({ orderId: paid.orderId })).status).toBe('success')
  })

  it('a seat was taken by someone else meanwhile → refund + "Payment refunded" email, no booking, no invoice number', async () => {
    const paid = await paidNotVerified()
    await releaseExpiredHolds(later(12))
    const raviHold = await hold(ravi, ['A2', 'A3'])
    await ShowSeat.updateMany({ bookingId: raviHold.id }, { expiresAt: later(60) }) // Ravi's hold still runs at the job time
    await Booking.updateOne({ _id: raviHold.id }, { holdExpiresAt: later(60) })

    expect(await paymentSafetyCheck(later(13))).toEqual({ confirmed: 0, refunded: 1, failed: 0, released: 0 })
    const payment = await Payment.findOne({ orderId: paid.orderId })
    expect(payment.status).toBe('refunded')
    expect(payment.refunds).toEqual([expect.objectContaining({ amountPaise: 30000, reason: 'seats_taken', refundId: expect.stringMatching(/^rfnd_/) })])
    expect((await Booking.findById(paid.booking.id)).status).toBe('released')
    expect(await ShowSeat.find({ bookingId: raviHold.id }).countDocuments()).toBe(2) // Ravi keeps his seats
    expect(await ShowSeat.countDocuments({ bookingId: paid.booking.id })).toBe(0)
    expect(await Invoice.countDocuments()).toBe(0)
    expect(await Counter.countDocuments()).toBe(0)

    await vi.waitFor(() => expect(emailsTo('Talkies – payment refunded')).toHaveLength(1))
    const mail = emailsTo('Talkies – payment refunded')[0]
    expect(mail.to).toBe('meena@example.com')
    expect(mail.text).toContain('Your payment for Kadal Kaatru (')
    expect(mail.text).toContain('went through, but we could not keep your seats.\nWe refunded ₹300. No booking was made.')

    // The browser verifies late: told about the refund
    const late = await meena.post('/api/payments/verify', { orderId: paid.orderId, paymentId: paid.paymentId, signature: paid.signature })
    expect(late.body.error).toMatchObject({ message: 'This payment was refunded: ₹300. No booking was made. Please start again.', details: { reason: 'refunded' } })
  })

  it('hold over and the show has started or was cancelled → refund', async () => {
    const first = await paidNotVerified(['A1'])
    await Show.updateOne({ _id: show._id }, { startAt: later(5) })
    expect((await paymentSafetyCheck(later(12))).refunded).toBe(1)
    expect((await Payment.findOne({ orderId: first.orderId })).refunds[0].reason).toBe('show_closed')

    await Show.updateOne({ _id: show._id }, { startAt: later(180) })
    const second = await paidNotVerified(['A2'])
    await Show.updateOne({ _id: show._id }, { status: 'cancelled' }) // cancelled after the payment
    expect((await paymentSafetyCheck(later(12))).refunded).toBe(1)
    expect((await Payment.findOne({ orderId: second.orderId })).refunds[0].reason).toBe('show_closed')
    expect((await Booking.findById(second.booking.id)).status).toBe('released')
  })

  it('the total changed after paying (food added) → refund; the running hold stays for a new payment', async () => {
    const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
    const paid = await paidNotVerified()
    await meena.put(`/api/bookings/${paid.booking.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 1 }], pickup: 'interval' })
    expect((await paymentSafetyCheck(later(3))).refunded).toBe(1)
    expect((await Payment.findOne({ orderId: paid.orderId })).refunds[0].reason).toBe('amount_changed')
    expect((await Booking.findById(paid.booking.id)).status).toBe('pending')
    expect(await ShowSeat.countDocuments({ bookingId: paid.booking.id, status: 'held' })).toBe(2)
  })

  it('JOB-02 and a late verify at the same moment: one confirm, one invoice, one email', async () => {
    const paid = await paidNotVerified()
    const [res] = await Promise.all([
      meena.post('/api/payments/verify', { orderId: paid.orderId, paymentId: paid.paymentId, signature: paid.signature }),
      paymentSafetyCheck(later(3)),
    ])
    expect(res.status).toBe(200)
    expect(res.body.booking.status).toBe('confirmed')
    expect(await Payment.findOne({ orderId: paid.orderId })).toMatchObject({ status: 'success', refunds: [] })
    expect(await Invoice.countDocuments()).toBe(1)
    expect((await Show.findById(show._id)).bookedCount).toBe(2)
    await vi.waitFor(() => expect(emailsTo('Talkies – booking confirmed')).toHaveLength(1))
    expect(emailsTo('Talkies – payment refunded')).toHaveLength(0)
  })

  it('no new order (no second payment) while a paid one waits for JOB-02', async () => {
    const paid = await paidNotVerified()
    const res = await meena.post(`/api/bookings/${paid.booking.id}/payments`)
    expect(res.body.error.details).toMatchObject({ rule: 'JOB-02', reason: 'payment_pending' })
    expect(await Payment.countDocuments()).toBe(1)
  })
})

describe('JOB-02 part 2: orders never paid', () => {
  it('failed after 15 minutes (hold time 10): booking released, seats free', async () => {
    const booking = await hold()
    const orderId = await order(booking)
    expect((await paymentSafetyCheck(later(14))).failed).toBe(0)
    expect(await paymentSafetyCheck(later(16))).toEqual({ confirmed: 0, refunded: 0, failed: 1, released: 1 })
    expect(await Payment.findOne({ orderId })).toMatchObject({ status: 'failed', failureReason: 'timeout' })
    expect((await Booking.findById(booking.id)).status).toBe('released')
    expect(await ShowSeat.countDocuments()).toBe(0)
    // Paying the closed order now is refused
    const pay = await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })
    expect(pay.body.error.details.reason).toBe('order_closed')
    expect(await paymentSafetyCheck(later(30))).toEqual({ confirmed: 0, refunded: 0, failed: 0, released: 0 })
  })

  it('a longer seat hold time (30 min): the order waits until the hold is over', async () => {
    await Settings.updateOne({ _id: 'platform' }, { holdMinutes: 30 })
    const booking = await hold()
    const orderId = await order(booking)
    expect((await paymentSafetyCheck(later(20))).failed).toBe(0)
    expect((await Payment.findOne({ orderId })).status).toBe('created')
    expect((await Booking.findById(booking.id)).status).toBe('pending')
    expect((await paymentSafetyCheck(later(31))).failed).toBe(1)
    expect((await Booking.findById(booking.id)).status).toBe('released')
  })

  it('a replaced or failed order is left alone; a confirmed booking is not touched', async () => {
    const booking = await hold()
    await order(booking)
    const orderId = await order(booking) // the first one is now 'replaced'
    const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
    await meena.post('/api/payments/verify', { orderId, ...paid })
    expect(await paymentSafetyCheck(later(60))).toEqual({ confirmed: 0, refunded: 0, failed: 0, released: 0 })
    expect((await Booking.findById(booking.id)).status).toBe('confirmed')
    expect((await Payment.find().sort({ createdAt: 1 })).map((p) => [p.status, p.failureReason ?? null])).toEqual([
      ['failed', 'replaced'],
      ['success', null],
    ])
  })
})
