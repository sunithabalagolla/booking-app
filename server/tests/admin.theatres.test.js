import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { sendEmail } from '../src/services/email/index.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// A-04 theatre approvals

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn() }))

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
let adminToken
const admin = {
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${adminToken}`),
  post: (path, body = {}) => request(app).post(path).set('Authorization', `Bearer ${adminToken}`).send(body),
}

let owner
const makeTheatre = (fields = {}) =>
  Theatre.create({
    ownerId: owner._id,
    name: 'Chandni Talkies',
    cityCode: 'hyderabad',
    address: '12 Station Road, Hyderabad',
    gstin: '36AABCS1234A1Z5',
    status: 'pending',
    ...fields,
  })

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), AuditLog.init(), Theatre.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockClear()
  await Settings.create({ _id: 'platform', cities: CITIES })
  await createUser({ email: 'admin@example.com', name: 'Asha Admin', role: 'admin' })
  owner = await createUser({ email: 'ravi@example.com', name: 'Ravi', role: 'owner', phone: '9876543210', owner: { businessName: 'Ravi Talkies Pvt Ltd', approvalStatus: 'approved' } })
  adminToken = await login('admin@example.com')
})
afterAll(closeTestDB)

describe('GET /api/admin/theatres (A-04)', () => {
  beforeEach(async () => {
    await makeTheatre({ name: 'First Pending' })
    await makeTheatre({ name: 'Second Pending', cityCode: 'chennai', gstin: '33AABCS1234A1Z5' })
    await makeTheatre({ name: 'Old Approved', status: 'approved' })
  })

  it('pending: oldest first, with city, state and owner details', async () => {
    const res = await admin.get('/api/admin/theatres?status=pending')
    expect(res.body.total).toBe(2)
    expect(res.body.items.map((t) => t.name)).toEqual(['First Pending', 'Second Pending'])
    expect(res.body.items[0]).toMatchObject({
      city: { code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
      gstin: '36AABCS1234A1Z5',
      owner: { name: 'Ravi', businessName: 'Ravi Talkies Pvt Ltd', email: 'ravi@example.com', phone: '9876543210', status: 'active' },
      decidedBy: null,
    })
  })

  it('all: newest first; city filter', async () => {
    expect((await admin.get('/api/admin/theatres')).body.items.map((t) => t.name)).toEqual(['Old Approved', 'Second Pending', 'First Pending'])
    expect((await admin.get('/api/admin/theatres?cityCode=chennai')).body.items.map((t) => t.name)).toEqual(['Second Pending'])
  })

  it('is admin only', async () => {
    const ownerToken = await login('ravi@example.com')
    expect((await request(app).get('/api/admin/theatres').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403)
  })
})

describe('approve / reject', () => {
  it('approve: who and when, audit entry, E-09 to the owner', async () => {
    const theatre = await makeTheatre()
    const res = await admin.post(`/api/admin/theatres/${theatre._id}/approve`)
    expect(res.status).toBe(200)
    expect(res.body.theatre).toMatchObject({ status: 'approved', decidedBy: { name: 'Asha Admin' } })

    expect(String((await AuditLog.findOne({ action: 'theatre.approve' })).targetId)).toBe(String(theatre._id))
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'ravi@example.com', subject: 'Talkies – Chandni Talkies is approved' })
  })

  it('reject: reason required (5–500), saved, audited, emailed; the owner sees it', async () => {
    const theatre = await makeTheatre()
    for (const body of [{}, { reason: 'no' }, { reason: 'x'.repeat(501) }]) {
      expect((await admin.post(`/api/admin/theatres/${theatre._id}/reject`, body)).status).toBe(400)
    }
    const res = await admin.post(`/api/admin/theatres/${theatre._id}/reject`, { reason: 'Please add the real address' })
    expect(res.body.theatre).toMatchObject({ status: 'rejected', rejectReason: 'Please add the real address' })
    expect((await AuditLog.findOne({ action: 'theatre.reject' })).details).toEqual({ reason: 'Please add the real address' })
    expect(sendEmail.mock.calls[0][0].text).toContain('Reason: Please add the real address')

    const ownerToken = await login('ravi@example.com')
    const mine = await request(app).get('/api/owner/theatres').set('Authorization', `Bearer ${ownerToken}`)
    expect(mine.body.items[0]).toMatchObject({ status: 'rejected', rejectReason: 'Please add the real address' })
  })

  it('a rejected theatre fixed by the owner goes back to Pending and can then be approved', async () => {
    const theatre = await makeTheatre()
    await admin.post(`/api/admin/theatres/${theatre._id}/reject`, { reason: 'Address missing' })

    const ownerToken = await login('ravi@example.com')
    await request(app).patch(`/api/owner/theatres/${theatre._id}`).set('Authorization', `Bearer ${ownerToken}`).send({ address: '12 Station Road, Secunderabad, Hyderabad 500003' })
    expect((await admin.get('/api/admin/theatres?status=pending')).body.total).toBe(1)

    const res = await admin.post(`/api/admin/theatres/${theatre._id}/approve`)
    expect(res.body.theatre).toMatchObject({ status: 'approved', rejectReason: null })
  })

  it('a rejected theatre can also be approved directly (admin changes their mind)', async () => {
    const theatre = await makeTheatre({ status: 'rejected', rejectReason: 'Old' })
    expect((await admin.post(`/api/admin/theatres/${theatre._id}/approve`)).body.theatre.status).toBe('approved')
  })

  it('refuses: approving twice, rejecting an approved or rejected theatre (already_decided)', async () => {
    const approved = await makeTheatre({ status: 'approved' })
    const rejected = await makeTheatre({ name: 'R', status: 'rejected', rejectReason: 'Old reason' })
    for (const [path, body] of [
      [`/api/admin/theatres/${approved._id}/approve`, {}],
      [`/api/admin/theatres/${approved._id}/reject`, { reason: 'Changed my mind' }],
      [`/api/admin/theatres/${rejected._id}/reject`, { reason: 'Again please' }],
    ]) {
      const res = await admin.post(path, body)
      expect(res.status, path).toBe(400)
      expect(res.body.error.details.reason).toBe('already_decided')
    }
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await AuditLog.countDocuments()).toBe(0)
  })

  it('no approve while the owner is blocked (owner_blocked); reject still works', async () => {
    const theatre = await makeTheatre()
    await User.updateOne({ _id: owner._id }, { status: 'blocked' })

    const res = await admin.post(`/api/admin/theatres/${theatre._id}/approve`)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('owner_blocked')
    expect((await admin.get('/api/admin/theatres')).body.items[0].owner.status).toBe('blocked')
    expect((await admin.post(`/api/admin/theatres/${theatre._id}/reject`, { reason: 'Owner is blocked' })).status).toBe(200)
  })

  it('two admins approve at the same moment: one wins, one email, one audit entry', async () => {
    const theatre = await makeTheatre()
    const results = await Promise.all([admin.post(`/api/admin/theatres/${theatre._id}/approve`), admin.post(`/api/admin/theatres/${theatre._id}/approve`)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 400])
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(await AuditLog.countDocuments({ action: 'theatre.approve' })).toBe(1)
  })

  it('unknown ID → 404, bad ID → 400', async () => {
    expect((await admin.post(`/api/admin/theatres/${new mongoose.Types.ObjectId()}/approve`)).status).toBe(404)
    expect((await admin.post('/api/admin/theatres/abc/approve')).status).toBe(400)
  })
})
