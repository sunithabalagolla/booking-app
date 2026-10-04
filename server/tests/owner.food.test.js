import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { FoodItem } from '../src/models/FoodItem.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-07 owner canteen items, with ownership checks (ROLE-02, T-01)

const good = { name: 'Butter Popcorn', photoUrl: '/api/uploads/files/food-1.png', pricePaise: 15000, isVeg: true }

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})

let phone = 9300000000
const makeOwner = (email) => createUser({ email, role: 'owner', phone: String(phone++), owner: { businessName: 'B', approvalStatus: 'approved' } })
const makeTheatre = (ownerId, status = 'approved') =>
  Theatre.create({ ownerId, name: `T ${phone++}`, cityCode: 'hyderabad', address: '12 Station Road, Hyderabad', gstin: '36AABCS1234A1Z5', status })

let ravi, raviTheatre, otherTheatre
beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), Theatre.init(), FoodItem.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await Settings.create({ _id: 'platform', cities: CITIES })
  const owner = await makeOwner('ravi@example.com')
  const other = await makeOwner('sita@example.com')
  raviTheatre = await makeTheatre(owner._id)
  otherTheatre = await makeTheatre(other._id)
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

const foodPath = (theatre) => `/api/owner/theatres/${theatre._id}/food`

describe('POST /api/owner/theatres/:id/food (O-07)', () => {
  it('adds an item: in stock and not a combo unless told', async () => {
    const res = await ravi.post(foodPath(raviTheatre), good)
    expect(res.status).toBe(201)
    expect(res.body.food).toMatchObject({ name: 'Butter Popcorn', pricePaise: 15000, isVeg: true, inStock: true, isCombo: false, photoUrl: good.photoUrl })
    const saved = await FoodItem.findById(res.body.food.id)
    expect(String(saved.ownerId)).toBe(String(raviTheatre.ownerId)) // copy from the theatre
  })

  it('photo is optional; combo and out of stock can be set', async () => {
    const res = await ravi.post(foodPath(raviTheatre), { name: 'Combo', pricePaise: 20000, isVeg: false, isCombo: true, inStock: false })
    expect(res.body.food).toMatchObject({ photoUrl: null, isVeg: false, isCombo: true, inStock: false })
  })

  it('pending and rejected theatres can have food too (decided 2026-10-04)', async () => {
    for (const status of ['pending', 'rejected']) {
      const theatre = await makeTheatre(raviTheatre.ownerId, status)
      expect((await ravi.post(foodPath(theatre), good)).status, status).toBe(201)
    }
  })

  it('refuses each broken rule (price: whole rupees ₹1–₹5,000)', async () => {
    const cases = [
      ['name', { name: '' }],
      ['name', { name: 'x'.repeat(61) }],
      ['pricePaise', { pricePaise: 0 }],
      ['pricePaise', { pricePaise: 99 }],
      ['pricePaise', { pricePaise: 4950 }], // ₹49.50: not whole rupees
      ['pricePaise', { pricePaise: 500100 }],
      ['pricePaise', { pricePaise: '150' }],
      ['isVeg', { isVeg: undefined }],
      ['photoUrl', { photoUrl: 'http://example.com/x.png' }],
    ]
    for (const [field, change] of cases) {
      const res = await ravi.post(foodPath(raviTheatre), { ...good, ...change })
      expect(res.status, JSON.stringify(change)).toBe(400)
      expect(Object.keys(res.body.error.details), JSON.stringify(change)).toContain(field)
    }
    expect((await ravi.post(foodPath(raviTheatre), { ...good, pricePaise: 500000 })).status).toBe(201) // ₹5,000 is fine
  })

  it('the same name twice in one canteen → 409 ALREADY_EXISTS; another theatre may use it', async () => {
    await ravi.post(foodPath(raviTheatre), good)
    const res = await ravi.post(foodPath(raviTheatre), good)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'ALREADY_EXISTS', details: { name: expect.any(String) } })
    const second = await makeTheatre(raviTheatre.ownerId)
    expect((await ravi.post(foodPath(second), good)).status).toBe(201)
  })
})

describe('GET / PATCH / DELETE food (O-07)', () => {
  let id
  beforeEach(async () => {
    id = (await ravi.post(foodPath(raviTheatre), good)).body.food.id
  })

  it('lists all items A to Z, also out of stock, with the theatre', async () => {
    await ravi.post(foodPath(raviTheatre), { ...good, name: 'chai', inStock: false })
    await ravi.post(foodPath(raviTheatre), { ...good, name: 'Samosa' })
    const res = await ravi.get(foodPath(raviTheatre))
    expect(res.status).toBe(200)
    expect(res.body.theatre).toMatchObject({ id: String(raviTheatre._id), status: 'approved' })
    expect(res.body.items.map((f) => f.name)).toEqual(['Butter Popcorn', 'chai', 'Samosa'])
  })

  it('edits fields one by one; an empty photo removes it', async () => {
    const res = await ravi.patch(`/api/owner/food/${id}`, { inStock: false, pricePaise: 16000, photoUrl: '' })
    expect(res.status).toBe(200)
    expect(res.body.food).toMatchObject({ name: 'Butter Popcorn', inStock: false, pricePaise: 16000, photoUrl: null })
  })

  it('renaming to a used name → 409; an empty PATCH → 400', async () => {
    await ravi.post(foodPath(raviTheatre), { ...good, name: 'Samosa' })
    expect((await ravi.patch(`/api/owner/food/${id}`, { name: 'Samosa' })).status).toBe(409)
    expect((await ravi.patch(`/api/owner/food/${id}`, {})).status).toBe(400)
  })

  it('deletes an item for good', async () => {
    expect((await ravi.delete(`/api/owner/food/${id}`)).status).toBe(204)
    expect(await FoodItem.countDocuments()).toBe(0)
    expect((await ravi.delete(`/api/owner/food/${id}`)).status).toBe(404)
  })
})

describe('ownership (ROLE-02, T-01)', () => {
  it("another owner's canteen or item → 404, nothing changes", async () => {
    const sita = as(await login('sita@example.com'))
    const id = (await ravi.post(foodPath(raviTheatre), good)).body.food.id

    expect((await sita.get(foodPath(raviTheatre))).status).toBe(404)
    expect((await sita.post(foodPath(raviTheatre), { ...good, name: 'Mine' })).status).toBe(404)
    expect((await sita.patch(`/api/owner/food/${id}`, { pricePaise: 100 })).status).toBe(404)
    expect((await sita.delete(`/api/owner/food/${id}`)).status).toBe(404)
    expect((await ravi.post(foodPath(otherTheatre), good)).status).toBe(404)

    const item = await FoodItem.findById(id)
    expect(item.pricePaise).toBe(15000)
    expect(await FoodItem.countDocuments()).toBe(1)
  })

  it('users and admins get 403; guests 401', async () => {
    await createUser({ email: 'user@example.com' })
    await createUser({ email: 'admin@example.com', role: 'admin' })
    for (const email of ['user@example.com', 'admin@example.com']) {
      expect((await as(await login(email)).get(foodPath(raviTheatre))).status, email).toBe(403)
    }
    expect((await request(app).get(foodPath(raviTheatre))).status).toBe(401)
  })
})
