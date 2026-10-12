import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Booking } from '../src/models/Booking.js'
import { Counter } from '../src/models/Counter.js'
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
import { qrToken } from '../src/services/qr/index.js'
import { buildLayout } from '../src/utils/seatLayout.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createTestSettings } from './helpers/settings.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-09 Gate Staff accounts (ROLE-05): create / list / edit / block / new password.
// Done when: staff can log in and scan only for their theatre.

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn(async () => {}) }))

const MIN = 60 * 1000
const STAFF_PASSWORD = 'gatepass9'
const later = (minutes) => new Date(Date.now() + minutes * MIN)
const built = buildLayout([{ cells: [{ type: 'seat', seatClass: 'second' }, { type: 'seat', seatClass: 'second' }] }])

const loginRes = (email, password = TEST_PASSWORD) => request(app).post('/api/auth/login').send({ email, password })
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
})

let ownerUser, owner, otherOwner, admin, meena, chandni, sagar, foreign
const newStaff = (body = {}) =>
  owner.post('/api/owner/staff', { name: 'Raju Gatekeeper', email: 'Raju@Example.com', password: STAFF_PASSWORD, theatreIds: [String(chandni._id)], ...body })

// A show starting in 20 min (check-in open, BR-08) + a confirmed booking by Meena
async function bookedTicket(theatreDoc) {
  const movie = await Movie.create({ title: 'Kadal Kaatru', posterUrl: '/p.png', genres: ['Romance'], languages: ['Tamil'], durationMinutes: 135, certificate: 'U', releaseDate: istDayToDate(istToday(-3)), status: 'now_showing' })
  const screen = await Screen.create({ theatreId: theatreDoc._id, ownerId: ownerUser._id, name: 'Screen 1', format: '2D', cleaningBreakMinutes: 15, layout: built.layout, seatCount: built.seatCount, wheelchairFriendly: false })
  const show = await Show.create({ movieId: movie._id, theatreId: theatreDoc._id, screenId: screen._id, ownerId: ownerUser._id, cityCode: 'hyderabad', startAt: later(20), endAt: later(170), label: 'matinee', language: 'Tamil', format: '2D', prices: [{ seatClass: 'second', pricePaise: 12000 }], layout: built.layout, totalSeats: 2 })
  const held = (await meena.post('/api/bookings/hold', { showId: String(show._id), seatIds: ['A1'] })).body.booking
  const { orderId } = (await meena.post(`/api/bookings/${held.id}/payments`)).body
  const paid = (await meena.post('/api/mock-gateway/pay', { orderId, method: 'upi', upiId: 'success@test' })).body
  await meena.post('/api/payments/verify', { orderId, ...paid })
  return Booking.findById(held.id)
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Movie.init(), Theatre.init(), Screen.init(), Show.init(), ShowSeat.init(), Booking.init(), Settings.init(), Payment.init(), Invoice.init(), Counter.init(), AuditLog.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockClear()
  await createTestSettings()
  ownerUser = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  const otherOwnerUser = await createUser({ email: 'other@example.com', role: 'owner', phone: '9400000002', owner: { businessName: 'C', approvalStatus: 'approved' } })
  await createUser({ email: 'admin@example.com', role: 'admin' })
  await createUser({ email: 'meena@example.com', name: 'Meena Iyer' })
  chandni = await Theatre.create({ ownerId: ownerUser._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  sagar = await Theatre.create({ ownerId: ownerUser._id, name: 'Sagar Talkies', cityCode: 'hyderabad', address: '3 Lake Road', gstin: '36AABCS1234A1Z5', status: 'pending' })
  foreign = await Theatre.create({ ownerId: otherOwnerUser._id, name: 'Other Talkies', cityCode: 'hyderabad', address: '9 Hill Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  owner = as((await loginRes('owner@example.com')).body.accessToken)
  otherOwner = as((await loginRes('other@example.com')).body.accessToken)
  admin = as((await loginRes('admin@example.com')).body.accessToken)
  meena = as((await loginRes('meena@example.com')).body.accessToken)
})
afterAll(closeTestDB)

describe('O-09 create and list staff', () => {
  it('creates a verified staff login for my theatres (also a pending one); audit staff.create', async () => {
    const res = await newStaff({ theatreIds: [String(sagar._id), String(chandni._id), String(chandni._id)] })
    expect(res.status).toBe(201)
    expect(res.body.staff).toMatchObject({
      name: 'Raju Gatekeeper',
      email: 'raju@example.com',
      status: 'active',
      theatres: [{ id: String(chandni._id), name: 'Chandni Talkies' }, { id: String(sagar._id), name: 'Sagar Talkies' }],
    })
    const saved = await User.findById(res.body.staff.id).select('+passwordHash')
    expect(saved).toMatchObject({ role: 'staff', emailVerified: true })
    expect(String(saved.staff.ownerId)).toBe(String(ownerUser._id))
    expect(saved.passwordHash).not.toContain(STAFF_PASSWORD)
    expect(sendEmail).not.toHaveBeenCalled() // the owner gives the password in person (BR-25)
    const audit = await AuditLog.findOne({ action: 'staff.create' })
    expect(audit).toMatchObject({ actorRole: 'owner', targetType: 'user' })
    expect(String(audit.targetId)).toBe(res.body.staff.id)
    expect(JSON.stringify(audit.details)).not.toContain(STAFF_PASSWORD)
  })

  it('lists only my staff, A to Z, never the password', async () => {
    await newStaff({ name: 'Zeenat', email: 'z@example.com' })
    await newStaff({ name: 'Anil', email: 'a@example.com' })
    await otherOwner.post('/api/owner/staff', { name: 'Other gate', email: 'o@example.com', password: STAFF_PASSWORD, theatreIds: [String(foreign._id)] })
    const res = await owner.get('/api/owner/staff')
    expect(res.status).toBe(200)
    expect(res.body.items.map((s) => s.name)).toEqual(['Anil', 'Zeenat'])
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/)
  })

  it('refuses: another owner\'s theatre, no theatre, weak password, used email (any role, any case)', async () => {
    const foreignRes = await newStaff({ theatreIds: [String(chandni._id), String(foreign._id)] })
    expect(foreignRes.status).toBe(400)
    expect(foreignRes.body.error.details.theatreIds).toBe('Please pick only your own theatres.')
    expect((await newStaff({ theatreIds: [] })).body.error.details.theatreIds).toBe('Please pick at least one theatre.')
    expect((await newStaff({ password: 'short' })).status).toBe(400)

    const used = await newStaff({ email: 'MEENA@example.com' })
    expect(used.status).toBe(409)
    expect(used.body.error).toMatchObject({ code: 'ALREADY_EXISTS', message: 'This email is already used.', details: { email: 'This email is already used.' } })
    expect((await User.findOne({ email: 'meena@example.com' })).role).toBe('user') // not turned into staff
    expect(await User.countDocuments({ role: 'staff' })).toBe(0)
  })

  it('two creates with the same email at the same moment: one wins', async () => {
    const results = await Promise.all([newStaff(), newStaff()])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(await User.countDocuments({ email: 'raju@example.com' })).toBe(1)
  })

  it('only approved owners (403 for others); another owner\'s staff → 404', async () => {
    expect((await admin.get('/api/owner/staff')).status).toBe(403)
    expect((await meena.post('/api/owner/staff', {})).status).toBe(403)
    const id = (await newStaff()).body.staff.id
    expect((await otherOwner.patch(`/api/owner/staff/${id}`, { status: 'blocked' })).status).toBe(404)
    expect((await owner.patch(`/api/owner/staff/${(await User.findOne({ email: 'meena@example.com' }))._id}`, { name: 'X' })).status).toBe(404)
    expect((await owner.patch(`/api/owner/staff/${id}`, {})).status).toBe(400) // nothing to change
  })
})

describe('O-09 done when: staff can log in and scan only for their theatre', () => {
  it('a new staff logs in, scans a ticket of their theatre; another theatre → wrong_theatre', async () => {
    await newStaff()
    const login = await loginRes('raju@example.com', STAFF_PASSWORD)
    expect(login.status).toBe(200)
    const staff = as(login.body.accessToken)
    expect((await staff.get('/api/staff/theatres')).body.items.map((t) => t.name)).toEqual(['Chandni Talkies'])

    const mine = await bookedTicket(chandni)
    expect((await staff.post('/api/staff/checkins', { qrToken: qrToken(mine) })).body).toMatchObject({ result: 'entered' })
    await Theatre.updateOne({ _id: sagar._id }, { status: 'approved' })
    const other = await bookedTicket(sagar)
    expect((await staff.post('/api/staff/checkins', { qrToken: qrToken(other) })).body).toMatchObject({ result: 'rejected', reason: 'wrong_theatre' })
  })

  it('changing the theatres works at once (same login); audit staff.update', async () => {
    const id = (await newStaff()).body.staff.id
    const staff = as((await loginRes('raju@example.com', STAFF_PASSWORD)).body.accessToken)
    await Theatre.updateOne({ _id: sagar._id }, { status: 'approved' })
    const ticket = await bookedTicket(sagar)

    const res = await owner.patch(`/api/owner/staff/${id}`, { name: 'Raju K', theatreIds: [String(sagar._id)] })
    expect(res.body.staff).toMatchObject({ name: 'Raju K', theatres: [{ name: 'Sagar Talkies' }] })
    expect((await staff.post('/api/staff/checkins', { qrToken: qrToken(ticket) })).body).toMatchObject({ result: 'entered' })
    expect((await AuditLog.findOne({ action: 'staff.update' })).details).toMatchObject({ changed: ['name', 'theatreIds'] })
  })

  it('block: logged out at once, cannot log in; unblock: login works again; audit block / unblock', async () => {
    const id = (await newStaff()).body.staff.id
    const login = await loginRes('raju@example.com', STAFF_PASSWORD)
    const staff = as(login.body.accessToken)
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('talkies_rt=')).split(';')[0]

    const blocked = await owner.patch(`/api/owner/staff/${id}`, { status: 'blocked' })
    expect(blocked.body.staff.status).toBe('blocked')
    expect((await staff.get('/api/staff/theatres')).status).toBe(403) // open session stops on the next request
    expect(await AuthToken.countDocuments({ userId: id, type: 'refresh' })).toBe(0)
    expect((await request(app).post('/api/auth/refresh').set('Cookie', [cookie])).status).toBe(401)
    expect((await loginRes('raju@example.com', STAFF_PASSWORD)).status).toBe(403)

    // Blocking twice changes nothing (no second audit entry)
    await owner.patch(`/api/owner/staff/${id}`, { status: 'blocked' })
    expect(await AuditLog.countDocuments({ action: 'staff.block' })).toBe(1)

    expect((await owner.patch(`/api/owner/staff/${id}`, { status: 'active' })).body.staff.status).toBe('active')
    expect((await loginRes('raju@example.com', STAFF_PASSWORD)).status).toBe(200)
    expect(await AuditLog.countDocuments({ action: 'staff.unblock' })).toBe(1)
  })

  it('new password: old password refused, logged out everywhere (refresh + older access tokens)', async () => {
    const id = (await newStaff()).body.staff.id
    const login = await loginRes('raju@example.com', STAFF_PASSWORD)
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('talkies_rt=')).split(';')[0]
    // An access token from another device, made a minute ago
    const oldToken = jwt.sign({ role: 'staff', iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_ACCESS_SECRET, { subject: id, expiresIn: '15m' })
    expect((await as(oldToken).get('/api/staff/theatres')).status).toBe(200)

    const res = await owner.patch(`/api/owner/staff/${id}`, { password: 'newgate77' })
    expect(res.status).toBe(200)
    expect((await as(oldToken).get('/api/staff/theatres')).status).toBe(401)
    expect((await request(app).post('/api/auth/refresh').set('Cookie', [cookie])).status).toBe(401)
    expect((await loginRes('raju@example.com', STAFF_PASSWORD)).status).toBe(401)
    expect((await loginRes('raju@example.com', 'newgate77')).status).toBe(200)
    const audit = await AuditLog.findOne({ action: 'staff.update' })
    expect(audit.details).toEqual({ changed: ['password'] })
    expect((await owner.patch(`/api/owner/staff/${id}`, { password: 'weak' })).status).toBe(400)
  })
})
