import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { processCancellations, runCancellationsSoon } from '../src/jobs/cancellationRefunds.js'
import { AuditLog } from '../src/models/AuditLog.js'
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
import * as gateway from '../src/services/payment/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-06 cancel show (flow 9.6): BR-06 100% refund, BR-07 not after the start, JOB-04
// credit notes + refunds + E-05, audit log; T-06 show-cancel part

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second'), S('second'), S('second')] }])
const later = (minutes) => new Date(Date.now() + minutes * MIN)

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

let ownerUser, theatre, show, owner, otherOwner, admin, meena, ravi, sita
const hold = async (who, seatIds) => (await who.post('/api/bookings/hold', { showId: String(show._id), seatIds })).body.booking
async function pay(who, held) {
  const { orderId } = (await who.post(`/api/bookings/${held.id}/payments`)).body
  const paid = (await who.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  return (await who.post('/api/payments/verify', { orderId, ...paid })).body.booking
}
const cancelPath = (base = '/api/owner') => `${base}/shows/${show._id}/cancel`
const REASON = 'Projector lamp broke, sorry'
const mails = (prefix) => sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.subject.startsWith(prefix))
// JOB-04 runs in the background after the cancel; wait until everything is sent
const allSettled = () =>
  vi.waitFor(async () => expect(await Booking.countDocuments({ $or: [{ 'cancellation.refundStatus': 'pending' }, { 'cancellation.emailStatus': 'pending' }] })).toBe(0))

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init(), Payment.init(), Invoice.init(), Counter.init(), AuditLog.init()])
})
beforeEach(async () => {
  await runCancellationsSoon() // nothing from the last test still running
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockReset()
  sendEmail.mockResolvedValue()
  await createTestSettings()
  ownerUser = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'other@example.com', role: 'owner', phone: '9400000002', owner: { businessName: 'C', approvalStatus: 'approved' } })
  await createUser({ email: 'admin@example.com', role: 'admin' })
  await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  await createUser({ email: 'ravi@example.com', name: 'Ravi Kumar' })
  await createUser({ email: 'sita@example.com' })
  theatre = await Theatre.create({ ownerId: ownerUser._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: ownerUser._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  show = await Show.create({
    movieId: movie._id,
    theatreId: theatre._id,
    screenId: screen._id,
    ownerId: ownerUser._id,
    cityCode: 'hyderabad',
    startAt: later(60), // inside the user cutoff: the theatre can still cancel (only BR-07)
    endAt: later(240),
    label: 'matinee',
    language: 'Tamil',
    format: '2D',
    prices: [{ seatClass: 'second', pricePaise: 12000 }],
    layout: built.layout,
    totalSeats: 5,
  })
  owner = as(await login('owner@example.com'))
  otherOwner = as(await login('other@example.com'))
  admin = as(await login('admin@example.com'))
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
  sita = as(await login('sita@example.com'))
})
afterAll(async () => {
  await runCancellationsSoon()
  await closeTestDB()
})

// Meena: 2 × ₹120 − coupon ₹10 = ₹230 · 2 × Tea ₹40 · fee ₹60 → paid ₹330
// Ravi: 1 × ₹120 + fee ₹30 → paid ₹150
async function twoBookings() {
  const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: ownerUser._id, name: 'Tea', pricePaise: 2000, isVeg: true })
  await Coupon.create({ code: 'TEN', discountType: 'flat', value: 1000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: ownerUser._id })
  const held = await hold(meena, ['A1', 'A2'])
  await meena.put(`/api/bookings/${held.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 2 }], pickup: 'interval' })
  await meena.put(`/api/bookings/${held.id}/coupon`, { code: 'TEN' })
  return [await pay(meena, held), await pay(ravi, await hold(ravi, ['A3']))]
}

describe('O-06 cancel show (owner)', () => {
  it('preview, then ONE transaction; JOB-04 sends credit notes, 100% refunds and E-05 (BR-06)', async () => {
    const [m, r] = await twoBookings()
    const unpaid = await hold(sita, ['A4']) // an unpaid hold ends with the show

    const preview = await owner.get(`/api/owner/shows/${show._id}/cancel-preview`)
    expect(preview.status).toBe(200)
    expect(preview.body).toEqual({ bookings: 2, refundPaise: 48000 })

    const res = await owner.post(cancelPath(), { reason: `  ${REASON}  ` })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ bookings: 2, refundPaise: 48000, show: { status: 'cancelled', cancelReason: REASON, bookedCount: 0 } })

    const saved = await Show.findById(show._id)
    expect(saved).toMatchObject({ status: 'cancelled', cancelReason: REASON, bookedCount: 0 })
    expect(String(saved.cancelledBy)).toBe(String(ownerUser._id))
    expect(await ShowSeat.countDocuments()).toBe(0)
    expect((await Booking.findById(unpaid.id)).status).toBe('released')

    // Audit log (A-14): how the admin finds out (flow 9.6)
    const audit = await AuditLog.findOne({ action: 'show.cancel' })
    expect(audit).toMatchObject({ actorRole: 'owner', targetType: 'show', details: { reason: REASON, bookings: 2, refundPaise: 48000 } })

    await allSettled()
    const fy = (await Invoice.findOne({ type: 'invoice' })).financialYear
    for (const [booking, paidPaise, name] of [
      [m, 33000, 'Meena Iyer'],
      [r, 15000, 'Ravi Kumar'],
    ]) {
      const b = await Booking.findById(booking.id)
      expect(b.status).toBe('cancelled_by_theatre')
      expect(b.cancellation).toMatchObject({ reason: REASON, refundPaise: paidPaise, refundStatus: 'done', emailStatus: 'sent' })

      // GST-02 credit note for everything, convenience fee included
      const note = await Invoice.findById(b.cancellation.creditNoteId)
      expect(note).toMatchObject({ type: 'credit_note', againstNumber: (await Invoice.findById(b.invoiceId)).number, buyer: { name } })
      expect(note.number).toMatch(new RegExp(`^CN/${fy}/00000[12]$`))
      expect(note.totals.totalPaise).toBe(paidPaise)
      expect(note.lines.find((l) => l.kind === 'convenience_fee').totalPaise).toBe(paidPaise === 33000 ? 6000 : 3000)

      // The payment is fully refunded
      const payment = await Payment.findOne({ bookingId: booking.id, status: 'refunded' })
      expect(payment.refunds).toEqual([expect.objectContaining({ amountPaise: paidPaise, reason: 'show_cancelled' })])
      expect(String(payment.refunds[0].creditNoteId)).toBe(String(note._id))
    }
    const meenaNote = await Invoice.findById((await Booking.findById(m.id)).cancellation.creditNoteId)
    expect(meenaNote.lines.map((l) => [l.kind, l.totalPaise])).toEqual([
      ['ticket', 23000],
      ['food', 4000],
      ['convenience_fee', 6000],
    ])

    // E-05 once to each user, with the credit note PDF
    const sent = mails('Talkies – show cancelled')
    expect(sent.map((x) => x.to).sort()).toEqual(['meena@example.com', 'ravi@example.com'])
    const mail = sent.find((x) => x.to === 'meena@example.com')
    expect(mail.subject).toBe(`Talkies – show cancelled: Kadal Kaatru (${m.bookingNumber})`)
    expect(mail.text).toContain('We are sorry. Chandni Talkies had to cancel the show of Kadal Kaatru')
    expect(mail.text).toContain(`Reason: ${REASON}`)
    expect(mail.text).toContain('We refunded the full amount, ₹330 (tickets, food and convenience fee), to your payment method.')
    expect(mail.attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-')

    // The user's ticket page shows the reason; the album shows a Cancelled stub
    const page = await meena.get(`/api/bookings/${m.id}`)
    expect(page.body.booking).toMatchObject({ status: 'cancelled_by_theatre', cancellation: { reason: REASON, refundPaise: 33000, refundStatus: 'done' } })
    const album = await meena.get('/api/bookings?tab=past')
    expect(album.body.items[0]).toMatchObject({ bookingNumber: m.bookingNumber, stamp: 'cancelled' })

    // Nothing more to do; nobody can book this show any more
    expect(await processCancellations()).toEqual({ refunded: 0, failed: 0, emailed: 0 })
    expect(mails('Talkies – show cancelled')).toHaveLength(2)
    expect((await sita.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A5'] })).body.error.details.reason).toBe('show_closed')
  })

  it('a show without bookings can be cancelled too', async () => {
    const res = await owner.post(cancelPath(), { reason: REASON })
    expect(res.body).toMatchObject({ bookings: 0, refundPaise: 0, show: { status: 'cancelled' } })
  })

  it('rules: reason 5–300, own show only, users 403, not after the start (BR-07), not twice', async () => {
    expect((await owner.post(cancelPath(), { reason: 'no' })).body.error).toMatchObject({ code: 'VALIDATION_ERROR' })
    expect((await owner.post(cancelPath(), { reason: 'x'.repeat(301) })).status).toBe(400)
    expect((await owner.post(cancelPath(), {})).status).toBe(400)
    expect((await otherOwner.post(cancelPath(), { reason: REASON })).status).toBe(404)
    expect((await otherOwner.get(`/api/owner/shows/${show._id}/cancel-preview`)).status).toBe(404)
    expect((await meena.post(cancelPath(), { reason: REASON })).status).toBe(403)
    expect((await meena.post(cancelPath('/api/admin'), { reason: REASON })).status).toBe(403)

    await Show.updateOne({ _id: show._id }, { startAt: later(-1) })
    const started = await owner.post(cancelPath(), { reason: REASON })
    expect(started.status).toBe(400)
    expect(started.body.error).toMatchObject({ code: 'RULE_BROKEN', message: 'This show has already started, so it cannot be cancelled.', details: { rule: 'BR-07', reason: 'started' } })
    expect((await Show.findById(show._id)).status).toBe('scheduled')

    await Show.updateOne({ _id: show._id }, { startAt: later(60) })
    expect((await owner.post(cancelPath(), { reason: REASON })).status).toBe(200)
    expect((await owner.post(cancelPath(), { reason: REASON })).body.error.details).toMatchObject({ rule: 'O-06', reason: 'already_cancelled' })
    expect(await AuditLog.countDocuments({ action: 'show.cancel' })).toBe(1)
  })

  it('two cancels at the same moment: one wins, one audit entry, one refund each', async () => {
    const [m] = await twoBookings()
    const results = await Promise.all([owner.post(cancelPath(), { reason: REASON }), admin.post(cancelPath('/api/admin'), { reason: REASON })])
    expect(results.map((x) => x.status).sort()).toEqual([200, 400])
    expect(await AuditLog.countDocuments({ action: 'show.cancel' })).toBe(1)
    await allSettled()
    expect((await Payment.findOne({ bookingId: m.id })).refunds).toHaveLength(1)
    expect(await Invoice.countDocuments({ type: 'credit_note' })).toBe(2)
  })
})

describe('O-06 cancel show (admin, flow 9.6)', () => {
  it('the admin can cancel any show; the audit log says admin', async () => {
    const [m] = await twoBookings()
    const preview = await admin.get(`/api/admin/shows/${show._id}/cancel-preview`)
    expect(preview.body).toEqual({ bookings: 2, refundPaise: 48000 })
    const res = await admin.post(cancelPath('/api/admin'), { reason: REASON })
    expect(res.status).toBe(200)
    expect(await AuditLog.findOne({ action: 'show.cancel' })).toMatchObject({ actorRole: 'admin' })
    await allSettled()
    expect((await Booking.findById(m.id)).cancellation.refundStatus).toBe('done')
  })
})

describe('JOB-04 cancellation refunds', () => {
  it('gateway down: E-05 says "on its way"; the next run refunds; no second email', async () => {
    const [m, r] = await twoBookings()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spy = vi.spyOn(gateway, 'refund').mockRejectedValue(new Error('gateway down'))
    await owner.post(cancelPath(), { reason: REASON })
    await vi.waitFor(async () => expect(await Booking.countDocuments({ 'cancellation.emailStatus': 'sent' })).toBe(2))
    expect(await Booking.countDocuments({ 'cancellation.refundStatus': 'pending' })).toBe(2)
    expect(mails('Talkies – show cancelled').find((x) => x.to === 'ravi@example.com').text).toContain('Your full refund of ₹150 (tickets, food and convenience fee) is on its way')
    expect(log).toHaveBeenCalledWith(expect.stringContaining('left pending: gateway down'))

    spy.mockRestore()
    await runCancellationsSoon()
    await processCancellations()
    for (const b of [m, r]) {
      expect((await Booking.findById(b.id)).cancellation.refundStatus).toBe('done')
      expect((await Payment.findOne({ bookingId: b.id })).refunds).toHaveLength(1)
    }
    expect(mails('Talkies – show cancelled')).toHaveLength(2)
    log.mockRestore()
  })

  it('also retries a U-20 refund that failed (no new email)', async () => {
    await Show.updateOne({ _id: show._id }, { startAt: later(300), endAt: later(480) }) // before the user cutoff (BR-04)
    const [m] = await twoBookings()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spy = vi.spyOn(gateway, 'refund').mockRejectedValueOnce(new Error('gateway down'))
    expect((await meena.post(`/api/bookings/${m.id}/cancel`)).body.booking.cancellation.refundStatus).toBe('pending')
    await vi.waitFor(() => expect(mails('Talkies – booking cancelled')).toHaveLength(1)) // E-04 (background)
    sendEmail.mockClear()

    expect(await processCancellations()).toEqual({ refunded: 1, failed: 0, emailed: 0 })
    const payment = await Payment.findOne({ bookingId: m.id })
    expect(payment).toMatchObject({ status: 'partially_refunded' })
    expect(payment.refunds).toEqual([expect.objectContaining({ amountPaise: 21250, reason: 'user_cancelled' })])
    expect(sendEmail).not.toHaveBeenCalled()
    spy.mockRestore()
    log.mockRestore()
  })

  it('two runs at the same moment: one credit note, one refund, one email per booking', async () => {
    await twoBookings()
    // Cancelled straight in the database, so only these two runs work on it
    const now = new Date()
    await Show.updateOne({ _id: show._id }, { status: 'cancelled' })
    for (const b of await Booking.find({ status: 'confirmed' })) {
      await Booking.updateOne({ _id: b._id }, { status: 'cancelled_by_theatre', cancellation: { at: now, reason: REASON, refundPaise: b.pricing.totalPaise, refundStatus: 'pending', emailStatus: 'pending' } })
    }
    await Promise.all([processCancellations(), processCancellations()])
    expect(await Invoice.countDocuments({ type: 'credit_note' })).toBe(2)
    expect((await Counter.findOne({ _id: /^credit_note/ })).seq).toBe(2) // no number used up by the run that lost
    for (const p of await Payment.find({ status: { $ne: 'failed' } })) expect(p.refunds).toHaveLength(1)
    await processCancellations() // the run that lost the refund claim sends the email next time
    expect(mails('Talkies – show cancelled')).toHaveLength(2)
  })
})

describe('O-06 while someone is paying', () => {
  it('the payment verify after the cancel refunds the money (show_cancelled)', async () => {
    const held = await hold(meena, ['A1'])
    const { orderId } = (await meena.post(`/api/bookings/${held.id}/payments`)).body
    const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
    await owner.post(cancelPath(), { reason: REASON })

    const res = await meena.post('/api/payments/verify', { orderId, ...paid })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({ message: 'Sorry, the theatre cancelled this show while you were paying. We refunded ₹150.', details: { rule: 'O-06', reason: 'show_cancelled' } })
    const payment = await Payment.findOne({ orderId })
    expect(payment.status).toBe('refunded')
    expect(payment.refunds).toEqual([expect.objectContaining({ amountPaise: 15000, reason: 'show_closed' })])
    expect((await Booking.findById(held.id)).status).toBe('released')
    expect((await Show.findById(show._id)).bookedCount).toBe(0)
  })
})
