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
import { sendEmail } from '../src/services/email/index.js'
import { financialYear, invoiceNumber } from '../src/services/invoice.js'
import { qrToken, verifyQrToken } from '../src/services/qr/index.js'
import { istDateTime, ticketDetails } from '../src/services/ticketText.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-17 ticket: signed QR (SEC-09), GST invoice (11.3) in the confirm transaction,
// ticket + invoice PDFs, E-03 email with the QR picture and both PDFs.

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second')] }])

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
// Binary answers (PDF) are collected into a Buffer
const binary = (res, done) => {
  const chunks = []
  res.on('data', (c) => chunks.push(c))
  res.on('end', () => done(null, Buffer.concat(chunks)))
}
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  pdf: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`).buffer(true).parse(binary),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
})

let owner, theatre, show, meena, ravi
const hold = async (seatIds = ['A1', 'A2']) => (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds })).body.booking
async function payFor(booking) {
  const { orderId } = (await meena.post(`/api/bookings/${booking.id}/payments`)).body
  const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  return { orderId, ...paid }
}
const verify = (body) => meena.post('/api/payments/verify', body)
const bookAndPay = async (seatIds) => (await verify(await payFor(await hold(seatIds)))).body.booking

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init(), Payment.init(), Invoice.init(), Counter.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockReset()
  sendEmail.mockResolvedValue()
  await createTestSettings({ platform: { companyName: 'Talkies Sample Pvt Ltd (TEST)', gstin: '36AAACT0000A1Z1', address: '1 Film Nagar, Hyderabad' } })
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

describe('signed QR token (SEC-09)', () => {
  const booking = { _id: '65f0c0ffee0000000000abcd', qrNonce: 'a1b2c3d4e5f60718293a4b5c6d7e8f90' }

  it('a token made by the server is accepted and gives the booking ID + nonce', () => {
    expect(verifyQrToken(qrToken(booking))).toEqual({ bookingId: booking._id, nonce: booking.qrNonce })
  })

  it('a changed booking ID, nonce or signature, a token from another secret, or junk → null', () => {
    const [id, nonce, sig] = qrToken(booking).split('.')
    expect(verifyQrToken(`65f0c0ffee0000000000abce.${nonce}.${sig}`)).toBeNull()
    expect(verifyQrToken(`${id}.ffffffffffffffffffffffffffffffff.${sig}`)).toBeNull()
    expect(verifyQrToken(`${id}.${nonce}.${sig.slice(0, -2)}xx`)).toBeNull()
    const secret = process.env.QR_SECRET
    process.env.QR_SECRET = 'another-secret-that-is-at-least-32-characters'
    const foreign = qrToken(booking)
    process.env.QR_SECRET = secret
    expect(verifyQrToken(foreign)).toBeNull()
    for (const junk of ['', null, 'TK7F3K9QXM', 'a.b.c', `${id}.${nonce}`, `${id}..${sig}`]) expect(verifyQrToken(junk)).toBeNull()
  })

  it('the QR secret must be set and long enough', async () => {
    const { getQrSecret } = await import('../src/services/qr/index.js')
    const secret = process.env.QR_SECRET
    process.env.QR_SECRET = 'short'
    expect(() => getQrSecret()).toThrow(/QR_SECRET/)
    process.env.QR_SECRET = secret
  })
})

describe('invoice numbers (11.3)', () => {
  it('financial year 1 April … 31 March in IST', () => {
    expect(financialYear(new Date('2027-03-31T18:29:59Z'))).toBe('2026-27') // 31 Mar 23:59:59 IST
    expect(financialYear(new Date('2027-03-31T18:30:00Z'))).toBe('2027-28') // 1 Apr 00:00 IST
    expect(financialYear(new Date('2026-10-07T10:00:00Z'))).toBe('2026-27')
    expect(financialYear(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00')
  })

  it('INV/2026-27/000123', () => {
    expect(invoiceNumber('INV', '2026-27', 123)).toBe('INV/2026-27/000123')
    expect(invoiceNumber('CN', '2026-27', 1)).toBe('CN/2026-27/000001')
  })
})

describe('ticket text (IST)', () => {
  it('date and time in IST, seats in order, food + pickup, total', () => {
    expect(istDateTime(new Date('2026-10-07T16:15:00Z'))).toEqual({ day: 'Wed 7 Oct 2026', time: '9:45 PM' })
    expect(istDateTime(new Date('2026-10-07T18:30:00Z'))).toEqual({ day: 'Thu 8 Oct 2026', time: '12:00 AM' })
    const t = ticketDetails({
      bookingNumber: 'TK7F3K9QXM',
      show: { movieTitle: 'Kadal Kaatru', certificate: 'U', language: 'Tamil', format: '2D', label: 'second', startAt: new Date('2026-10-07T16:15:00Z'), theatreName: 'Chandni', theatreAddress: 'Road', screenName: 'Screen 1' },
      seats: [
        { seatId: 'B10', seatClass: 'second' },
        { seatId: 'B2', seatClass: 'second' },
        { seatId: 'A1', seatClass: 'balcony' },
      ],
      food: [{ name: 'Tea', qty: 2 }],
      foodPickup: 'interval',
      pricing: { totalPaise: 56050 },
    })
    expect(t).toMatchObject({ admit: 3, movieInfo: 'U · Tamil · 2D', showText: 'Second show · Wed 7 Oct 2026, 9:45 PM', classText: 'Balcony, Second class', seatsText: 'A1, B2, B10', foodText: '2 × Tea', pickupText: 'Interval', totalText: '₹560.50' })
  })
})

describe('confirm makes the GST invoice (11.3)', () => {
  it('lines, totals, seller, platform and buyer from the booking; total = amount paid', async () => {
    const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
    await Coupon.create({ code: 'TEN', discountType: 'flat', value: 1000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: owner._id })
    const held = await hold()
    await meena.put(`/api/bookings/${held.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 2 }], pickup: 'interval' })
    await meena.put(`/api/bookings/${held.id}/coupon`, { code: 'TEN' })
    const paid = await payFor(held)
    const res = await verify(paid)
    expect(res.status).toBe(200)

    const invoice = await Invoice.findOne({ bookingId: held.id })
    const fy = financialYear(new Date())
    expect(res.body.booking.invoiceId).toBe(String(invoice._id))
    expect(invoice).toMatchObject({
      type: 'invoice',
      number: `INV/${fy}/000001`,
      financialYear: fy,
      bookingNumber: held.bookingNumber,
      seller: { theatreName: 'Chandni Talkies', address: '12 Station Road', gstin: '36AABCS1234A1Z5', state: 'Telangana' }, // from the GSTIN (no cities in test settings)
      platform: { companyName: 'Talkies Sample Pvt Ltd (TEST)', gstin: '36AAACT0000A1Z1' },
      buyer: { name: 'Meena Iyer', email: 'meena@example.com' },
    })
    expect(String(invoice.ownerId)).toBe(String(owner._id))
    // 2 × ₹120 − ₹10 coupon = ₹230 · 2 × Tea ₹40 · fee 2 × ₹30 = ₹60 → ₹330
    expect(invoice.lines.map((l) => [l.kind, l.description, l.hsnSac, l.qty, l.gstPercent, l.totalPaise])).toEqual([
      ['ticket', 'Movie ticket: 2 × Second class', 'TEST-TICKET', 2, 18, 23000],
      ['food', 'Food: 2 × Tea', 'TEST-FOOD', 2, 5, 4000],
      ['convenience_fee', 'Convenience fee (2 tickets)', 'TEST-FEE', 2, 18, 6000],
    ])
    for (const l of invoice.lines) expect(l.taxablePaise + l.cgstPaise + l.sgstPaise).toBe(l.totalPaise)
    const payment = await Payment.findOne({ orderId: paid.orderId })
    expect(invoice.totals.totalPaise).toBe(payment.amountPaise)
    expect(invoice.totals.totalPaise).toBe(33000)
    expect(invoice.totals.taxablePaise + invoice.totals.cgstPaise + invoice.totals.sgstPaise).toBe(33000)
  })

  it('numbers go up one by one; a confirm that fails uses no number; verify twice = one invoice', async () => {
    const first = await bookAndPay(['A1'])
    // Hold over during payment: no invoice, no number used
    const late = await hold(['A2'])
    const paid = await payFor(late)
    await Booking.updateOne({ _id: late.id }, { holdExpiresAt: new Date(Date.now() - 1000) })
    await ShowSeat.updateMany({ bookingId: late.id }, { expiresAt: new Date(Date.now() - 1000) })
    expect((await verify(paid)).status).toBe(409)
    expect(await Invoice.countDocuments({ bookingId: late.id })).toBe(0)

    const third = await hold(['A3'])
    const paidThird = await payFor(third)
    await verify(paidThird)
    expect((await verify(paidThird)).status).toBe(200) // again = fine
    const fy = financialYear(new Date())
    expect((await Invoice.find().sort({ number: 1 })).map((i) => [String(i.bookingId), i.number])).toEqual([
      [first.id, `INV/${fy}/000001`],
      [third.id, `INV/${fy}/000002`],
    ])
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(2)) // one E-03 per booking
  })
})

describe('GET /api/bookings/:id (U-17)', () => {
  it('a confirmed booking has the QR picture + invoice ID; a hold has neither', async () => {
    const held = await hold(['A1'])
    const pending = (await meena.get(`/api/bookings/${held.id}`)).body.booking
    expect(pending.qrDataUrl).toBeUndefined()
    expect(pending.invoiceId).toBeNull()
    await verify(await payFor(held))
    const confirmed = (await meena.get(`/api/bookings/${held.id}`)).body.booking
    expect(confirmed.qrDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(confirmed.invoiceId).toMatch(/^[0-9a-f]{24}$/)
    expect(confirmed.confirmedAt).toBeTruthy()
  })
})

describe('PDF downloads', () => {
  it('ticket PDF: own confirmed booking → PDF; a hold → 400; someone else → 404; guest → 401', async () => {
    const booking = await bookAndPay(['A1'])
    const res = await meena.pdf(`/api/bookings/${booking.id}/ticket.pdf`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toBe(`attachment; filename="Talkies-ticket-${booking.bookingNumber}.pdf"`)
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-')
    expect(res.body.length).toBeGreaterThan(5000)

    const held = await hold(['A2'])
    expect((await meena.get(`/api/bookings/${held.id}/ticket.pdf`)).body.error.details.reason).toBe('not_confirmed')
    expect((await ravi.get(`/api/bookings/${booking.id}/ticket.pdf`)).status).toBe(404)
    expect((await request(app).get(`/api/bookings/${booking.id}/ticket.pdf`)).status).toBe(401)
  })

  it('invoice PDF: the buyer, the theatre owner and admin; others 404; staff 403', async () => {
    const booking = await bookAndPay(['A1'])
    const path = `/api/invoices/${booking.invoiceId}/pdf`
    await createUser({ email: 'other.owner@example.com', role: 'owner', phone: '9400000002', owner: { businessName: 'C', approvalStatus: 'approved' } })
    await createUser({ email: 'admin@example.com', role: 'admin' })
    await createUser({ email: 'staff@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [theatre._id] } })

    const mine = await meena.pdf(path)
    expect(mine.status).toBe(200)
    expect(mine.headers['content-disposition']).toMatch(/filename="Talkies-invoice-INV-\d{4}-\d{2}-000001\.pdf"/)
    expect(mine.body.subarray(0, 5).toString()).toBe('%PDF-')
    expect((await as(await login('owner@example.com')).pdf(path)).status).toBe(200)
    expect((await as(await login('admin@example.com')).pdf(path)).status).toBe(200)
    expect((await ravi.get(path)).status).toBe(404)
    expect((await as(await login('other.owner@example.com')).get(path)).status).toBe(404)
    expect((await as(await login('staff@example.com')).get(path)).status).toBe(403)
    expect((await meena.get('/api/invoices/65f0c0ffee0000000000abcd/pdf')).status).toBe(404)
  })

  it('a long invoice (10 food items) still makes a PDF', async () => {
    const items = await FoodItem.create(Array.from({ length: 10 }, (_, i) => ({ theatreId: theatre._id, ownerId: owner._id, name: `Snack number ${i + 1} with a rather long name`, pricePaise: 5000 + i * 100, isVeg: i % 2 === 0 })))
    const held = await hold(['A1'])
    await meena.put(`/api/bookings/${held.id}/food`, { items: items.map((f) => ({ foodItemId: String(f._id), qty: 2 })), pickup: 'before_movie' })
    const booking = (await verify(await payFor(held))).body.booking
    const res = await meena.pdf(`/api/invoices/${booking.invoiceId}/pdf`)
    expect(res.status).toBe(200)
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('E-03 booking confirmed email', () => {
  it('to the buyer: ticket details, the QR picture inside, ticket + invoice PDFs attached', async () => {
    const booking = await bookAndPay(['A1', 'A2'])
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(1))
    const mail = sendEmail.mock.calls[0][0]
    const invoice = await Invoice.findById(booking.invoiceId)
    expect(mail.to).toBe('meena@example.com')
    expect(mail.subject).toBe(`Talkies – booking confirmed: Kadal Kaatru (${booking.bookingNumber})`)
    expect(mail.text).toContain('Seats: A1, A2')
    expect(mail.text).toContain('Total paid: ₹300')
    expect(mail.text).toContain(`http://localhost:5173/bookings/${booking.id}`)
    expect(mail.text).toContain(invoice.number)
    const [qr, ticket, invoiceFile] = mail.attachments
    expect(qr).toMatchObject({ name: `${booking.bookingNumber}-qr.png`, contentType: 'image/png', contentId: `qr-${booking.bookingNumber}` })
    expect(qr.content.subarray(1, 4).toString()).toBe('PNG')
    expect(mail.html).toContain(`src="cid:qr-${booking.bookingNumber}"`)
    expect(ticket).toMatchObject({ name: `Talkies-ticket-${booking.bookingNumber}.pdf`, contentType: 'application/pdf' })
    expect(invoiceFile).toMatchObject({ name: `Talkies-invoice-${invoice.number.replaceAll('/', '-')}.pdf`, contentType: 'application/pdf' })
    for (const pdf of [ticket, invoiceFile]) expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('names in the email are HTML-escaped', async () => {
    await User.updateOne({ email: 'meena@example.com' }, { name: '<b>Meena</b>' })
    await bookAndPay(['A1'])
    await vi.waitFor(() => expect(sendEmail).toHaveBeenCalledTimes(1))
    expect(sendEmail.mock.calls[0][0].html).toContain('&lt;b&gt;Meena&lt;/b&gt;')
  })

  it('the email fails → the booking stays confirmed and the error is logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendEmail.mockRejectedValue(new Error('Postmark is down'))
    const booking = await bookAndPay(['A1'])
    expect(booking.status).toBe('confirmed')
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith(`[email] E-03 for booking ${booking.bookingNumber} failed: Postmark is down`))
    expect((await Booking.findById(booking.id)).status).toBe('confirmed')
    log.mockRestore()
  })
})
