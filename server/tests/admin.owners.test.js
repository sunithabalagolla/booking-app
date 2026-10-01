import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { sendEmail } from '../src/services/email/index.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// A-03 owner approvals, owner block / unblock, ROLE-05 (blocked owner stops their staff)

vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn() }))

const login = (email) => request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })
let adminToken
const admin = {
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${adminToken}`),
  post: (path, body = {}) => request(app).post(path).set('Authorization', `Bearer ${adminToken}`).send(body),
}

let phone = 9000000000
const makeOwner = (email, fields = {}) =>
  createUser({
    email,
    name: fields.name ?? 'Owner',
    role: 'owner',
    phone: String(phone++),
    ...fields,
    owner: { businessName: fields.businessName ?? 'Talkies Pvt Ltd', approvalStatus: fields.approvalStatus ?? 'pending', ...fields.owner },
  })

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), AuditLog.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockClear()
  await createUser({ email: 'admin@example.com', name: 'Asha Admin', role: 'admin' })
  adminToken = (await login('admin@example.com')).body.accessToken
})
afterAll(closeTestDB)

describe('GET /api/admin/owners (A-03)', () => {
  beforeEach(async () => {
    // Made one after another, so createdAt goes up
    await makeOwner('first@example.com', { name: 'Ravi', businessName: 'Ravi Talkies' })
    await makeOwner('second@example.com', { name: 'Meena', businessName: 'Sri Lakshmi Cinemas', emailVerified: false })
    await makeOwner('done@example.com', { name: 'Old', businessName: 'Old Talkies', approvalStatus: 'approved' })
    await createUser({ email: 'user@example.com', role: 'user' }) // not an owner
  })

  it('pending: oldest first, with the email-verified mark; never users', async () => {
    const res = await admin.get('/api/admin/owners?approvalStatus=pending')
    expect(res.body.total).toBe(2)
    expect(res.body.items.map((o) => [o.email, o.emailVerified])).toEqual([
      ['first@example.com', true],
      ['second@example.com', false],
    ])
    expect(res.body.items[0]).toMatchObject({ businessName: 'Ravi Talkies', approvalStatus: 'pending', status: 'active', rejectReason: null })
  })

  it('all owners: newest first', async () => {
    const res = await admin.get('/api/admin/owners')
    expect(res.body.items.map((o) => o.email)).toEqual(['done@example.com', 'second@example.com', 'first@example.com'])
  })

  it('searches the start of name, email or business name, any case', async () => {
    expect((await admin.get('/api/admin/owners?q=sri')).body.items.map((o) => o.email)).toEqual(['second@example.com'])
    expect((await admin.get('/api/admin/owners?q=RAVI')).body.total).toBe(1)
    expect((await admin.get('/api/admin/owners?q=talkies')).body.total).toBe(0) // start only, not the middle
    expect((await admin.get('/api/admin/owners?q=old@')).body.total).toBe(0)
  })

  it('is admin only', async () => {
    const ownerToken = (await login('done@example.com')).body.accessToken
    expect((await request(app).get('/api/admin/owners').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(403)
  })
})

describe('approve / reject', () => {
  it('approve: saves who and when, audit entry, E-09 email; the owner API opens at once', async () => {
    const owner = await makeOwner('ravi@example.com', { name: 'Ravi', businessName: 'Ravi Talkies' })
    const ownerToken = (await login('ravi@example.com')).body.accessToken
    expect((await request(app).get('/api/owner/x').set('Authorization', `Bearer ${ownerToken}`)).body.error.code).toBe('OWNER_NOT_APPROVED')

    const res = await admin.post(`/api/admin/owners/${owner._id}/approve`)
    expect(res.status).toBe(200)
    expect(res.body.owner).toMatchObject({ approvalStatus: 'approved', decidedBy: { name: 'Asha Admin' } })
    expect(res.body.owner.decidedAt).toBeTruthy()

    const audit = await AuditLog.findOne({ action: 'owner.approve' })
    expect(String(audit.targetId)).toBe(String(owner._id))
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'ravi@example.com', subject: 'Talkies – your owner account is approved' })

    // Same access token: the owner group now passes (ends in 404, no endpoints yet)
    expect((await request(app).get('/api/owner/x').set('Authorization', `Bearer ${ownerToken}`)).status).toBe(404)
  })

  it('reject: reason required (5–500 characters), saved, audited and emailed', async () => {
    const owner = await makeOwner('ravi@example.com')
    for (const body of [{}, { reason: 'no' }, { reason: 'x'.repeat(501) }]) {
      expect((await admin.post(`/api/admin/owners/${owner._id}/reject`, body)).status).toBe(400)
    }

    const res = await admin.post(`/api/admin/owners/${owner._id}/reject`, { reason: '  No GSTIN in the papers  ' })
    expect(res.body.owner).toMatchObject({ approvalStatus: 'rejected', rejectReason: 'No GSTIN in the papers' })
    expect((await AuditLog.findOne({ action: 'owner.reject' })).details).toEqual({ reason: 'No GSTIN in the papers' })
    expect(sendEmail.mock.calls[0][0].text).toContain('Reason: No GSTIN in the papers')

    // The owner sees the reason on login (waiting page)
    expect((await login('ravi@example.com')).body.user.owner).toMatchObject({ approvalStatus: 'rejected', rejectReason: 'No GSTIN in the papers' })
  })

  it('a rejected owner can still be approved later; the old reason is removed', async () => {
    const owner = await makeOwner('ravi@example.com', { approvalStatus: 'rejected', owner: { rejectReason: 'Missing papers' } })
    const res = await admin.post(`/api/admin/owners/${owner._id}/approve`)
    expect(res.body.owner).toMatchObject({ approvalStatus: 'approved', rejectReason: null })
  })

  it('refuses: approving twice, rejecting an approved or rejected owner (already_decided)', async () => {
    const approved = await makeOwner('a@example.com', { approvalStatus: 'approved' })
    const rejected = await makeOwner('r@example.com', { approvalStatus: 'rejected', owner: { rejectReason: 'Old reason' } })
    for (const [path, body] of [
      [`/api/admin/owners/${approved._id}/approve`, {}],
      [`/api/admin/owners/${approved._id}/reject`, { reason: 'Changed my mind' }],
      [`/api/admin/owners/${rejected._id}/reject`, { reason: 'Again please' }],
    ]) {
      const res = await admin.post(path, body)
      expect(res.status, path).toBe(400)
      expect(res.body.error.details.reason).toBe('already_decided')
    }
    expect(sendEmail).not.toHaveBeenCalled()
    expect(await AuditLog.countDocuments()).toBe(0)
  })

  it('cannot approve an owner whose email is not verified', async () => {
    const owner = await makeOwner('new@example.com', { emailVerified: false })
    const res = await admin.post(`/api/admin/owners/${owner._id}/approve`)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('email_not_verified')
  })

  it('a user ID, an unknown ID → 404; a bad ID → 400', async () => {
    const user = await createUser({ email: 'user@example.com', role: 'user' })
    expect((await admin.post(`/api/admin/owners/${user._id}/approve`)).status).toBe(404)
    expect((await admin.post(`/api/admin/owners/${new mongoose.Types.ObjectId()}/approve`)).status).toBe(404)
    expect((await admin.post('/api/admin/owners/abc/approve')).status).toBe(400)
  })

  it('two admins approve at the same moment: one wins, one email, one audit entry', async () => {
    const owner = await makeOwner('ravi@example.com')
    const results = await Promise.all([admin.post(`/api/admin/owners/${owner._id}/approve`), admin.post(`/api/admin/owners/${owner._id}/approve`)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 400])
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(await AuditLog.countDocuments({ action: 'owner.approve' })).toBe(1)
  })
})

describe('block / unblock owners (A-03) and their Gate Staff (ROLE-05)', () => {
  let owner, ownerLogin, staffLogin
  beforeEach(async () => {
    owner = await makeOwner('ravi@example.com', { approvalStatus: 'approved' })
    await createUser({ email: 'staff@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [] } })
    ownerLogin = await login('ravi@example.com')
    staffLogin = await login('staff@example.com')
  })
  const cookieOf = (res) => res.headers['set-cookie'].find((c) => c.startsWith('talkies_rt=')).split(';')[0]
  const me = (token) => request(app).get('/api/me').set('Authorization', `Bearer ${token}`)

  it('blocking stops the owner and their staff at once: every request, refresh and new logins', async () => {
    const res = await admin.post(`/api/admin/users/${owner._id}/block`, { reason: 'Fake documents' })
    expect(res.status).toBe(200)
    expect(res.body.owner.status).toBe('blocked')
    expect((await AuditLog.findOne({ action: 'user.block' })).details).toEqual({ reason: 'Fake documents' })

    // Every request (old access tokens)
    expect((await me(ownerLogin.body.accessToken)).body.error.code).toBe('ACCOUNT_BLOCKED')
    const staffMe = await me(staffLogin.body.accessToken)
    expect(staffMe.status).toBe(403)
    expect(staffMe.body.error.message).toMatch(/owner's account is blocked/)

    // Refresh: logged out (refresh tokens deleted)
    for (const loginRes of [ownerLogin, staffLogin]) {
      expect((await request(app).post('/api/auth/refresh').set('Cookie', [cookieOf(loginRes)])).status).toBe(401)
    }
    expect(await AuthToken.countDocuments({ type: 'refresh' })).toBe(1) // only the admin's

    // New logins
    expect((await login('ravi@example.com')).body.error.code).toBe('ACCOUNT_BLOCKED')
    expect((await login('staff@example.com')).body.error.code).toBe('ACCOUNT_BLOCKED')
  })

  it('unblocking lets them log in again (audited); blocking twice changes nothing more', async () => {
    await admin.post(`/api/admin/users/${owner._id}/block`)
    await admin.post(`/api/admin/users/${owner._id}/block`)
    expect(await AuditLog.countDocuments({ action: 'user.block' })).toBe(1)

    const res = await admin.post(`/api/admin/users/${owner._id}/unblock`)
    expect(res.body.owner.status).toBe('active')
    expect(await AuditLog.countDocuments({ action: 'user.unblock' })).toBe(1)
    expect((await login('ravi@example.com')).status).toBe(200)
    expect((await login('staff@example.com')).status).toBe(200)
  })

  it('only owners for now (other users with A-07); unknown → 404', async () => {
    const user = await createUser({ email: 'user@example.com', role: 'user' })
    const res = await admin.post(`/api/admin/users/${user._id}/block`)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('owners_only')
    expect((await admin.post(`/api/admin/users/${new mongoose.Types.ObjectId()}/block`)).status).toBe(404)
  })
})
