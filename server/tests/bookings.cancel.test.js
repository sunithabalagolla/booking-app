import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
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
import { cancelPreview } from '../src/services/bookingCancel.js'
import { sendEmail } from '../src/services/email/index.js'
import { financialYear } from '../src/services/invoice.js'
import * as gateway from '../src/services/payment/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-20 cancel booking (flow 9.5): BR-04 cutoff, BR-05 refund, GST-02 credit note, E-04

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
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
const hold = async (seatIds = ['A1', 'A2']) => (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds })).body.booking
async function pay(held) {
  const { orderId } = (await meena.post(`/api/bookings/${held.id}/payments`)).body
  const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  return (await meena.post('/api/payments/verify', { orderId, ...paid })).body.booking
}
const cancelPath = (booking) => `/api/bookings/${booking.id}/cancel`
const previewPath = (booking) => `/api/bookings/${booking.id}/cancel-preview`

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init(), Payment.init(), Invoice.init(), Counter.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockReset()
  sendEmail.mockResolvedValue()
  await createTestSettings()
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

// 2 × ₹120 − coupon ₹10 = ₹230 · 2 × Tea ₹40 · fee ₹60 → paid ₹330; refund 75% × 230 + 40 = ₹212.50
async function bookingWithFoodAndCoupon() {
  const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
  await Coupon.create({ code: 'TEN', discountType: 'flat', value: 1000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: owner._id })
  const held = await hold()
  await meena.put(`/api/bookings/${held.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 2 }], pickup: 'interval' })
  await meena.put(`/api/bookings/${held.id}/coupon`, { code: 'TEN' })
  return pay(held)
}

describe('GET /api/bookings/:id/cancel-preview (BR-04, BR-05)', () => {
  it('shows the refund per line and the cutoff time', async () => {
    const booking = await bookingWithFoodAndCoupon()
    const res = await meena.get(previewPath(booking))
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ allowed: true, reason: null, refundPaise: 21250 })
    expect(new Date(res.body.cutoffAt).getTime()).toBe(show.startAt.getTime() - 120 * MIN)
    expect(res.body.lines).toEqual([
      { kind: 'ticket', description: '2 × Second class', paidPaise: 23000, percent: 75, refundPaise: 17250 },
      { kind: 'food', description: '2 × Tea', paidPaise: 4000, percent: 100, refundPaise: 4000 },
      { kind: 'convenience_fee', description: 'Convenience fee', paidPaise: 6000, percent: 0, refundPaise: 0 },
    ])
  })

  it('cutoff: allowed exactly at 2 hours before, not 1 ms later; the cutoff copied into the booking wins', async () => {
    const booking = await pay(await hold(['A1']))
    const saved = await Booking.findById(booking.id)
    expect(saved.pricing.rates.cancelCutoffMinutes).toBe(120)
    const cutoff = show.startAt.getTime() - 120 * MIN
    expect((await cancelPreview(saved, new Date(cutoff))).allowed).toBe(true)
    expect(await cancelPreview(saved, new Date(cutoff + 1))).toMatchObject({ allowed: false, reason: 'cutoff' })

    // Settings changed later: this booking keeps its 120 minutes (A-05)
    await Settings.updateOne({ _id: 'platform' }, { cancelCutoffMinutes: 30 })
    expect((await cancelPreview(saved, new Date(cutoff + MIN))).allowed).toBe(false)
    // An older booking without the copy uses the current setting
    await Booking.updateOne({ _id: booking.id }, { $unset: { 'pricing.rates.cancelCutoffMinutes': 1 } })
    expect((await cancelPreview(await Booking.findById(booking.id), new Date(cutoff + MIN))).allowed).toBe(true)
  })

  it('a hold → not allowed; someone else’s booking → 404', async () => {
    const held = await hold(['A1'])
    expect((await meena.get(previewPath(held))).body).toMatchObject({ allowed: false, reason: 'not_confirmed' })
    expect((await ravi.get(previewPath(held))).status).toBe(404)
  })
})

describe('POST /api/bookings/:id/cancel (U-20)', () => {
  it('one transaction: cancelled, seats free, show count, credit note; then the refund and E-04', async () => {
    const booking = await bookingWithFoodAndCoupon()
    const res = await meena.post(cancelPath(booking))
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', cancellation: { refundPaise: 21250, refundStatus: 'done', creditNoteId: expect.stringMatching(/^[0-9a-f]{24}$/) } })
    expect(res.body.booking.qrDataUrl).toBeUndefined() // no QR for a cancelled ticket

    expect(await ShowSeat.countDocuments()).toBe(0)
    expect((await Show.findById(show._id)).bookedCount).toBe(0)
    const saved = await Booking.findById(booking.id)
    expect(saved.cancellation).toMatchObject({ refundPaise: 21250, refundStatus: 'done' })
    expect(String(saved.cancellation.by)).toBe(String((await User.findOne({ email: 'meena@example.com' }))._id))

    // GST-02 credit note against the invoice, own series
    const fy = financialYear(new Date())
    const note = await Invoice.findById(saved.cancellation.creditNoteId)
    const invoice = await Invoice.findById(saved.invoiceId)
    expect(note).toMatchObject({ type: 'credit_note', number: `CN/${fy}/000001`, againstNumber: invoice.number, bookingNumber: booking.bookingNumber, buyer: { name: 'Meena Iyer' } })
    expect(String(note.invoiceId)).toBe(String(invoice._id))
    expect(note.lines.map((l) => [l.kind, l.description, l.hsnSac, l.totalPaise])).toEqual([
      ['ticket', 'Movie ticket: 2 × Second class (75% refund)', 'TEST-TICKET', 17250],
      ['food', 'Food: 2 × Tea (100% refund)', 'TEST-FOOD', 4000],
    ])
    for (const l of note.lines) expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(l.totalPaise)
    expect(note.totals.totalPaise).toBe(21250)

    // The payment: partly refunded, with the refund entry
    const payment = await Payment.findOne({ bookingId: booking.id, status: 'partially_refunded' })
    expect(payment.refunds).toEqual([expect.objectContaining({ amountPaise: 21250, reason: 'user_cancelled', refundId: expect.stringMatching(/^rfnd_/) })])
    expect(String(payment.refunds[0].creditNoteId)).toBe(String(note._id))

    // The coupon use is not given back (decided 2026-09-30)
    expect((await Coupon.findOne({ code: 'TEN' })).usedCount).toBe(1)

    // E-04 with the credit note PDF
    await vi.waitFor(() => expect(sendEmail.mock.calls.some((c) => c[0].subject.startsWith('Talkies – booking cancelled'))).toBe(true))
    const mail = sendEmail.mock.calls.map((c) => c[0]).find((m) => m.subject.startsWith('Talkies – booking cancelled'))
    expect(mail.to).toBe('meena@example.com')
    expect(mail.subject).toBe(`Talkies – booking cancelled: Kadal Kaatru (${booking.bookingNumber})`)
    expect(mail.text).toContain('We refunded ₹212.50 to your payment method.')
    expect(mail.text).toContain(`Your credit note ${note.number} (PDF) is attached.`)
    expect(mail.attachments).toEqual([expect.objectContaining({ name: `Talkies-credit-note-${note.number.replaceAll('/', '-')}.pdf`, contentType: 'application/pdf' })])
    expect(mail.attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-')

    // The credit note PDF downloads like an invoice
    const pdf = await meena.get(`/api/invoices/${note._id}/pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-disposition']).toContain('Talkies-credit-note-CN-')

    // The seats can be booked again by someone else
    expect((await ravi.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A1', 'A2'] })).status).toBe(201)
  })

  it('cancel twice → 400; after the cutoff → 400 BR-04; a hold → 400; someone else → 404', async () => {
    const booking = await pay(await hold(['A1']))
    expect((await ravi.post(cancelPath(booking))).status).toBe(404)
    expect((await meena.post(cancelPath(booking))).status).toBe(200)
    expect((await meena.post(cancelPath(booking))).body.error.details).toMatchObject({ reason: 'not_confirmed' })
    expect(await Invoice.countDocuments({ type: 'credit_note' })).toBe(1)

    const late = await pay(await hold(['A2']))
    await Booking.updateOne({ _id: late.id }, { 'show.startAt': later(119) })
    const res = await meena.post(cancelPath(late))
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ code: 'RULE_BROKEN', message: 'Cancellation is closed: it is allowed only until 2 hours before the show.', details: { rule: 'BR-04', reason: 'cutoff' } })
    expect((await Booking.findById(late.id)).status).toBe('confirmed')

    const held = await hold(['A3'])
    expect((await meena.post(cancelPath(held))).body.error.details.reason).toBe('not_confirmed')
  })

  it('two cancels at the same moment: one wins, one credit note, one refund', async () => {
    const booking = await pay(await hold(['A1']))
    const results = await Promise.all([meena.post(cancelPath(booking)), meena.post(cancelPath(booking))])
    expect(results.map((r) => r.status).sort()).toEqual([200, 400])
    expect(await Invoice.countDocuments({ type: 'credit_note' })).toBe(1)
    expect((await Payment.findOne({ bookingId: booking.id, status: 'partially_refunded' })).refunds).toHaveLength(1)
    expect((await Show.findById(show._id)).bookedCount).toBe(0)
  })

  it('a booking from before U-17 (no invoice): cancelled without a credit note', async () => {
    const booking = await pay(await hold(['A1']))
    await Booking.updateOne({ _id: booking.id }, { $unset: { invoiceId: 1 } })
    const res = await meena.post(cancelPath(booking))
    expect(res.body.booking.cancellation).toMatchObject({ refundPaise: 9000, refundStatus: 'done', creditNoteId: null })
    expect(await Invoice.countDocuments({ type: 'credit_note' })).toBe(0)
    await vi.waitFor(() => expect(sendEmail.mock.calls.some((c) => c[0].subject.startsWith('Talkies – booking cancelled'))).toBe(true))
    const mail = sendEmail.mock.calls.map((c) => c[0]).find((m) => m.subject.startsWith('Talkies – booking cancelled'))
    expect(mail.attachments).toEqual([])
    expect(mail.text).not.toContain('credit note')
  })

  it('the gateway refund fails → booking still cancelled, refund left pending (JOB-04 later)', async () => {
    const booking = await pay(await hold(['A1']))
    const spy = vi.spyOn(gateway, 'refund').mockRejectedValueOnce(new Error('gateway down'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await meena.post(cancelPath(booking))
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({ status: 'cancelled', cancellation: { refundStatus: 'pending' } })
    expect((await Payment.findOne({ bookingId: booking.id })).status).toBe('success')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('left pending: gateway down'))
    spy.mockRestore()
    log.mockRestore()
  })
})
