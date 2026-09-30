import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { sendEmail } from '../src/services/email/index.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// Catch emails instead of printing them, so tests can read the verify link
vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn() }))

const good = { name: 'Asha Rao', email: 'Asha@Example.com', password: 'matinee123' }

// The token from the last verify email that was "sent"
function lastVerifyToken() {
  const { text } = sendEmail.mock.calls.at(-1)[0]
  return new URL(text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')
}

const signup = (body) => request(app).post('/api/auth/signup').send(body)
const verify = (token) => request(app).post('/api/auth/verify-email').send({ token })
const resend = (email) => request(app).post('/api/auth/resend-verify').send({ email })

beforeAll(async () => {
  await connectTestDB()
  await User.init() // make sure the unique email index exists
  await AuthToken.init()
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  sendEmail.mockClear()
})
afterAll(closeTestDB)

describe('POST /api/auth/signup (U-01)', () => {
  it('creates an unverified user with a hashed password and sends the verify email', async () => {
    const res = await signup(good)

    expect(res.status).toBe(201)
    expect(res.body.email).toBe('asha@example.com')

    const user = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash')
    expect(user.role).toBe('user')
    expect(user.emailVerified).toBe(false)
    expect(user.passwordHash).not.toBe(good.password)
    expect(await bcrypt.compare(good.password, user.passwordHash)).toBe(true) // SEC-01

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('asha@example.com')

    // Only the hash of the link token is stored
    const token = lastVerifyToken()
    const saved = await AuthToken.findOne({ userId: user._id, type: 'verify_email' })
    expect(saved.tokenHash).not.toBe(token)
    expect(saved.expiresAt - Date.now()).toBeGreaterThan(23.9 * 60 * 60 * 1000) // about 24 h
  })

  it('never sends the password hash back', async () => {
    const res = await signup(good)
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')
  })

  it('refuses an email that already has an account (409)', async () => {
    await signup(good)
    const res = await signup({ ...good, email: 'asha@example.com ' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
    expect(await User.countDocuments()).toBe(1)
  })

  it.each([
    ['too short', 'abc1234'],
    ['no number', 'matineeshow'],
    ['no letter', '12345678'],
  ])('refuses a password that breaks BR-18 (%s)', async (_label, password) => {
    const res = await signup({ ...good, password })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.password).toBeTruthy()
  })

  it('refuses a bad email and an empty name', async () => {
    const res = await signup({ ...good, email: 'not-an-email', name: '  ' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.error.details).sort()).toEqual(['email', 'name'])
  })

  it('refuses keys with $ (SEC-06)', async () => {
    const res = await signup({ ...good, email: { $gt: '' } })
    expect(res.status).toBe(400)
    expect(await User.countDocuments()).toBe(0)
  })

  it('ignores extra fields like role (nobody can sign up as admin)', async () => {
    await signup({ ...good, role: 'admin', emailVerified: true })
    const user = await User.findOne({ email: 'asha@example.com' })
    expect(user.role).toBe('user')
    expect(user.emailVerified).toBe(false)
  })

  it('answers errors in the api.md shape with a request ID', async () => {
    const res = await signup({})
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', requestId: res.headers['x-request-id'] })
  })
})

describe('POST /api/auth/verify-email (U-01)', () => {
  it('verifies the account, and the link works only once', async () => {
    await signup(good)
    const token = lastVerifyToken()

    const first = await verify(token)
    expect(first.status).toBe(200)
    expect((await User.findOne({ email: 'asha@example.com' })).emailVerified).toBe(true)

    // Opening the same link again is fine and says "already verified"
    const again = await verify(token)
    expect(again.status).toBe(200)
    expect(again.body.alreadyVerified).toBe(true)
  })

  it('refuses a link after 24 hours', async () => {
    await signup(good)
    const token = lastVerifyToken()
    await AuthToken.updateOne({ type: 'verify_email' }, { expiresAt: new Date(Date.now() - 1000) })

    const res = await verify(token)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('link_expired')
    expect((await User.findOne({ email: 'asha@example.com' })).emailVerified).toBe(false)
  })

  it('refuses a made-up link', async () => {
    const res = await verify('this-token-does-not-exist-at-all')
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('link_invalid')
  })
})

describe('POST /api/auth/resend-verify (U-01)', () => {
  it('sends a new link, and the old link stops working', async () => {
    await signup(good)
    const oldToken = lastVerifyToken()

    const res = await resend('ASHA@example.com')
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(2)
    const newToken = lastVerifyToken()
    expect(newToken).not.toBe(oldToken)

    expect((await verify(oldToken)).status).toBe(400)
    expect((await verify(newToken)).status).toBe(200)
  })

  it('answers the same for an unknown email and sends nothing', async () => {
    const res = await resend('nobody@example.com')
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends nothing when the email is already verified', async () => {
    await signup(good)
    await verify(lastVerifyToken())
    sendEmail.mockClear()

    await resend(good.email)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('allows max 3 resends per hour per email (SEC-03)', async () => {
    await signup(good)
    for (let i = 0; i < 3; i++) {
      expect((await resend(good.email)).status).toBe(200)
    }
    const fourth = await resend(good.email)
    expect(fourth.status).toBe(429)
    expect(fourth.body.error.code).toBe('RATE_LIMITED')

    // Another email still works
    expect((await resend('someone.else@example.com')).status).toBe(200)
  })
})
