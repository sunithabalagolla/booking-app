import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

const STAFF_EMAIL = 'gate.staff@example.com'
const login = (email = STAFF_EMAIL) => request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })

// Staff are made by owners in O-09 (Phase 7); here straight in the database
async function createStaff(fields = {}) {
  const owner = await createUser({
    email: 'owner@example.com',
    role: 'owner',
    phone: '9876543210',
    owner: { businessName: 'Ravi Talkies', approvalStatus: 'approved' },
  })
  const theatreId = new mongoose.Types.ObjectId()
  const staff = await createUser({
    email: STAFF_EMAIL,
    name: 'Gate Staff',
    role: 'staff',
    staff: { ownerId: owner._id, theatreIds: [theatreId] },
    ...fields,
  })
  return { staff, owner, theatreId }
}

beforeAll(async () => {
  await connectTestDB()
  await User.init()
  await AuthToken.init()
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
})
afterAll(closeTestDB)

describe('S-01 staff login (same POST /api/auth/login)', () => {
  it('logs in a staff account with its theatres', async () => {
    const { theatreId } = await createStaff()
    const res = await login()

    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user).toMatchObject({ role: 'staff', staff: { theatreIds: [String(theatreId)] } })

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${res.body.accessToken}`)
    expect(me.status).toBe(200)
    expect(me.body.user.role).toBe('staff')
  })

  it('does not send the owner ID, the password hash or user-only fields', async () => {
    await createStaff()
    const { user } = (await login()).body
    expect(user.staff).toEqual({ theatreIds: expect.any(Array) })
    const text = JSON.stringify(user)
    expect(text).not.toContain('ownerId')
    expect(text).not.toContain('passwordHash')
    expect(user.badges).toBeUndefined()
  })

  it('refuses a blocked staff account (403 ACCOUNT_BLOCKED)', async () => {
    await createStaff({ status: 'blocked' })
    const res = await login()
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })
})
