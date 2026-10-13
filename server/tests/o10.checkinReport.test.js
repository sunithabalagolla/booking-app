import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { gateState } from '../src/controllers/ownerCheckins.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { Booking } from '../src/models/Booking.js'
import { Movie } from '../src/models/Movie.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Show } from '../src/models/Show.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { dateToIstDay, istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-10 check-in report: per show of one IST day, tickets booked vs came (Entered).

const MIN = 60 * 1000
const DAY = '2026-03-10' // a fixed past IST day: every show on it is over
const at = (day, hhmm) => new Date(istDayToDate(day).getTime() + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * MIN)
const built = buildLayout([{ cells: Array.from({ length: 8 }, () => ({ type: 'seat', seatClass: 'second' })) }])

const loginToken = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const getAs = (token, query = '') => request(app).get(`/api/owner/checkin-report${query}`).set('Authorization', `Bearer ${token}`)

let ownerUser, otherOwnerUser, meenaUser, chandni, sagar, foreign, movie, ownerToken
let bookingNo = 0

async function makeShow(theatre, startAt, fields = {}) {
  const screen = await Screen.create({ theatreId: theatre._id, ownerId: theatre.ownerId, name: `Screen ${startAt.getTime()}`, format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  return Show.create({ movieId: movie._id, theatreId: theatre._id, screenId: screen._id, ownerId: theatre.ownerId, cityCode: 'hyderabad', startAt, endAt: new Date(startAt.getTime() + 150 * MIN), label: 'first', language: 'Tamil', format: '2D', prices: [{ seatClass: 'second', pricePaise: 12000 }], layout: built.layout, totalSeats: 8, ...fields })
}

// A booking with `seats` seats; scanned = checkIn.usedAt set (S-04)
function makeBooking(show, seats, { status = 'confirmed', scanned = false } = {}) {
  bookingNo += 1
  return Booking.create({
    bookingNumber: `TK${String(bookingNo).padStart(8, 'A')}`,
    userId: meenaUser._id,
    showId: show._id,
    movieId: show.movieId,
    theatreId: show.theatreId,
    screenId: show.screenId,
    ownerId: show.ownerId,
    cityCode: 'hyderabad',
    status,
    show: { movieTitle: 'Kadal Kaatru', certificate: 'U', theatreName: 'T', theatreAddress: 'A', screenName: 'S', startAt: show.startAt, endAt: show.endAt, label: show.label, language: 'Tamil', format: '2D' },
    seats: Array.from({ length: seats }, (_, i) => ({ seatId: `A${bookingNo}-${i}`, seatClass: 'second', className: 'Second class', pricePaise: 12000 })),
    pricing: { ticketsPaise: seats * 12000 },
    qrNonce: `nonce${bookingNo}`,
    ...(scanned && { checkIn: { usedAt: new Date(show.startAt.getTime() - 5 * MIN), staffId: ownerUser._id } }),
  })
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), Booking.init(), Settings.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createTestSettings()
  ownerUser = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  otherOwnerUser = await createUser({ email: 'other@example.com', role: 'owner', phone: '9400000002', owner: { businessName: 'C', approvalStatus: 'approved' } })
  meenaUser = await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  chandni = await Theatre.create({ ownerId: ownerUser._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  sagar = await Theatre.create({ ownerId: ownerUser._id, name: 'Sagar Talkies', cityCode: 'hyderabad', address: '3 Lake Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  foreign = await Theatre.create({ ownerId: otherOwnerUser._id, name: 'Other Talkies', cityCode: 'hyderabad', address: '9 Hill Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate('2026-01-01'), status: 'now_showing' })
  ownerToken = await loginToken('owner@example.com')
})
afterAll(closeTestDB)

describe('O-10 check-in report', () => {
  it('counts tickets per show: confirmed = booked, scanned = came; holds and cancelled left out', async () => {
    const evening = await makeShow(chandni, at(DAY, '18:00'))
    await makeBooking(evening, 3, { scanned: true })
    await makeBooking(evening, 2) // booked, did not come
    await makeBooking(evening, 1, { scanned: true })
    await makeBooking(evening, 1, { status: 'pending' }) // seat hold
    await makeBooking(evening, 2, { status: 'cancelled' })
    await makeBooking(evening, 1, { status: 'released' })
    const morning = await makeShow(sagar, at(DAY, '09:30')) // no bookings
    const cancelled = await makeShow(chandni, at(DAY, '21:00'), { status: 'cancelled' })
    await makeBooking(cancelled, 2, { status: 'cancelled_by_theatre' })
    // Not on this IST day, or not mine
    await makeShow(chandni, new Date(at(DAY, '00:00').getTime() - MIN)) // 23:59 the day before
    await makeShow(chandni, at('2026-03-11', '00:00'))
    const theirs = await makeShow(foreign, at(DAY, '18:00'))
    await makeBooking(theirs, 4, { scanned: true })

    const res = await getAs(ownerToken, `?date=${DAY}`)
    expect(res.status).toBe(200)
    expect(res.body.date).toBe(DAY)
    expect(res.body.items.map((s) => [s.id, s.booked, s.came, s.gate])).toEqual([
      [String(morning._id), 0, 0, 'over'],
      [String(evening._id), 6, 4, 'over'],
      [String(cancelled._id), 0, 0, 'cancelled'],
    ])
    expect(res.body.items[1]).toMatchObject({ movie: { title: 'Kadal Kaatru' }, theatre: { name: 'Chandni Talkies' }, startTime: '18:00', totalSeats: 8, status: 'scheduled' })
    expect(new Date(res.body.items[1].gateOpensAt).getTime()).toBe(at(DAY, '17:30').getTime()) // BR-08: 30 min before
    expect(res.body.totals).toEqual({ booked: 6, came: 4 })
  })

  it('theatre filter; another owner\'s theatre gives an empty list', async () => {
    const evening = await makeShow(chandni, at(DAY, '18:00'))
    await makeBooking(evening, 2, { scanned: true })
    const matinee = await makeShow(sagar, at(DAY, '14:30'))
    await makeBooking(matinee, 1)

    const res = await getAs(ownerToken, `?date=${DAY}&theatreId=${sagar._id}`)
    expect(res.body.items.map((s) => s.id)).toEqual([String(matinee._id)])
    expect(res.body.totals).toEqual({ booked: 1, came: 0 })

    await makeShow(foreign, at(DAY, '18:00'))
    const theirs = await getAs(ownerToken, `?date=${DAY}&theatreId=${foreign._id}`)
    expect(theirs.status).toBe(200)
    expect(theirs.body).toMatchObject({ items: [], totals: { booked: 0, came: 0 } })
  })

  it('gate state from the BR-08 setting: open, not open yet', async () => {
    await Settings.updateOne({}, { checkinBeforeMinutes: 60 })
    const soon = await makeShow(chandni, new Date(Date.now() + 45 * MIN)) // gate opened 15 min ago
    const later = await makeShow(chandni, new Date(Date.now() + 90 * MIN)) // opens in 30 min
    const items = []
    for (const day of new Set([soon, later].map((s) => dateToIstDay(s.startAt)))) items.push(...(await getAs(ownerToken, `?date=${day}`)).body.items)
    expect(items.find((s) => s.id === String(soon._id)).gate).toBe('open')
    expect(items.find((s) => s.id === String(later._id)).gate).toBe('not_open')
  })

  it('gateState edges: opens exactly at opensAt, closes exactly at the end', () => {
    const show = { status: 'scheduled', endAt: new Date(10_000) }
    const opensAt = new Date(5_000)
    expect(gateState(show, opensAt, new Date(4_999))).toBe('not_open')
    expect(gateState(show, opensAt, new Date(5_000))).toBe('open')
    expect(gateState(show, opensAt, new Date(9_999))).toBe('open')
    expect(gateState(show, opensAt, new Date(10_000))).toBe('over')
    expect(gateState({ ...show, status: 'cancelled' }, opensAt, new Date(6_000))).toBe('cancelled')
  })

  it('date defaults to today (IST); empty day', async () => {
    const res = await getAs(ownerToken)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ date: istToday(), items: [], totals: { booked: 0, came: 0 } })
  })

  it('refusals: 401, 403 for a user / pending owner, 400 for a bad date or theatre ID', async () => {
    expect((await request(app).get('/api/owner/checkin-report')).status).toBe(401)
    expect((await getAs(await loginToken('meena@example.com'))).status).toBe(403)
    await createUser({ email: 'pending@example.com', role: 'owner', phone: '9400000003', owner: { businessName: 'P', approvalStatus: 'pending' } })
    expect((await getAs(await loginToken('pending@example.com'))).status).toBe(403)
    expect((await getAs(ownerToken, '?date=2026-02-30')).status).toBe(400)
    expect((await getAs(ownerToken, '?date=10-03-2026')).status).toBe(400)
    expect((await getAs(ownerToken, '?theatreId=abc')).status).toBe(400)
  })
})
