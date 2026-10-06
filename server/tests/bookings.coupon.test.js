import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
import { Coupon } from '../src/models/Coupon.js'
import { CouponUsage } from '../src/models/CouponUsage.js'
import { FoodItem } from '../src/models/FoodItem.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { ShowSeat } from '../src/models/ShowSeat.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// U-14 summary prices in the booking + U-15 coupon (BR-16) + deal fixed at hold time

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('balcony'), S('balcony')] }, { cells: [S('second'), S('second'), S('second')] }])

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

let owner, admin, theatre, show, meena, ravi
const holdAs = async (api, seatIds, s = show) => (await api.post('/api/bookings/hold', { showId: String(s._id), seatIds })).body.booking
const couponFor = (booking, code, api = meena) => api.put(`/api/bookings/${booking.id}/coupon`, { code })
const makeCoupon = (fields) =>
  Coupon.create({ discountType: 'percent', value: 20, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + DAY), createdBy: admin._id, ...fields })

async function makeShow(extra = {}) {
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: owner._id, name: `Screen ${Math.random()}`, format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
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
    totalSeats: 5,
    ...extra,
  })
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init(), Coupon.init(), CouponUsage.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  admin = await createUser({ email: 'admin@example.com', role: 'admin', phone: '9400000002' })
  await createUser({ email: 'meena@example.com' })
  await createUser({ email: 'ravi@example.com' })
  theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  show = await makeShow()
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

describe('U-14 prices in every booking answer', () => {
  it('hold: ticket lines per class, fee per ticket, GST lines, total; the rates stay inside', async () => {
    const booking = await holdAs(meena, ['B1', 'A1', 'A2'])
    expect(booking.pricing).toMatchObject({ ticketsPaise: 49000, foodPaise: 0, ticketDiscountPaise: 0, discountType: null, convenienceFeePaise: 9000, totalPaise: 58000 })
    expect(booking.pricing.gstLines.map((l) => [l.description, l.amountPaise, l.gstPercent])).toEqual([
      ['1 × Balcony', 25000, 18],
      ['2 × Second class', 24000, 18],
      ['Convenience fee', 9000, 18],
    ])
    expect(booking.pricing.rates).toBeUndefined()
    const saved = await Booking.findById(booking.id)
    expect(saved.pricing.rates).toMatchObject({ gst: { ticketPercent: 18, foodPercent: 5 }, convenienceFeePaise: 3000, commissionPercent: 10 })
  })

  it('food changes the total; the rates of hold time stay (a settings change later does not count)', async () => {
    const booking = await holdAs(meena, ['A1'])
    await Settings.updateOne({}, { 'gst.foodPercent': 12, convenienceFeePaise: 5000 })
    const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2100, isVeg: true })
    const res = await meena.put(`/api/bookings/${booking.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 2 }], pickup: 'interval' })
    expect(res.body.booking.pricing).toMatchObject({ foodPaise: 4200, convenienceFeePaise: 3000, totalPaise: 12000 + 4200 + 3000 })
    expect(res.body.booking.pricing.gstLines[1]).toMatchObject({ kind: 'food', description: '2 × Tea', gstPercent: 5, taxablePaise: 4000, cgstPaise: 100, sgstPaise: 100 })
  })

  it('no GST rates in settings → 503 PRICES_NOT_READY, nothing held', async () => {
    await Settings.updateOne({}, { 'gst.ticketPercent': null })
    const res = await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A1'] })
    expect(res.status).toBe(503)
    expect(res.body.error).toMatchObject({ code: 'PRICES_NOT_READY', message: 'Prices are not ready yet. Please try again later.' })
    expect(await ShowSeat.countDocuments()).toBe(0)
  })

  it('a deal that is on at hold time stays for the hold, even when it is switched off later', async () => {
    const dealShow = await makeShow({ deal: { enabled: true, active: true, percent: 20 } })
    const booking = await holdAs(meena, ['A1', 'A2'], dealShow)
    expect(booking.pricing).toMatchObject({ ticketsPaise: 24000, ticketDiscountPaise: 4800, discountType: 'deal', dealPercent: 20, totalPaise: 24000 - 4800 + 6000 })
    await Show.updateOne({ _id: dealShow._id }, { 'deal.active': false })
    expect((await meena.get(`/api/bookings/${booking.id}`)).body.booking.pricing.ticketDiscountPaise).toBe(4800)
  })
})

describe('PUT / DELETE /api/bookings/:id/coupon (U-15)', () => {
  it('applies a percent coupon (any case), capped at its max; tickets only; removing gives the old price', async () => {
    await makeCoupon({ code: 'TALKIES20', maxDiscountPaise: 5000 })
    const booking = await holdAs(meena, ['B1', 'B2']) // 50000 → 20% = 10000, capped at 5000
    const res = await couponFor(booking, '  talkies20 ')
    expect(res.status).toBe(200)
    expect(res.body.booking.pricing).toMatchObject({ ticketDiscountPaise: 5000, discountType: 'coupon', couponCode: 'TALKIES20', convenienceFeePaise: 6000, totalPaise: 50000 - 5000 + 6000 })
    expect(res.body.booking.pricing.gstLines[0]).toMatchObject({ discountPaise: 5000, amountPaise: 45000 })

    const removed = await meena.delete(`/api/bookings/${booking.id}/coupon`)
    expect(removed.body.booking.pricing).toMatchObject({ ticketDiscountPaise: 0, discountType: null, couponCode: null, totalPaise: 56000 })
    expect((await Booking.findById(booking.id)).couponCode).toBeUndefined()
    expect((await meena.delete(`/api/bookings/${booking.id}/coupon`)).status).toBe(200) // again = fine
  })

  it('a flat coupon is never more than the tickets; a new coupon replaces the old one', async () => {
    await makeCoupon({ code: 'BIG', discountType: 'flat', value: 50000 })
    await makeCoupon({ code: 'SMALL', discountType: 'flat', value: 1000 })
    const booking = await holdAs(meena, ['A1'])
    expect((await couponFor(booking, 'BIG')).body.booking.pricing).toMatchObject({ ticketDiscountPaise: 12000, totalPaise: 3000 })
    expect((await couponFor(booking, 'SMALL')).body.booking.pricing).toMatchObject({ ticketDiscountPaise: 1000, couponCode: 'SMALL', totalPaise: 14000 })
  })

  it('food changes keep the coupon', async () => {
    await makeCoupon({ code: 'TEN', discountType: 'flat', value: 1000 })
    const tea = await FoodItem.create({ theatreId: theatre._id, ownerId: owner._id, name: 'Tea', pricePaise: 2000, isVeg: true })
    const booking = await holdAs(meena, ['A1'])
    await couponFor(booking, 'TEN')
    const res = await meena.put(`/api/bookings/${booking.id}/food`, { items: [{ foodItemId: String(tea._id), qty: 1 }], pickup: 'interval' })
    expect(res.body.booking.pricing).toMatchObject({ couponCode: 'TEN', ticketDiscountPaise: 1000, foodPaise: 2000, totalPaise: 12000 - 1000 + 2000 + 3000 })
  })

  it('refuses with a reason: not found, not started, ended, used up, own limit, min amount, city, theatre, with a deal', async () => {
    const otherTheatre = await Theatre.create({ ownerId: owner._id, name: 'Roopa', cityCode: 'hyderabad', address: '1 Road', gstin: '36AABCS1234A1Z6', status: 'approved' })
    await makeCoupon({ code: 'SOON', startAt: new Date(Date.now() + DAY), endAt: new Date(Date.now() + 2 * DAY) })
    await makeCoupon({ code: 'OLD', startAt: new Date(Date.now() - 2 * DAY), endAt: new Date(Date.now() - DAY) })
    await makeCoupon({ code: 'GONE', totalLimit: 5, usedCount: 5 })
    const once = await makeCoupon({ code: 'ONCE', perUserLimit: 1 })
    await makeCoupon({ code: 'BIGBUY', minAmountPaise: 20000 })
    await makeCoupon({ code: 'CHENNAI', cityCodes: ['chennai'] })
    await makeCoupon({ code: 'ROOPA', theatreIds: [otherTheatre._id] })
    await CouponUsage.create({ couponId: once._id, userId: (await User.findOne({ email: 'meena@example.com' }))._id, bookingId: once._id })

    const booking = await holdAs(meena, ['A1']) // tickets ₹120
    const expectReason = async (code, reason, message) => {
      const res = await couponFor(booking, code)
      expect(res.status).toBe(400)
      expect(res.body.error).toMatchObject({ code: 'COUPON_INVALID', details: { reason } })
      if (message) expect(res.body.error.message).toBe(message)
    }
    await expectReason('NOPE', 'not_found', 'We could not find this coupon code.')
    await expectReason('SOON', 'not_started', 'This coupon is not active yet.')
    await expectReason('OLD', 'expired', 'This coupon has ended.')
    await expectReason('GONE', 'used_up', 'This coupon has been fully used.')
    await expectReason('ONCE', 'user_limit', 'You have already used this coupon.')
    await expectReason('BIGBUY', 'min_amount', 'This coupon needs tickets worth at least ₹200.')
    await expectReason('CHENNAI', 'wrong_city', 'This coupon does not work in this city.')
    await expectReason('ROOPA', 'wrong_theatre', 'This coupon does not work at this theatre.')
    expect((await Booking.findById(booking.id)).pricing.ticketDiscountPaise).toBe(0) // nothing applied

    // Ravi has not used ONCE yet
    expect((await couponFor(await holdAs(ravi, ['A2']), 'ONCE', ravi)).status).toBe(200)

    // BR-16: not with a last-minute deal
    const dealShow = await makeShow({ deal: { enabled: true, active: true, percent: 10 } })
    const dealBooking = await holdAs(meena, ['A1'], dealShow)
    const withDeal = await couponFor(dealBooking, 'ONCE')
    expect(withDeal.body.error.details.reason).toBe('with_deal')
    expect((await meena.delete(`/api/bookings/${dealBooking.id}/coupon`)).body.booking.pricing.discountType).toBe('deal') // the deal stays
  })

  it('only while the hold runs; someone else’s booking is 404; bad input is 400', async () => {
    await makeCoupon({ code: 'TALKIES20' })
    const booking = await holdAs(meena, ['A1'])
    expect((await couponFor(booking, 'TALKIES20', ravi)).status).toBe(404)
    expect((await couponFor(booking, '   ')).status).toBe(400)
    expect((await meena.put(`/api/bookings/${booking.id}/coupon`, {})).status).toBe(400)

    await meena.delete(`/api/bookings/${booking.id}/hold`)
    const late = await couponFor(booking, 'TALKIES20')
    expect(late.status).toBe(400)
    expect(late.body.error.details.reason).toBe('hold_over')
    expect((await meena.delete(`/api/bookings/${booking.id}/coupon`)).body.error.details.reason).toBe('hold_over')
  })
})

describe('GET /api/bookings/:id/offers (U-15 Available offers)', () => {
  const offersOf = async (booking, api = meena) => (await api.get(`/api/bookings/${booking.id}/offers`)).body.offers

  it('only public coupons that work for this booking; biggest saving first; the applied one is marked', async () => {
    await makeCoupon({ code: 'BIG20', value: 20, isPublic: true }) // 20% of ₹500 = ₹100
    await makeCoupon({ code: 'FLAT30', discountType: 'flat', value: 3000, isPublic: true, maxDiscountPaise: null })
    await makeCoupon({ code: 'SECRET', value: 50 }) // not public
    await makeCoupon({ code: 'BIGBUY', value: 10, minAmountPaise: 99900, isPublic: true }) // needs ₹999 of tickets
    await makeCoupon({ code: 'CHENNAI', value: 10, cityCodes: ['chennai'], isPublic: true })
    await makeCoupon({ code: 'OLD', startAt: new Date(Date.now() - 2 * DAY), endAt: new Date(Date.now() - DAY), isPublic: true })
    await makeCoupon({ code: 'GONE', totalLimit: 1, usedCount: 1, isPublic: true })

    const booking = await holdAs(meena, ['B1', 'B2']) // ₹500 of tickets
    const offers = await offersOf(booking)
    expect(offers).toEqual([
      { code: 'BIG20', discountType: 'percent', value: 20, maxDiscountPaise: null, minAmountPaise: null, endAt: expect.any(String), savingPaise: 10000, applied: false },
      { code: 'FLAT30', discountType: 'flat', value: 3000, maxDiscountPaise: null, minAmountPaise: null, endAt: expect.any(String), savingPaise: 3000, applied: false },
    ])

    await couponFor(booking, 'FLAT30')
    expect((await offersOf(booking)).map((o) => [o.code, o.applied])).toEqual([
      ['BIG20', false],
      ['FLAT30', true],
    ])
  })

  it('a used once-per-user coupon is not offered to that user any more', async () => {
    const once = await makeCoupon({ code: 'ONCE', perUserLimit: 1, isPublic: true })
    const booking = await holdAs(meena, ['A1'])
    await CouponUsage.create({ couponId: once._id, userId: (await User.findOne({ email: 'meena@example.com' }))._id, bookingId: once._id })
    expect(await offersOf(booking)).toEqual([])
  })

  it('deal show → no offers (BR-16); only own bookings; hold over → 400', async () => {
    await makeCoupon({ code: 'BIG20', isPublic: true })
    const dealShow = await makeShow({ deal: { enabled: true, active: true, percent: 10 } })
    expect(await offersOf(await holdAs(meena, ['A1'], dealShow))).toEqual([])

    const booking = await holdAs(meena, ['A2'])
    expect((await ravi.get(`/api/bookings/${booking.id}/offers`)).status).toBe(404)
    await meena.delete(`/api/bookings/${booking.id}/hold`)
    expect((await meena.get(`/api/bookings/${booking.id}/offers`)).body.error.details.reason).toBe('hold_over')
  })
})
