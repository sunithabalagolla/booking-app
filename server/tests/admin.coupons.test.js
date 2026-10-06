import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { Coupon } from '../src/models/Coupon.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// A-06 admin coupons (decided 2026-10-06: IST whole days, no delete, "End now",
// audit for create / update / end, "Show to users" switch)

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

let admin, theatre, pendingTheatre
const good = () => ({ code: ' talkies20 ', discountType: 'percent', value: 20, maxDiscountPaise: 10000, minAmountPaise: 20000, startDate: istToday(), endDate: istToday(30), isPublic: true })
const create = (body) => admin.post('/api/admin/coupons', body)

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), Coupon.init(), Theatre.init(), AuditLog.init(), Settings.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await Settings.create({ cities: [{ code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' }, { code: 'chennai', name: 'Chennai', state: 'Tamil Nadu' }] })
  await createUser({ email: 'admin@example.com', role: 'admin' })
  const owner = await createUser({ email: 'owner@example.com', role: 'owner', phone: '9400000001', owner: { businessName: 'B', approvalStatus: 'approved' } })
  await createUser({ email: 'meena@example.com' })
  theatre = await Theatre.create({ ownerId: owner._id, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road', gstin: '36AABCS1234A1Z5', status: 'approved' })
  pendingTheatre = await Theatre.create({ ownerId: owner._id, name: 'New Talkies', cityCode: 'hyderabad', address: '1 Road', gstin: '36AABCS1234A1Z6', status: 'pending' })
  admin = as(await login('admin@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/admin/coupons (A-06)', () => {
  it('creates a coupon: code in capitals, IST whole days, Show to users; audit coupon.create', async () => {
    const res = await create(good())
    expect(res.status).toBe(201)
    expect(res.body.coupon).toMatchObject({
      code: 'TALKIES20',
      discountType: 'percent',
      value: 20,
      maxDiscountPaise: 10000,
      minAmountPaise: 20000,
      startDate: istToday(),
      endDate: istToday(30),
      totalLimit: null,
      perUserLimit: null,
      usedCount: 0,
      cityCodes: [],
      theatreIds: [],
      isPublic: true,
      status: 'active',
    })
    // 2026-10-06 IST = 2026-10-05T18:30Z … 2026-10-06T18:29:59.999Z
    const saved = await Coupon.findById(res.body.coupon.id)
    expect(saved.startAt.toISOString().slice(11)).toBe('18:30:00.000Z')
    expect(saved.endAt.toISOString().slice(11)).toBe('18:29:59.999Z')
    const audit = await AuditLog.findOne({ action: 'coupon.create' })
    expect(audit).toMatchObject({ targetType: 'coupon', details: { code: 'TALKIES20' } })
    expect(String(audit.targetId)).toBe(res.body.coupon.id)
  })

  it('secret by default; flat coupon with cities and approved theatres', async () => {
    const res = await create({ code: 'FLAT50', discountType: 'flat', value: 5000, startDate: istToday(1), endDate: istToday(1), perUserLimit: 1, totalLimit: 100, cityCodes: ['hyderabad'], theatreIds: [String(theatre._id)] })
    expect(res.status).toBe(201)
    expect(res.body.coupon).toMatchObject({ isPublic: false, status: 'scheduled', cityCodes: ['hyderabad'], theatreIds: [String(theatre._id)], totalLimit: 100, perUserLimit: 1 })
  })

  it('refuses with field messages', async () => {
    const errorsOf = async (body) => {
      const res = await create({ ...good(), ...body })
      expect(res.status).toBe(400)
      return res.body.error.details
    }
    expect(await errorsOf({ code: 'AB' })).toHaveProperty('code')
    expect(await errorsOf({ code: 'TALKIES 20' })).toHaveProperty('code')
    expect(await errorsOf({ value: 101 })).toEqual({ value: 'A percent is 1 to 100.' })
    expect(await errorsOf({ discountType: 'flat', value: 5050, maxDiscountPaise: null })).toEqual({ value: 'Whole rupees, ₹1 to ₹5,000.' })
    expect(await errorsOf({ discountType: 'flat', value: 5000 })).toEqual({ maxDiscountPaise: 'Only for percent coupons.' })
    expect(await errorsOf({ minAmountPaise: 20050 })).toHaveProperty('minAmountPaise')
    expect(await errorsOf({ startDate: istToday(5), endDate: istToday(4) })).toEqual({ endDate: 'The end date must be on or after the start date.' })
    expect(await errorsOf({ startDate: istToday(-5), endDate: istToday(-1) })).toEqual({ endDate: 'The end date cannot be in the past.' })
    expect(await errorsOf({ totalLimit: 5, perUserLimit: 6 })).toEqual({ perUserLimit: 'Cannot be more than the total limit.' })
    expect(await errorsOf({ cityCodes: ['mumbai'] })).toEqual({ cityCodes: 'Please pick cities from the list.' })
    expect(await errorsOf({ theatreIds: [String(pendingTheatre._id)] })).toEqual({ theatreIds: 'Please pick approved theatres only.' })
    expect(await Coupon.countDocuments()).toBe(0)
  })

  it('same code again (any case) → 409 ALREADY_EXISTS', async () => {
    await create(good())
    const res = await create({ ...good(), code: 'Talkies20' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'ALREADY_EXISTS', details: { code: 'A coupon with this code already exists.' } })
  })
})

describe('GET /api/admin/coupons (A-06 register)', () => {
  it('newest first; search by the start of the code; status filter', async () => {
    const make = (code, fields) => Coupon.create({ code, discountType: 'flat', value: 1000, createdBy: theatre.ownerId, ...fields })
    const DAY = 24 * 60 * 60 * 1000
    const now = Date.now()
    await make('OLD10', { startAt: new Date(now - 9 * DAY), endAt: new Date(now - DAY) })
    await make('SOON10', { startAt: new Date(now + DAY), endAt: new Date(now + 9 * DAY) })
    await make('GONE10', { startAt: new Date(now - DAY), endAt: new Date(now + DAY), totalLimit: 2, usedCount: 2 })
    await make('NOW10', { startAt: new Date(now - DAY), endAt: new Date(now + DAY), totalLimit: 2, usedCount: 1 })
    await make('NOW20', { startAt: new Date(now - DAY), endAt: new Date(now + DAY) })

    const all = await admin.get('/api/admin/coupons')
    expect(all.body).toMatchObject({ page: 1, limit: 20, total: 5 })
    expect(all.body.items.map((c) => c.code)).toEqual(['NOW20', 'NOW10', 'GONE10', 'SOON10', 'OLD10'])
    expect(all.body.items.map((c) => c.status)).toEqual(['active', 'active', 'used_up', 'scheduled', 'ended'])

    const codes = async (query) => (await admin.get(`/api/admin/coupons?${query}`)).body.items.map((c) => c.code)
    expect(await codes('q=now')).toEqual(['NOW20', 'NOW10'])
    expect(await codes('q=10')).toEqual([]) // start of the code only
    expect(await codes('status=active')).toEqual(['NOW20', 'NOW10'])
    expect(await codes('status=used_up')).toEqual(['GONE10'])
    expect(await codes('status=scheduled')).toEqual(['SOON10'])
    expect(await codes('status=ended')).toEqual(['OLD10'])
    expect((await admin.get('/api/admin/coupons?status=lost')).status).toBe(400)
  })
})

describe('PATCH /api/admin/coupons/:id', () => {
  it('changes fields (not the code); null clears; audit has only the changed fields', async () => {
    const { coupon } = (await create(good())).body
    const res = await admin.patch(`/api/admin/coupons/${coupon.id}`, { code: 'NEWCODE', value: 25, maxDiscountPaise: null, isPublic: false, endDate: istToday(60), minAmountPaise: 20000 })
    expect(res.status).toBe(200)
    expect(res.body.coupon).toMatchObject({ code: 'TALKIES20', value: 25, maxDiscountPaise: null, isPublic: false, endDate: istToday(60) })
    expect(res.body.changed.sort()).toEqual(['endDate', 'isPublic', 'maxDiscountPaise', 'value'])
    expect((await Coupon.findById(coupon.id)).maxDiscountPaise).toBeUndefined()
    const audit = await AuditLog.findOne({ action: 'coupon.update' })
    expect(audit.details).toEqual({ code: 'TALKIES20', before: { value: 20, maxDiscountPaise: 10000, isPublic: true, endDate: istToday(30) }, after: { value: 25, maxDiscountPaise: null, isPublic: false, endDate: istToday(60) } })
  })

  it('checks the rules with the stored values; total limit not under the uses; nothing changed = no audit', async () => {
    const { coupon } = (await create(good())).body
    await Coupon.updateOne({ _id: coupon.id }, { usedCount: 7 })
    const low = await admin.patch(`/api/admin/coupons/${coupon.id}`, { totalLimit: 5 })
    expect(low.body.error.details).toEqual({ totalLimit: 'Already used 7 times, so the limit cannot be lower.' })
    expect((await admin.patch(`/api/admin/coupons/${coupon.id}`, { discountType: 'flat' })).body.error.details).toHaveProperty('maxDiscountPaise')
    expect((await admin.patch(`/api/admin/coupons/${coupon.id}`, { endDate: istToday(-1) })).body.error.details).toEqual({ endDate: 'The end date must be on or after the start date.' })
    expect((await admin.patch(`/api/admin/coupons/${coupon.id}`, {})).status).toBe(400)

    const same = await admin.patch(`/api/admin/coupons/${coupon.id}`, { value: 20 })
    expect(same.body.changed).toEqual([])
    expect(await AuditLog.countDocuments({ action: 'coupon.update' })).toBe(0)
    expect((await admin.patch('/api/admin/coupons/6ac262ef0a67bd8f520f4d95', { value: 5 })).status).toBe(404)
  })
})

describe('POST /api/admin/coupons/:id/end ("End now")', () => {
  it('ends at once, keeps the coupon and its uses; audit coupon.end; again → 400', async () => {
    const { coupon } = (await create(good())).body
    await Coupon.updateOne({ _id: coupon.id }, { usedCount: 3 })
    const res = await admin.post(`/api/admin/coupons/${coupon.id}/end`)
    expect(res.status).toBe(200)
    expect(res.body.coupon).toMatchObject({ status: 'ended', usedCount: 3, endDate: istToday() })
    expect(new Date(res.body.coupon.endAt).getTime()).toBeLessThanOrEqual(Date.now())
    expect(await AuditLog.countDocuments({ action: 'coupon.end' })).toBe(1)

    const again = await admin.post(`/api/admin/coupons/${coupon.id}/end`)
    expect(again.status).toBe(400)
    expect(again.body.error.details.reason).toBe('already_ended')
    expect((await admin.post('/api/admin/coupons/6ac262ef0a67bd8f520f4d95/end')).status).toBe(404)
  })

  it('a scheduled coupon ended now shows as ended (not scheduled)', async () => {
    const { coupon } = (await create({ ...good(), startDate: istToday(3), endDate: istToday(9) })).body
    expect((await admin.post(`/api/admin/coupons/${coupon.id}/end`)).body.coupon.status).toBe('ended')
  })

  it('admins only; there is no delete', async () => {
    const { coupon } = (await create(good())).body
    const user = as(await login('meena@example.com'))
    expect((await user.get('/api/admin/coupons')).status).toBe(403)
    expect((await user.post(`/api/admin/coupons/${coupon.id}/end`)).status).toBe(403)
    expect((await request(app).get('/api/admin/coupons')).status).toBe(401)
    expect((await admin.delete(`/api/admin/coupons/${coupon.id}`)).status).toBe(404)
  })
})
