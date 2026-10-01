import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import usersStep, { SEED_LOGINS } from '../src/seed/steps/users.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

const SEED_PASSWORD = 'test-only-seed-pass1'

beforeAll(async () => {
  process.env.SEED_PASSWORD = SEED_PASSWORD
  await connectTestDB()
  await User.init()
  await AuthToken.init()
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
})
afterAll(closeTestDB)

describe('seed step: users (15.5)', () => {
  it('makes one sample login per role, and each can log in with SEED_PASSWORD', async () => {
    const lines = await usersStep.run()
    expect(lines.join('\n')).toContain(SEED_LOGINS.staff)
    expect(lines.join('\n')).not.toContain(SEED_PASSWORD) // never print the password

    for (const [role, email] of Object.entries(SEED_LOGINS)) {
      const res = await request(app).post('/api/auth/login').send({ email, password: SEED_PASSWORD })
      expect(res.status, role).toBe(200)
      expect(res.body.user.role).toBe(role)
    }

    const owner = await User.findOne({ email: SEED_LOGINS.owner })
    expect(owner.owner.approvalStatus).toBe('approved')
    const staff = await User.findOne({ email: SEED_LOGINS.staff })
    expect(String(staff.staff.ownerId)).toBe(String(owner._id))
    expect(await User.countDocuments({ isSample: true })).toBe(4)
  })

  it('can run twice without errors or duplicates', async () => {
    await usersStep.run()
    await usersStep.run()
    expect(await User.countDocuments()).toBe(4)
  })
})
