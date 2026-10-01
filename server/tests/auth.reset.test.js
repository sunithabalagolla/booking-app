import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { sendEmail } from '../src/services/email/index.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// Catch emails instead of printing them, so tests can read the reset link
vi.mock('../src/services/email/index.js', () => ({ sendEmail: vi.fn() }))

const EMAIL = 'test.user@example.com'
const NEW_PASSWORD = 'secondshow42'

// The token from the last reset email that was "sent"
function lastResetToken() {
  const { text } = sendEmail.mock.calls.at(-1)[0]
  return new URL(text.match(/https?:\/\/\S+/)[0]).searchParams.get('token')
}

const forgot = (email = EMAIL) => request(app).post('/api/auth/forgot-password').send({ email })
const reset = (token, password = NEW_PASSWORD) => request(app).post('/api/auth/reset-password').send({ token, password })
const login = (password) => request(app).post('/api/auth/login').send({ email: EMAIL, password })

// Ask for a link and return its token
async function getResetToken(email = EMAIL) {
  await forgot(email)
  return lastResetToken()
}

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

describe('POST /api/auth/forgot-password (U-03)', () => {
  it('sends E-02 with a 30 minute link, stored only as a hash', async () => {
    const user = await createUser()
    const res = await forgot('Test.User@Example.com ')

    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe(EMAIL)
    expect(sendEmail.mock.calls[0][0].text).toContain('/reset-password?token=')

    const saved = await AuthToken.findOne({ userId: user._id, type: 'reset_password' })
    expect(saved.tokenHash).not.toBe(lastResetToken())
    const minutesLeft = (saved.expiresAt - Date.now()) / 60000
    expect(minutesLeft).toBeGreaterThan(29.9)
    expect(minutesLeft).toBeLessThanOrEqual(30)
  })

  it('answers the same for an unknown email and sends nothing', async () => {
    await createUser()
    const known = await forgot()
    const unknown = await forgot('nobody@example.com')

    expect(unknown.status).toBe(200)
    expect(unknown.body).toEqual(known.body)
    expect(sendEmail).toHaveBeenCalledTimes(1) // only for the known email
  })

  it('sends nothing for a blocked account', async () => {
    await createUser({ status: 'blocked' })
    const res = await forgot()
    expect(res.status).toBe(200)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('works for all 4 roles', async () => {
    for (const role of ['user', 'owner', 'staff', 'admin']) {
      await createUser({ email: `${role}@example.com`, role })
      await forgot(`${role}@example.com`)
    }
    expect(sendEmail).toHaveBeenCalledTimes(4)
  })

  it('allows 3 requests per hour per email, then 429 (SEC-03)', async () => {
    await createUser()
    for (let i = 0; i < 3; i++) expect((await forgot()).status).toBe(200)
    const fourth = await forgot()
    expect(fourth.status).toBe(429)
    expect(fourth.body.error.code).toBe('RATE_LIMITED')
  })
})

describe('POST /api/auth/reset-password (U-03)', () => {
  it('changes the password: old one fails, new one works', async () => {
    await createUser()
    const res = await reset(await getResetToken())

    expect(res.status).toBe(200)
    expect((await login(TEST_PASSWORD)).status).toBe(401)
    expect((await login(NEW_PASSWORD)).status).toBe(200)
  })

  it('logs out all devices (old refresh tokens stop working)', async () => {
    await createUser()
    const first = await login(TEST_PASSWORD)
    const cookie = first.headers['set-cookie'].find((c) => c.startsWith('talkies_rt=')).split(';')[0]

    await reset(await getResetToken())

    expect(await AuthToken.countDocuments({ type: 'refresh' })).toBe(0)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', [cookie])
    expect(res.status).toBe(401)
  })

  it('refuses an access token made before the reset at once (401 TOKEN_EXPIRED)', async () => {
    const user = await createUser()
    // A token from another device, made a minute ago and not expired yet
    const oldToken = jwt.sign(
      { role: 'user', iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_ACCESS_SECRET,
      { subject: String(user._id), expiresIn: '15m' },
    )
    const me = (token) => request(app).get('/api/me').set('Authorization', `Bearer ${token}`)
    expect((await me(oldToken)).status).toBe(200)

    await reset(await getResetToken())

    const refused = await me(oldToken)
    expect(refused.status).toBe(401)
    expect(refused.body.error.code).toBe('TOKEN_EXPIRED')
    expect((await User.findById(user._id)).passwordChangedAt).toBeInstanceOf(Date)

    // A login right after the reset (same second) still works
    const { accessToken } = (await login(NEW_PASSWORD)).body
    expect((await me(accessToken)).status).toBe(200)
  })

  it('works only once', async () => {
    await createUser()
    const token = await getResetToken()
    expect((await reset(token)).status).toBe(200)

    const again = await reset(token, 'thirdshow99')
    expect(again.status).toBe(400)
    expect(again.body.error.details.reason).toBe('link_invalid')
    expect((await login(NEW_PASSWORD)).status).toBe(200) // second try changed nothing
  })

  it('only the newest link works', async () => {
    await createUser()
    const oldToken = await getResetToken()
    const newToken = await getResetToken()

    expect((await reset(oldToken)).status).toBe(400)
    expect((await reset(newToken)).status).toBe(200)
  })

  it('refuses an expired link', async () => {
    await createUser()
    const token = await getResetToken()
    await AuthToken.updateOne({ type: 'reset_password' }, { expiresAt: new Date(Date.now() - 1000) })

    const res = await reset(token)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('link_expired')
    expect((await login(TEST_PASSWORD)).status).toBe(200) // password unchanged
  })

  it('refuses a password that breaks BR-18 and keeps the link usable', async () => {
    await createUser()
    const token = await getResetToken()

    const weak = await reset(token, 'onlyletters')
    expect(weak.status).toBe(400)
    expect(weak.body.error.code).toBe('VALIDATION_ERROR')
    expect((await reset(token)).status).toBe(200)
  })

  it('also marks the email as verified', async () => {
    await createUser({ emailVerified: false })
    await reset(await getResetToken())

    const user = await User.findOne({ email: EMAIL })
    expect(user.emailVerified).toBe(true)
    expect((await login(NEW_PASSWORD)).status).toBe(200)
  })

  it('refuses the link when the account was blocked after the email was sent', async () => {
    const user = await createUser()
    const token = await getResetToken()
    await User.updateOne({ _id: user._id }, { status: 'blocked' })

    const res = await reset(token)
    expect(res.status).toBe(400)
    expect(res.body.error.details.reason).toBe('link_invalid')
  })
})
