import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Settings } from '../src/models/Settings.js'
import { User } from '../src/models/User.js'
import settingsStep, { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// A-05 platform settings + audit log (A-14, SEC-13)

const login = (email) => request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })
let token
const admin = {
  get: () => request(app).get('/api/admin/settings').set('Authorization', `Bearer ${token}`),
  patch: (body) => request(app).patch('/api/admin/settings').set('Authorization', `Bearer ${token}`).send(body),
}

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), AuditLog.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createUser({ email: 'admin@example.com', role: 'admin' })
  token = (await login('admin@example.com')).body.accessToken
})
afterAll(closeTestDB)

describe('GET /api/admin/settings', () => {
  it('gives the defaults (database.md 5.4) even before anything was saved', async () => {
    const res = await admin.get()
    expect(res.status).toBe(200)
    expect(res.body.settings).toMatchObject({
      holdMinutes: 10,
      maxSeatsPerBooking: 10,
      convenienceFeePaise: 3000,
      cancelCutoffMinutes: 120,
      userRefundTicketPercent: 75,
      userRefundFoodPercent: 100,
      checkinBeforeMinutes: 30,
      defaultCleaningBreakMinutes: 15,
      commissionPercent: null,
      waitlistOfferMinutes: 10,
      dealStartMinutes: 30,
      dealMaxPercent: 50,
      transferCutoffMinutes: 30,
      accessTokenMinutes: 15,
      refreshTokenDays: 7,
      resetLinkMinutes: 30,
      gst: { ticketPercent: null, foodPercent: null, convenienceFeePercent: null, hsnSac: { ticket: null, food: null, convenienceFee: null } },
      platform: { companyName: null, gstin: null, address: null },
      uploadMaxMb: 2,
      posterMaxWidthPx: 800,
      cities: [],
    })
    // BR-17 lives in rateLimits.js, not in settings (decided 2026-10-01)
    expect(res.body.settings.loginMaxAttempts).toBeUndefined()
  })

  it('is admin only', async () => {
    await createUser({ email: 'user@example.com', role: 'user' })
    const userToken = (await login('user@example.com')).body.accessToken
    expect((await request(app).get('/api/admin/settings').set('Authorization', `Bearer ${userToken}`)).status).toBe(403)
    expect((await request(app).get('/api/admin/settings')).status).toBe(401)
  })
})

describe('PATCH /api/admin/settings', () => {
  it('saves only the sent fields, including nested GST and platform fields', async () => {
    const res = await admin.patch({
      holdMinutes: 12,
      commissionPercent: 12.5,
      gst: { ticketPercent: 18, hsnSac: { ticket: '999631' } },
      platform: { gstin: '36aabct0000a1z5' }, // made upper case
    })
    expect(res.status).toBe(200)
    expect(res.body.settings).toMatchObject({
      holdMinutes: 12,
      commissionPercent: 12.5,
      maxSeatsPerBooking: 10,
      gst: { ticketPercent: 18, foodPercent: null, hsnSac: { ticket: '999631', food: null } },
      platform: { gstin: '36AABCT0000A1Z5', companyName: null },
    })
    expect(res.body.changed.sort()).toEqual(['commissionPercent', 'gst.hsnSac.ticket', 'gst.ticketPercent', 'holdMinutes', 'platform.gstin'])
  })

  it('writes one audit entry with who, the old and the new values (SEC-13)', async () => {
    await admin.patch({ holdMinutes: 12, gst: { foodPercent: 5 } })

    const entries = await AuditLog.find()
    expect(entries).toHaveLength(1)
    const [entry] = entries
    expect(entry).toMatchObject({ action: 'settings.update', actorRole: 'admin', targetType: 'settings', targetId: 'platform' })
    expect(String(entry.actorId)).toBe(String((await User.findOne({ email: 'admin@example.com' }))._id))
    expect(entry.details).toEqual({
      before: { holdMinutes: 10, 'gst.foodPercent': null },
      after: { holdMinutes: 12, 'gst.foodPercent': 5 },
    })
  })

  it('a value that is the same as now is neither saved nor logged', async () => {
    const res = await admin.patch({ holdMinutes: 10 })
    expect(res.body.changed).toEqual([])
    expect(await AuditLog.countDocuments()).toBe(0)
  })

  it('refuses values outside the agreed ranges', async () => {
    const bad = [
      { holdMinutes: 0 },
      { holdMinutes: 61 },
      { holdMinutes: 10.5 },
      { maxSeatsPerBooking: 21 },
      { convenienceFeePaise: 50001 },
      { cancelCutoffMinutes: 1441 },
      { userRefundTicketPercent: 101 },
      { commissionPercent: -1 },
      { commissionPercent: 10.123 },
      { dealMaxPercent: 91 },
      { defaultCleaningBreakMinutes: 121 },
      { accessTokenMinutes: 4 },
      { refreshTokenDays: 31 },
      { resetLinkMinutes: 9 },
      { uploadMaxMb: 11 },
      { posterMaxWidthPx: 399 },
      { gst: { ticketPercent: 'eighteen' } },
      { gst: { hsnSac: { food: '' } } },
      { platform: { gstin: '36AABCT0000A1Z' } },
      { platform: { companyName: '  ' } },
      {},
    ]
    for (const body of bad) {
      const res = await admin.patch(body)
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
    expect(await AuditLog.countDocuments()).toBe(0)
  })

  it('accepts 2-decimal percentages like 0.29 (no floating-point surprise)', async () => {
    expect((await admin.patch({ commissionPercent: 0.29 })).status).toBe(200)
  })

  it('the city list cannot be changed here', async () => {
    const res = await admin.patch({ cities: [{ code: 'x', name: 'X', state: 'Y' }] })
    expect(res.status).toBe(400)
    expect(res.body.error.details.cities).toBe('The city list cannot be changed here.')
  })
})

describe('GET /api/settings/public', () => {
  it('gives only the values the screens need, to guests too', async () => {
    const res = await request(app).get('/api/settings/public')
    expect(res.status).toBe(200)
    expect(res.body.settings).toEqual({
      holdMinutes: 10,
      maxSeatsPerBooking: 10,
      convenienceFeePaise: 3000,
      cancelCutoffMinutes: 120,
      userRefundTicketPercent: 75,
      transferCutoffMinutes: 30,
      uploadMaxMb: 2,
    })
  })
})

describe('changed settings are used at once (for new logins, links, uploads)', () => {
  it('access token and refresh token life', async () => {
    await admin.patch({ accessTokenMinutes: 20, refreshTokenDays: 3 })
    const res = await login('admin@example.com')
    const payload = jwt.decode(res.body.accessToken)
    expect(payload.exp - payload.iat).toBe(20 * 60)
    expect(res.headers['set-cookie'].find((c) => c.startsWith('talkies_rt='))).toMatch(/Max-Age=259200/) // 3 days
  })

  it('reset link life', async () => {
    await admin.patch({ resetLinkMinutes: 45 })
    await request(app).post('/api/auth/forgot-password').send({ email: 'admin@example.com' })
    const link = await AuthToken.findOne({ type: 'reset_password' })
    expect((link.expiresAt - Date.now()) / 60000).toBeGreaterThan(44.9)
  })

  it('upload size', async () => {
    await admin.patch({ uploadMaxMb: 1 })
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1.5 * 1024 * 1024)])
    const res = await request(app).post('/api/uploads').set('Authorization', `Bearer ${token}`).field('kind', 'poster').attach('file', png, 'p.png')
    expect(res.status).toBe(400)
    expect(res.body.error.message).toBe('The image is too big. Max 1 MB.')
  })
})

describe('seed step: settings', () => {
  it('sets the 10 cities and fills TEST values only where empty', async () => {
    await admin.patch({ commissionPercent: 8 }) // the admin already chose this
    await settingsStep.run()

    const s = await Settings.findById('platform')
    expect(s.cities.map((c) => c.code)).toEqual(CITIES.map((c) => c.code))
    expect(s.cities.find((c) => c.code === 'hyderabad').state).toBe('Telangana')
    expect(s.commissionPercent).toBe(8) // not overwritten
    expect(s.gst.ticketPercent).toBe(18)
    expect(s.gst.hsnSac.ticket).toBe('TEST-TICKET')
    expect(s.platform.companyName).toMatch(/\(TEST\)$/)
  })

  it('can run twice', async () => {
    await settingsStep.run()
    await settingsStep.run()
    expect((await Settings.findById('platform')).cities).toHaveLength(10)
    expect(await Settings.countDocuments()).toBe(1)
  })
})
