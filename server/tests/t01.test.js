import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// T-01 (15.4): login, token refresh, role checks, end to end.
// More detail: auth.session.test.js, roles.test.js. Ownership on real
// endpoints is added here with O-03 (theatres).

const login = (email) => request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })
const get = (path, token) => request(app).get(path).set('Authorization', `Bearer ${token}`)
const refreshCookie = (res) => res.headers['set-cookie'].find((c) => c.startsWith('talkies_rt=')).split(';')[0]

async function createAll() {
  const owner = await createUser({
    email: 'owner@example.com',
    role: 'owner',
    phone: '9876543210',
    owner: { businessName: 'Ravi Talkies', approvalStatus: 'approved' },
  })
  await createUser({ email: 'user@example.com', role: 'user' })
  await createUser({
    email: 'pending@example.com',
    role: 'owner',
    phone: '9876543211',
    owner: { businessName: 'New Talkies', approvalStatus: 'pending' },
  })
  await createUser({ email: 'staff@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [new mongoose.Types.ObjectId()] } })
  await createUser({ email: 'admin@example.com', role: 'admin' })
}

beforeAll(async () => {
  await connectTestDB()
  await User.init()
  await AuthToken.init()
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createAll()
})
afterAll(closeTestDB)

describe('T-01 each role logs in and reaches only its own API group', () => {
  const groups = { owner: '/api/owner/x', staff: '/api/staff/x', admin: '/api/admin/x' }

  it.each(['user', 'owner', 'staff', 'admin'])('%s', async (role) => {
    const res = await login(`${role}@example.com`)
    expect(res.status).toBe(200)
    const token = res.body.accessToken

    const me = await get('/api/me', token)
    expect(me.body.user.role).toBe(role)

    for (const [groupRole, path] of Object.entries(groups)) {
      const answer = await get(path, token)
      // Own group: passes the checks and ends in 404 (no endpoints yet). Others: 403.
      expect(answer.status, `${role} on ${path}`).toBe(groupRole === role ? 404 : 403)
    }
  })

  it('a pending owner is refused everywhere: own group 403 OWNER_NOT_APPROVED, others 403 FORBIDDEN', async () => {
    const token = (await login('pending@example.com')).body.accessToken
    expect((await get('/api/owner/x', token)).body.error.code).toBe('OWNER_NOT_APPROVED')
    expect((await get('/api/staff/x', token)).body.error.code).toBe('FORBIDDEN')
    expect((await get('/api/admin/x', token)).body.error.code).toBe('FORBIDDEN')
  })
})

describe('T-01 the database decides, not the token', () => {
  it('an owner set back to pending after login is stopped on the next call', async () => {
    const token = (await login('owner@example.com')).body.accessToken
    expect((await get('/api/owner/x', token)).status).toBe(404) // passes now

    await User.updateOne({ email: 'owner@example.com' }, { 'owner.approvalStatus': 'rejected' })
    const res = await get('/api/owner/x', token)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_NOT_APPROVED')
  })

  it('a blocked admin is stopped on the role group at once (403 ACCOUNT_BLOCKED)', async () => {
    const token = (await login('admin@example.com')).body.accessToken
    await User.updateOne({ email: 'admin@example.com' }, { status: 'blocked' })
    const res = await get('/api/admin/x', token)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })
})

describe('T-01 token refresh race', () => {
  it('two refreshes at the same moment with the same cookie: exactly one wins', async () => {
    const cookie = refreshCookie(await login('user@example.com'))
    const refresh = () => request(app).post('/api/auth/refresh').set('Cookie', [cookie])

    const results = await Promise.all([refresh(), refresh(), refresh()])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 401, 401])
    expect(await AuthToken.countDocuments({ type: 'refresh' })).toBe(1) // only the winner's new token
  })
})
