import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

const EMAIL = 'test.user@example.com'

async function tokenFor(email = EMAIL) {
  return (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
}
const patchPrefs = (token, body) => {
  const req = request(app).patch('/api/me/prefs').send(body)
  return token ? req.set('Authorization', `Bearer ${token}`) : req
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

describe('prefs.theme starts empty (UI-02)', () => {
  it('a new user has theme null (= not chosen yet) in the database and in the API', async () => {
    await request(app).post('/api/auth/signup').send({ name: 'Asha', email: 'asha@example.com', password: TEST_PASSWORD })
    const user = await User.findOne({ email: 'asha@example.com' })
    expect(user.prefs.theme).toBeNull()

    await createUser()
    const { body } = await request(app).post('/api/auth/login').send({ email: EMAIL, password: TEST_PASSWORD })
    expect(body.user.prefs).toEqual({ theme: null, sound: false, reduceMotion: false })
  })
})

describe('PATCH /api/me/prefs (UI-02)', () => {
  it('saves the theme and answers with the updated user', async () => {
    await createUser()
    const res = await patchPrefs(await tokenFor(), { theme: 'night' })

    expect(res.status).toBe(200)
    expect(res.body.user.prefs.theme).toBe('night')
    expect((await User.findOne({ email: EMAIL })).prefs.theme).toBe('night')
  })

  it('changes only the sent fields', async () => {
    await createUser({ prefs: { theme: 'day', sound: true, reduceMotion: false } })
    const res = await patchPrefs(await tokenFor(), { reduceMotion: true })
    expect(res.body.user.prefs).toEqual({ theme: 'day', sound: true, reduceMotion: true })
  })

  it('refuses wrong values and an empty body (400)', async () => {
    await createUser()
    const token = await tokenFor()
    for (const body of [{ theme: 'dark' }, { theme: null }, { sound: 'yes' }, {}, { other: 1 }]) {
      const res = await patchPrefs(token, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
    expect((await User.findOne({ email: EMAIL })).prefs.theme).toBeNull()
  })

  it('needs a login (401)', async () => {
    expect((await patchPrefs(null, { theme: 'day' })).status).toBe(401)
  })

  it('works for every role', async () => {
    await createUser({ email: 'owner@example.com', role: 'owner', phone: '9876543210', owner: { businessName: 'B', approvalStatus: 'pending' } })
    await createUser({ email: 'staff@example.com', role: 'staff', staff: { ownerId: (await User.findOne())._id, theatreIds: [] } })
    await createUser({ email: 'admin@example.com', role: 'admin' })
    for (const email of ['owner@example.com', 'staff@example.com', 'admin@example.com']) {
      const res = await patchPrefs(await tokenFor(email), { theme: 'day' })
      expect(res.status, email).toBe(200)
    }
  })
})
