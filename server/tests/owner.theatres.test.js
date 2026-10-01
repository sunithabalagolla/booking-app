import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-03 owner theatres + T-01 ownership on real endpoints (ROLE-02)

const good = {
  name: 'Chandni Talkies',
  cityCode: 'hyderabad',
  address: '12 Station Road, Secunderabad, Hyderabad 500003',
  mapLink: 'https://maps.example.com/chandni',
  photos: ['/api/uploads/files/theatre-1.png'],
  gstin: '36AABCS1234A1Z5', // 36 = Telangana
  amenities: { wheelchairAccess: true, parking: false },
}

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
})

let phone = 9100000000
const makeOwner = (email, approvalStatus = 'approved') =>
  createUser({ email, role: 'owner', phone: String(phone++), owner: { businessName: 'B', approvalStatus } })

let ravi
beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), Theatre.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await Settings.create({ _id: 'platform', cities: CITIES })
  await makeOwner('ravi@example.com')
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/owner/theatres (O-03)', () => {
  it('adds a theatre that starts Pending, with the city name and state from settings', async () => {
    const res = await ravi.post('/api/owner/theatres', good)
    expect(res.status).toBe(201)
    expect(res.body.theatre).toMatchObject({
      name: 'Chandni Talkies',
      status: 'pending',
      city: { code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
      amenities: { wheelchairAccess: true, parking: false },
      photos: good.photos,
    })
  })

  it('ignores a status sent by the owner (always Pending, ROLE-04)', async () => {
    const res = await ravi.post('/api/owner/theatres', { ...good, status: 'approved' })
    expect(res.body.theatre.status).toBe('pending')
  })

  it('refuses each broken rule', async () => {
    const cases = [
      ['name', { name: '' }],
      ['cityCode', { cityCode: 'gotham' }], // not in the city list
      ['address', { address: 'abc' }],
      ['mapLink', { mapLink: 'http://maps.example.com' }],
      ['photos', { photos: Array(7).fill('/api/uploads/files/x.png') }],
      ['gstin', { gstin: '36AABCS1234A1Z' }],
      ['gstin', { gstin: '33AABCS1234A1Z5' }], // Tamil Nadu GSTIN for a Hyderabad theatre
    ]
    for (const [field, change] of cases) {
      const res = await ravi.post('/api/owner/theatres', { ...good, ...change })
      expect(res.status, JSON.stringify(change)).toBe(400)
      expect(Object.keys(res.body.error.details).some((k) => k.startsWith(field)), JSON.stringify(change)).toBe(true)
    }
    expect(await Theatre.countDocuments()).toBe(0)
  })

  it('the GSTIN state message tells which code is needed', async () => {
    const res = await ravi.post('/api/owner/theatres', { ...good, gstin: '33AABCS1234A1Z5' })
    expect(res.body.error.details.gstin).toMatch(/starts with 36/)
  })

  it('only approved owners (pending → 403 OWNER_NOT_APPROVED)', async () => {
    await makeOwner('new@example.com', 'pending')
    const res = await as(await login('new@example.com')).post('/api/owner/theatres', good)
    expect(res.body.error.code).toBe('OWNER_NOT_APPROVED')
  })
})

describe('PATCH /api/owner/theatres/:id (O-03 edit rules)', () => {
  let id
  beforeEach(async () => {
    id = (await ravi.post('/api/owner/theatres', good)).body.theatre.id
  })

  it('pending: every field can change; an empty map link removes it; amenities change one by one', async () => {
    const res = await ravi.patch(`/api/owner/theatres/${id}`, { cityCode: 'chennai', gstin: '33AABCS1234A1Z5', mapLink: '', amenities: { parking: true } })
    expect(res.status).toBe(200)
    expect(res.body.theatre).toMatchObject({ city: { code: 'chennai' }, gstin: '33AABCS1234A1Z5', mapLink: null, amenities: { wheelchairAccess: true, parking: true } })
  })

  it('a new city is checked against the old GSTIN too', async () => {
    const res = await ravi.patch(`/api/owner/theatres/${id}`, { cityCode: 'chennai' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.gstin).toMatch(/Tamil Nadu/)
  })

  it('approved: city and GSTIN are locked; other fields still change', async () => {
    await Theatre.updateOne({ _id: id }, { status: 'approved' })
    for (const change of [{ cityCode: 'chennai', gstin: '33AABCS1234A1Z5' }, { gstin: '36AABCS9999A1Z5' }]) {
      const res = await ravi.patch(`/api/owner/theatres/${id}`, change)
      expect(res.status).toBe(400)
      expect(res.body.error.details.reason).toBe('locked_after_approval')
    }
    // Sending the same city / GSTIN again is fine
    const res = await ravi.patch(`/api/owner/theatres/${id}`, { name: 'Chandni 70mm', cityCode: 'hyderabad', gstin: good.gstin })
    expect(res.status).toBe(200)
    expect(res.body.theatre).toMatchObject({ name: 'Chandni 70mm', status: 'approved' })
  })

  it('rejected: an edit sends it back to Pending and removes the reason', async () => {
    await Theatre.updateOne({ _id: id }, { status: 'rejected', rejectReason: 'Photos missing' })
    const res = await ravi.patch(`/api/owner/theatres/${id}`, { photos: ['/api/uploads/files/theatre-2.png'] })
    expect(res.body.theatre).toMatchObject({ status: 'pending', rejectReason: null })
  })
})

describe('T-01 ownership on the theatre endpoints (ROLE-02)', () => {
  let ravisTheatre
  beforeEach(async () => {
    ravisTheatre = (await ravi.post('/api/owner/theatres', good)).body.theatre.id
  })

  it("another owner cannot see or edit Ravi's theatre (404, not 403)", async () => {
    await makeOwner('meena@example.com')
    const meena = as(await login('meena@example.com'))

    expect((await meena.get(`/api/owner/theatres/${ravisTheatre}`)).status).toBe(404)
    expect((await meena.patch(`/api/owner/theatres/${ravisTheatre}`, { name: 'Taken' })).status).toBe(404)
    expect((await meena.get('/api/owner/theatres')).body.items).toEqual([])
    expect((await Theatre.findById(ravisTheatre)).name).toBe('Chandni Talkies')
  })

  it('the owner sees only their own theatres, newest first', async () => {
    await ravi.post('/api/owner/theatres', { ...good, name: 'Second Hall' })
    const res = await ravi.get('/api/owner/theatres')
    expect(res.body.items.map((t) => t.name)).toEqual(['Second Hall', 'Chandni Talkies'])
    expect((await ravi.get(`/api/owner/theatres/${ravisTheatre}`)).status).toBe(200)
  })

  it('an unknown ID is 404, a bad ID 400', async () => {
    expect((await ravi.get(`/api/owner/theatres/${new mongoose.Types.ObjectId()}`)).status).toBe(404)
    expect((await ravi.get('/api/owner/theatres/xyz')).status).toBe(400)
  })

  it('users, staff and admins get 403 on the owner group', async () => {
    await createUser({ email: 'admin@example.com', role: 'admin' })
    expect((await as(await login('admin@example.com')).get('/api/owner/theatres')).status).toBe(403)
  })
})

describe('GET /api/owner/cities', () => {
  it('gives the fixed city list for the form', async () => {
    const res = await ravi.get('/api/owner/cities')
    expect(res.body.cities).toHaveLength(10)
    expect(res.body.cities[0]).toEqual({ code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' })
  })
})
