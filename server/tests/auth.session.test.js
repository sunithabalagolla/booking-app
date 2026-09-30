import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

const EMAIL = 'test.user@example.com'

const login = (email = EMAIL, password = TEST_PASSWORD) => request(app).post('/api/auth/login').send({ email, password })
const refresh = (cookie) => request(app).post('/api/auth/refresh').set('Cookie', cookie ? [cookie] : [])
const logout = (cookie) => request(app).post('/api/auth/logout').set('Cookie', cookie ? [cookie] : [])
const me = (token) => {
  const req = request(app).get('/api/me')
  return token ? req.set('Authorization', `Bearer ${token}`) : req
}

// The refresh cookie from a response: the full Set-Cookie line and "name=value"
function refreshCookie(res) {
  const line = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('talkies_rt='))
  return line && { line, pair: line.split(';')[0] }
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

describe('POST /api/auth/login (U-02)', () => {
  it('logs in: access token + user in the body, refresh token in a safe cookie', async () => {
    await createUser()
    const res = await login('Test.User@Example.com ')

    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: EMAIL, role: 'user' })
    expect(JSON.stringify(res.body)).not.toContain('passwordHash')

    // Access token: 15 minutes, only user ID + role (BR-19)
    const payload = jwt.decode(res.body.accessToken)
    expect(payload.role).toBe('user')
    expect(payload.exp - payload.iat).toBe(15 * 60)

    // Refresh cookie (SEC-02)
    const { line } = refreshCookie(res)
    expect(line).toMatch(/HttpOnly/i)
    expect(line).toMatch(/SameSite=Strict/i)
    expect(line).toMatch(/Path=\/api\/auth/)
    expect(line).toMatch(/Max-Age=604800/) // 7 days

    // Stored only as a hash
    const saved = await AuthToken.findOne({ type: 'refresh' })
    expect(line).not.toContain(saved.tokenHash)
  })

  it('gives the same 401 for a wrong password and for an unknown email', async () => {
    await createUser()
    const wrongPassword = await login(EMAIL, 'wrongpass1')
    const unknownEmail = await login('nobody@example.com')

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_LOGIN')
      expect(refreshCookie(res)).toBeUndefined()
    }
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message)
  })

  it('refuses an account that is not verified yet (403)', async () => {
    await createUser({ emailVerified: false })
    const res = await login()
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('refuses a blocked account (403)', async () => {
    await createUser({ status: 'blocked' })
    const res = await login()
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })

  it('refuses a deleted account like a wrong login', async () => {
    await createUser({ deletedAt: new Date() })
    expect((await login()).body.error.code).toBe('INVALID_LOGIN')
  })

  it('BR-17: after 5 wrong logins, even the right password is refused (429)', async () => {
    await createUser()
    for (let i = 0; i < 5; i++) {
      expect((await login(EMAIL, 'wrongpass1')).status).toBe(401)
    }
    const sixth = await login()
    expect(sixth.status).toBe(429)
    expect(sixth.body.error.code).toBe('RATE_LIMITED')
  })

  it('BR-17: correct logins do not count', async () => {
    await createUser()
    for (let i = 0; i < 4; i++) await login(EMAIL, 'wrongpass1')
    for (let i = 0; i < 5; i++) expect((await login()).status).toBe(200)
    expect((await login(EMAIL, 'wrongpass1')).status).toBe(401) // 5th wrong one
    expect((await login()).status).toBe(429)
  })
})

describe('POST /api/auth/refresh (U-02)', () => {
  it('gives a new access token and a new cookie; the old cookie stops working (rotation)', async () => {
    await createUser()
    const first = refreshCookie(await login()).pair

    const res = await refresh(first)
    expect(res.status).toBe(200)
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user.email).toBe(EMAIL)
    const second = refreshCookie(res).pair
    expect(second).not.toBe(first)

    expect((await refresh(first)).status).toBe(401) // old one used up
    expect((await refresh(second)).status).toBe(200)
  })

  it('refuses no cookie, a made-up cookie and an expired one', async () => {
    await createUser()
    expect((await refresh()).status).toBe(401)
    expect((await refresh('talkies_rt=made-up-value')).status).toBe(401)

    const cookie = refreshCookie(await login()).pair
    await AuthToken.updateOne({ type: 'refresh' }, { expiresAt: new Date(Date.now() - 1000) })
    const res = await refresh(cookie)
    expect(res.status).toBe(401)
    expect(refreshCookie(res).line).toMatch(/Expires=Thu, 01 Jan 1970/) // cookie cleared
  })

  it('refuses when the user was blocked after login', async () => {
    const user = await createUser()
    const cookie = refreshCookie(await login()).pair
    await User.updateOne({ _id: user._id }, { status: 'blocked' })
    expect((await refresh(cookie)).status).toBe(401)
  })
})

describe('POST /api/auth/logout (U-02)', () => {
  it('deletes the refresh token and clears the cookie', async () => {
    await createUser()
    const cookie = refreshCookie(await login()).pair

    const res = await logout(cookie)
    expect(res.status).toBe(204)
    expect(refreshCookie(res).line).toMatch(/Expires=Thu, 01 Jan 1970/)
    expect(await AuthToken.countDocuments({ type: 'refresh' })).toBe(0)
    expect((await refresh(cookie)).status).toBe(401)
  })

  it('works without a cookie too', async () => {
    expect((await logout()).status).toBe(204)
  })
})

describe('GET /api/me (requireAuth)', () => {
  it('returns the user with a valid access token', async () => {
    await createUser()
    const { accessToken } = (await login()).body
    const res = await me(accessToken)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(EMAIL)
  })

  it('401 UNAUTHORIZED without a token or with a changed token', async () => {
    await createUser()
    const { accessToken } = (await login()).body
    const [head, , sig] = accessToken.split('.')
    const fakeBody = Buffer.from(JSON.stringify({ ...jwt.decode(accessToken), role: 'admin' })).toString('base64url')

    for (const res of [await me(), await me(`${head}.${fakeBody}.${sig}`), await me('abc')]) {
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    }
  })

  it('401 TOKEN_EXPIRED for an expired token (the client then refreshes)', async () => {
    const user = await createUser()
    const expired = jwt.sign(
      { role: 'user', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_ACCESS_SECRET,
      { subject: String(user._id) },
    )
    const res = await me(expired)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('stops a user who was blocked after login, even with a valid token', async () => {
    const user = await createUser()
    const { accessToken } = (await login()).body
    await User.updateOne({ _id: user._id }, { status: 'blocked' })

    const res = await me(accessToken)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED')
  })
})
