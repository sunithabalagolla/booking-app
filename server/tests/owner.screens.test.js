import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Screen } from '../src/models/Screen.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// O-04 owner screens + seat layout, with ownership checks (ROLE-02, T-01)

const S = (seatClass = 'second', wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })
const A = { type: 'aisle' }
const X = { type: 'blocked' }

// 3 rows × 4 cols: Balcony at the back, an empty walkway, Second class in front
const goodLayout = {
  rows: 3,
  cols: 4,
  grid: [{ cells: [S('balcony'), A, S('balcony'), S('balcony')] }, { cells: [A, A, A, A] }, { cells: [S(), X, S(), S('second', true)] }],
}
const good = { name: 'Screen 1', format: '2D', layout: goodLayout }

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
})

let phone = 9200000000
const makeOwner = (email) => createUser({ email, role: 'owner', phone: String(phone++), owner: { businessName: 'B', approvalStatus: 'approved' } })
const makeTheatre = (ownerId, status = 'approved') =>
  Theatre.create({ ownerId, name: `T ${phone++}`, cityCode: 'hyderabad', address: '12 Station Road, Hyderabad', gstin: '36AABCS1234A1Z5', status })

let ravi, raviTheatre, otherTheatre
beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), Theatre.init(), Screen.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await Settings.create({ _id: 'platform', cities: CITIES, defaultCleaningBreakMinutes: 15 })
  const owner = await makeOwner('ravi@example.com')
  const other = await makeOwner('sita@example.com')
  raviTheatre = await makeTheatre(owner._id)
  otherTheatre = await makeTheatre(other._id)
  ravi = as(await login('ravi@example.com'))
})
afterAll(closeTestDB)

describe('POST /api/owner/theatres/:id/screens (O-04)', () => {
  it('saves the screen; the server makes row letters, seat IDs, counts and wheelchair-friendly', async () => {
    const res = await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, good)
    expect(res.status).toBe(201)
    const { screen } = res.body
    expect(screen).toMatchObject({
      name: 'Screen 1',
      format: '2D',
      cleaningBreakMinutes: 15, // default from settings (BR-09)
      wheelchairFriendly: true,
      seatCount: { balcony: 3, first: 0, second: 3 },
      totalSeats: 6,
      layout: { rows: 3, cols: 4 },
    })
    expect(screen.layout.grid.map((r) => r.label)).toEqual(['B', null, 'A'])
    expect(screen.layout.grid[2].cells.map((c) => c.seatId ?? c.type)).toEqual(['A1', 'blocked', 'A2', 'A3'])

    const saved = await Screen.findById(screen.id)
    expect(String(saved.ownerId)).toBe(String(raviTheatre.ownerId)) // copy from the theatre
  })

  it('wheelchair-friendly is automatic: false without a wheelchair space, even if sent', async () => {
    const layout = { ...goodLayout, grid: goodLayout.grid.map((r) => ({ cells: r.cells.map((c) => (c.type === 'seat' ? S(c.seatClass) : c)) })) }
    const res = await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, layout, wheelchairFriendly: true, cleaningBreakMinutes: 20 })
    expect(res.body.screen).toMatchObject({ wheelchairFriendly: false, cleaningBreakMinutes: 20 })
  })

  it('pending and rejected theatres can have screens too (decided 2026-10-04)', async () => {
    for (const status of ['pending', 'rejected']) {
      const theatre = await makeTheatre(raviTheatre.ownerId, status)
      const res = await ravi.post(`/api/owner/theatres/${theatre._id}/screens`, good)
      expect(res.status, status).toBe(201)
    }
  })

  it('refuses each broken rule', async () => {
    const cases = [
      ['name', { name: '' }],
      ['format', { format: 'IMAX' }],
      ['cleaningBreakMinutes', { cleaningBreakMinutes: 121 }],
      ['layout.rows', { layout: { ...goodLayout, rows: 27 } }],
      ['layout.cols', { layout: { ...goodLayout, cols: 41 } }],
      ['layout.grid', { layout: { ...goodLayout, rows: 2 } }], // grid does not match rows
      ['layout.grid', { layout: { ...goodLayout, grid: [goodLayout.grid[0], goodLayout.grid[1], { cells: [S(), S()] }] } }], // short row
      ['layout.grid', { layout: { rows: 1, cols: 2, grid: [{ cells: [A, X] }] } }], // no seats
      ['layout.grid', { layout: { rows: 1, cols: 1, grid: [{ cells: [{ type: 'seat', seatClass: 'royal' }] }] } }],
      ['layout.grid', { layout: { rows: 1, cols: 1, grid: [{ cells: [{ type: 'sofa' }] }] } }],
    ]
    for (const [field, change] of cases) {
      const res = await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, ...change })
      expect(res.status, JSON.stringify(change)).toBe(400)
      expect(Object.keys(res.body.error.details).some((k) => k.startsWith(field)), `${field}: ${JSON.stringify(res.body.error.details)}`).toBe(true)
    }
    expect(await Screen.countDocuments()).toBe(0)
  })

  it('the same name twice in one theatre → 409 ALREADY_EXISTS; another theatre may use it', async () => {
    await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, good)
    const res = await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, good)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'ALREADY_EXISTS', details: { name: expect.any(String) } })

    const second = await makeTheatre(raviTheatre.ownerId)
    expect((await ravi.post(`/api/owner/theatres/${second._id}/screens`, good)).status).toBe(201)
  })

  it('the biggest layout (26 × 40) fits in one request', async () => {
    const grid = Array.from({ length: 26 }, () => ({ cells: Array.from({ length: 40 }, () => S('balcony', true)) }))
    const res = await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, layout: { rows: 26, cols: 40, grid } })
    expect(res.status).toBe(201)
    expect(res.body.screen.totalSeats).toBe(1040)
    expect(res.body.screen.layout.grid[0].label).toBe('Z')
  })
})

describe('GET / PATCH screens (O-04)', () => {
  let id
  beforeEach(async () => {
    id = (await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, good)).body.screen.id
  })

  it('lists the screens of a theatre in name order, without the grid', async () => {
    await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, name: 'Screen 10' })
    await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, name: 'Screen 2' })
    const res = await ravi.get(`/api/owner/theatres/${raviTheatre._id}/screens`)
    expect(res.status).toBe(200)
    expect(res.body.theatre).toMatchObject({ id: String(raviTheatre._id), status: 'approved' })
    expect(res.body.items.map((s) => s.name)).toEqual(['Screen 1', 'Screen 2', 'Screen 10'])
    expect(res.body.items[0].layout).toEqual({ rows: 3, cols: 4 })
  })

  it('gets one screen with its grid and theatre', async () => {
    const res = await ravi.get(`/api/owner/screens/${id}`)
    expect(res.status).toBe(200)
    expect(res.body.screen.layout.grid).toHaveLength(3)
    expect(res.body.theatre.name).toBe(raviTheatre.name)
  })

  it('edits fields one by one; a new layout makes new letters and counts', async () => {
    const res = await ravi.patch(`/api/owner/screens/${id}`, {
      format: '3D',
      layout: { rows: 2, cols: 2, grid: [{ cells: [S('first'), S('first')] }, { cells: [S(), A] }] },
    })
    expect(res.status).toBe(200)
    expect(res.body.screen).toMatchObject({ name: 'Screen 1', format: '3D', wheelchairFriendly: false, seatCount: { balcony: 0, first: 2, second: 1 }, totalSeats: 3 })
    expect(res.body.screen.layout.grid.map((r) => r.label)).toEqual(['B', 'A'])
  })

  it('the layout sent back as it came from GET saves again (labels ignored)', async () => {
    const { screen } = (await ravi.get(`/api/owner/screens/${id}`)).body
    const res = await ravi.patch(`/api/owner/screens/${id}`, { layout: screen.layout })
    expect(res.status).toBe(200)
    expect(res.body.screen.layout).toEqual(screen.layout)
  })

  it('renaming to a name used in the same theatre → 409; an empty PATCH → 400', async () => {
    await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, name: 'Screen 2' })
    expect((await ravi.patch(`/api/owner/screens/${id}`, { name: 'Screen 2' })).status).toBe(409)
    expect((await ravi.patch(`/api/owner/screens/${id}`, {})).status).toBe(400)
  })

  it('there is no delete', async () => {
    const res = await request(app).delete(`/api/owner/screens/${id}`).set('Authorization', `Bearer ${await login('ravi@example.com')}`)
    expect(res.status).toBe(404)
    expect(await Screen.countDocuments()).toBe(1)
  })
})

describe('ownership (ROLE-02, T-01)', () => {
  it("another owner's theatre or screen → 404, nothing changes", async () => {
    const sita = as(await login('sita@example.com'))
    const screenId = (await ravi.post(`/api/owner/theatres/${raviTheatre._id}/screens`, good)).body.screen.id

    expect((await sita.get(`/api/owner/theatres/${raviTheatre._id}/screens`)).status).toBe(404)
    expect((await sita.post(`/api/owner/theatres/${raviTheatre._id}/screens`, { ...good, name: 'Mine' })).status).toBe(404)
    expect((await sita.get(`/api/owner/screens/${screenId}`)).status).toBe(404)
    expect((await sita.patch(`/api/owner/screens/${screenId}`, { name: 'Mine' })).status).toBe(404)
    expect((await ravi.post(`/api/owner/theatres/${otherTheatre._id}/screens`, good)).status).toBe(404)

    expect(await Screen.countDocuments()).toBe(1)
    expect((await Screen.findById(screenId)).name).toBe('Screen 1')
  })

  it('users and admins get 403; guests 401', async () => {
    await createUser({ email: 'user@example.com' })
    await createUser({ email: 'admin@example.com', role: 'admin' })
    for (const email of ['user@example.com', 'admin@example.com']) {
      expect((await as(await login(email)).get(`/api/owner/theatres/${raviTheatre._id}/screens`)).status, email).toBe(403)
    }
    expect((await request(app).get(`/api/owner/theatres/${raviTheatre._id}/screens`)).status).toBe(401)
  })
})
