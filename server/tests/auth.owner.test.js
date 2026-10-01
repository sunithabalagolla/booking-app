import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { sendEmail } from '../src/services/email/index.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// Catch emails instead of printing them, so tests can read the verify link
vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn() }))

const good = {
  name: 'Ravi Kumar',
  email: 'Ravi@Example.com',
  phone: '+919876543210',
  businessName: 'Ravi Talkies Pvt Ltd',
  password: 'matinee123',
}

function lastVerifyToken() {
  const { text } = sendEmail.mock.calls.at(-1)[0]
  return new URL(text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')
}

const ownerSignup = (body) => request(app).post('/api/auth/owner-signup').send(body)
const verify = (token) => request(app).post('/api/auth/verify-email').send({ token })
const login = () => request(app).post('/api/auth/login').send({ email: good.email, password: good.password })

beforeAll(async () => {
  await connectTestDB()
  await User.init()
  await AuthToken.init()
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockClear()
})
afterAll(closeTestDB)

describe('POST /api/auth/owner-signup (O-01)', () => {
  it('creates a pending, unverified owner and sends the verify email', async () => {
    const res = await ownerSignup(good)

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('ravi@example.com')

    const user = await User.findOne({ email: 'ravi@example.com' })
    expect(user.role).toBe('owner')
    expect(user.emailVerified).toBe(false)
    expect(user.phone).toBe('9876543210') // saved without +91
    expect(user.owner.businessName).toBe('Ravi Talkies Pvt Ltd')
    expect(user.owner.approvalStatus).toBe('pending')

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('ravi@example.com')
  })

  it('accepts a phone without +91', async () => {
    expect((await ownerSignup({ ...good, phone: '6123456789' })).status).toBe(201)
    expect((await User.findOne({ role: 'owner' })).phone).toBe('6123456789')
  })

  it('refuses a wrong phone number', async () => {
    for (const phone of ['5876543210', '987654321', '98765432100', '+91 98765 43210', '091987654321', '']) {
      resetRateLimits() // more than 5 tries in this test
      const res = await ownerSignup({ ...good, phone })
      expect(res.status, phone).toBe(400)
      expect(res.body.error.details.phone).toBeTruthy()
    }
    expect(await User.countDocuments()).toBe(0)
  })

  it('refuses a missing or too long business name', async () => {
    for (const businessName of [undefined, '   ', 'x'.repeat(121)]) {
      const res = await ownerSignup({ ...good, businessName })
      expect(res.status).toBe(400)
      expect(res.body.error.details.businessName).toBeTruthy()
    }
  })

  it('refuses an email that already has an account (409)', async () => {
    await request(app).post('/api/auth/signup').send({ name: 'Asha', email: good.email, password: good.password })
    const res = await ownerSignup(good)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('ignores extra fields like approvalStatus and role', async () => {
    await ownerSignup({ ...good, role: 'admin', approvalStatus: 'approved', owner: { approvalStatus: 'approved' } })
    const user = await User.findOne({ email: 'ravi@example.com' })
    expect(user.role).toBe('owner')
    expect(user.owner.approvalStatus).toBe('pending')
  })

  it('cannot log in before verifying; after verifying logs in as a pending owner', async () => {
    await ownerSignup(good)

    const before = await login()
    expect(before.status).toBe(403)
    expect(before.body.error.code).toBe('EMAIL_NOT_VERIFIED')

    expect((await verify(lastVerifyToken())).status).toBe(200)

    const after = await login()
    expect(after.status).toBe(200)
    expect(after.body.user).toMatchObject({
      role: 'owner',
      phone: '9876543210',
      owner: { businessName: 'Ravi Talkies Pvt Ltd', approvalStatus: 'pending', rejectReason: null },
    })
  })

  it('shares the 5 per hour sign up limit with user sign up (SEC-03)', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/signup').send({ name: 'A', email: `u${i}@example.com`, password: good.password })
    }
    for (let i = 0; i < 2; i++) {
      expect((await ownerSignup({ ...good, email: `o${i}@example.com` })).status).toBe(201)
    }
    const sixth = await ownerSignup({ ...good, email: 'o9@example.com' })
    expect(sixth.status).toBe(429)
    expect(sixth.body.error.code).toBe('RATE_LIMITED')
  })
})
