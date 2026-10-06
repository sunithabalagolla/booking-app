import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { LIMITS, resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
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

// U-13 food + SF-06 pickup time: canteen menu and PUT /api/bookings/:id/food

const MIN = 60 * 1000
const S = (seatClass) => ({ type: 'seat', seatClass })
const built = buildLayout([{ cells: [S('second'), S('second'), S('second')] }])

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

let owner, theatre, otherTheatre, show, meena, ravi, popcorn, samosa, coffee, puff, otherItem, booking

async function makeTheatre(name, status = 'approved') {
  return Theatre.create({ ownerId: owner._id, name, cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status })
}
const food = (t, name, pricePaise, extra = {}) => FoodItem.create({ theatreId: t._id, ownerId: owner._id, name, pricePaise, isVeg: true, ...extra })
const putFood = (api, body, id = booking.id) => api.put(`/api/bookings/${id}/food`, body)
const line = (item, qty) => ({ foodItemId: String(item._id), qty })

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), FoodItem.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com' })
  await createUser({ email: 'ravi@example.com' })
  theatre = await makeTheatre('Chandni Talkies')
  otherTheatre = await makeTheatre('Roopa Talkies')
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
  popcorn = await food(theatre, 'Butter Popcorn', 15000, { photoUrl: '/api/uploads/files/p.svg' })
  samosa = await food(theatre, 'Samosa (2 pcs)', 6000)
  coffee = await food(theatre, 'Filter Coffee', 4000, { inStock: false })
  puff = await food(theatre, 'Chicken Puff', 7000, { isVeg: false, isCombo: true })
  otherItem = await food(otherTheatre, 'Masala Dosa', 9000)
  meena = as(await login('meena@example.com'))
  ravi = as(await login('ravi@example.com'))
  booking = (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A1', 'A2'] })).body.booking
})
afterAll(closeTestDB)

describe('GET /api/theatres/:id/food (U-13 canteen menu)', () => {
  it('guests see the menu: in-stock items first, then A to Z, with the most per item', async () => {
    const res = await request(app).get(`/api/theatres/${theatre._id}/food`)
    expect(res.status).toBe(200)
    expect(res.body.theatre).toEqual({ id: String(theatre._id), name: 'Chandni Talkies' })
    expect(res.body.maxQtyPerItem).toBe(10)
    expect(res.body.items.map((i) => i.name)).toEqual(['Butter Popcorn', 'Chicken Puff', 'Samosa (2 pcs)', 'Filter Coffee'])
    expect(res.body.items[0]).toEqual({ id: String(popcorn._id), theatreId: String(theatre._id), name: 'Butter Popcorn', photoUrl: '/api/uploads/files/p.svg', pricePaise: 15000, isVeg: true, inStock: true, isCombo: false })
    expect(res.body.items[1]).toMatchObject({ isVeg: false, isCombo: true, photoUrl: null })
    expect(res.body.items[3]).toMatchObject({ inStock: false })
  })

  it('an empty canteen is an empty list; unknown or not approved theatres are 404', async () => {
    const empty = await makeTheatre('Empty Talkies')
    expect((await request(app).get(`/api/theatres/${empty._id}/food`)).body.items).toEqual([])
    const pending = await makeTheatre('New Talkies', 'pending')
    await food(pending, 'Tea', 2000)
    expect((await request(app).get(`/api/theatres/${pending._id}/food`)).status).toBe(404)
    expect((await request(app).get(`/api/theatres/${owner._id}/food`)).status).toBe(404)
    expect((await request(app).get('/api/theatres/not-an-id/food')).status).toBe(400)
  })
})

describe('PUT /api/bookings/:id/food (U-13, SF-06)', () => {
  it('saves the food with names and prices from the database; GET sends it back', async () => {
    const res = await putFood(meena, { items: [line(popcorn, 2), line(puff, 1)], pickup: 'interval', pricePaise: 1 })
    expect(res.status).toBe(200)
    expect(res.body.booking).toMatchObject({
      status: 'pending',
      food: [
        { foodItemId: String(popcorn._id), name: 'Butter Popcorn', isVeg: true, unitPricePaise: 15000, qty: 2 },
        { foodItemId: String(puff._id), name: 'Chicken Puff', isVeg: false, unitPricePaise: 7000, qty: 1 },
      ],
      foodPickup: 'interval',
      pricing: { ticketsPaise: 24000, foodPaise: 37000 },
    })
    const again = await meena.get(`/api/bookings/${booking.id}`)
    expect(again.body.booking.food).toHaveLength(2)
    expect(again.body.booking.foodPickup).toBe('interval')

    // The booking keeps its copy when the menu changes later
    await FoodItem.updateOne({ _id: popcorn._id }, { pricePaise: 99900, name: 'Cheese Popcorn' })
    expect((await meena.get(`/api/bookings/${booking.id}`)).body.booking.food[0]).toMatchObject({ name: 'Butter Popcorn', unitPricePaise: 15000 })
  })

  it('replaces the whole list; an empty list = no food and no pickup', async () => {
    await putFood(meena, { items: [line(popcorn, 2)], pickup: 'before_movie' })
    const changed = await putFood(meena, { items: [line(samosa, 3)], pickup: 'before_movie' })
    expect(changed.body.booking.food.map((f) => [f.name, f.qty])).toEqual([['Samosa (2 pcs)', 3]])
    expect(changed.body.booking.pricing.foodPaise).toBe(18000)

    const none = await putFood(meena, { items: [], pickup: 'interval' })
    expect(none.status).toBe(200)
    expect(none.body.booking).toMatchObject({ food: [], foodPickup: null, pricing: { foodPaise: 0 } })
    expect((await putFood(meena, { items: [] })).status).toBe(200)
  })

  it('refuses: sold out, another theatre, deleted item, no pickup, bad counts, twice in the list', async () => {
    const soldOut = await putFood(meena, { items: [line(popcorn, 1), line(coffee, 1)], pickup: 'interval' })
    expect(soldOut.status).toBe(400)
    expect(soldOut.body.error).toMatchObject({ code: 'RULE_BROKEN', message: 'Filter Coffee is sold out now.', details: { reason: 'sold_out', foodItemIds: [String(coffee._id)] } })

    const elsewhere = await putFood(meena, { items: [line(otherItem, 1)], pickup: 'interval' })
    expect(elsewhere.status).toBe(400)
    expect(elsewhere.body.error.details.foodItemIds).toEqual([String(otherItem._id)])
    await FoodItem.deleteOne({ _id: samosa._id })
    expect((await putFood(meena, { items: [line(samosa, 1)], pickup: 'interval' })).status).toBe(400)

    expect((await putFood(meena, { items: [line(popcorn, 1)] })).status).toBe(400) // pickup needed with food
    expect((await putFood(meena, { items: [line(popcorn, 1)], pickup: 'after_movie' })).status).toBe(400)
    for (const qty of [0, 11, 1.5, '2']) expect((await putFood(meena, { items: [line(popcorn, qty)], pickup: 'interval' })).status).toBe(400)
    expect((await putFood(meena, { items: [line(popcorn, 1), line(popcorn, 2)], pickup: 'interval' })).status).toBe(400)
    expect((await putFood(meena, { pickup: 'interval' })).status).toBe(400)

    // Nothing was saved
    expect((await Booking.findById(booking.id)).food).toEqual([])
  })

  it('10 of one item is fine (most per item)', async () => {
    const res = await putFood(meena, { items: [line(samosa, 10)], pickup: 'before_movie' })
    expect(res.status).toBe(200)
    expect(res.body.booking.pricing.foodPaise).toBe(60000)
  })

  it('only while the hold runs: after the time is over or Give up → 400, booking released', async () => {
    const past = new Date(Date.now() - 1000)
    await Booking.updateOne({ _id: booking.id }, { holdExpiresAt: past })
    await ShowSeat.updateMany({ bookingId: booking.id }, { expiresAt: past })
    const late = await putFood(meena, { items: [line(popcorn, 1)], pickup: 'interval' })
    expect(late.status).toBe(400)
    expect(late.body.error).toMatchObject({ code: 'RULE_BROKEN', details: { reason: 'hold_over' } })
    expect(await Booking.findById(booking.id)).toMatchObject({ status: 'released', food: [] })

    // Give up seats first, then food → refused too
    const next = (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A3'] })).body.booking
    expect((await meena.delete(`/api/bookings/${next.id}/hold`)).status).toBe(200)
    expect((await putFood(meena, { items: [] }, next.id)).body.error.details.reason).toBe('hold_over')
  })

  it("someone else's booking looks missing; owners and guests cannot use it", async () => {
    expect((await putFood(ravi, { items: [line(popcorn, 1)], pickup: 'interval' })).status).toBe(404)
    expect((await request(app).put(`/api/bookings/${booking.id}/food`).send({ items: [] })).status).toBe(401)
    const ownerApi = as(await login('owner@example.com'))
    expect((await putFood(ownerApi, { items: [] })).status).toBe(403)
  })
})

describe('rate limit: seat hold + food together, per user (api.md 1.7)', () => {
  it(`allows ${LIMITS.booking.limit} in 10 minutes, then 429; another user is not affected`, async () => {
    resetRateLimits()
    for (let i = 0; i < LIMITS.booking.limit; i++) expect((await putFood(meena, { items: [] })).status).toBe(200)
    const blocked = await putFood(meena, { items: [] })
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('RATE_LIMITED')
    expect((await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A3'] })).status).toBe(429)
    expect((await ravi.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A3'] })).status).toBe(201)
  })
})
