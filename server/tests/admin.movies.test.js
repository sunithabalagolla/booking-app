import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { Movie } from '../src/models/Movie.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// A-02 admin movies

const good = {
  title: 'Sapnon Ka Safar',
  posterUrl: 'https://res.cloudinary.com/demo/image/upload/poster.jpg',
  trailerUrl: 'https://www.youtube.com/watch?v=abc',
  cast: [{ name: 'Meera Kapoor' }, { name: 'Arjun Mehra', photoUrl: '/api/uploads/files/cast-1.png' }],
  genres: ['Drama', 'Romance'],
  languages: ['Hindi'],
  durationMinutes: 148,
  certificate: 'UA',
  releaseDate: '2026-10-02',
  status: 'now_showing',
}

let adminToken
const as = (token) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
})
const admin = () => as(adminToken)
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init(), Movie.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createUser({ email: 'admin@example.com', role: 'admin' })
  adminToken = await login('admin@example.com')
})
afterAll(closeTestDB)

describe('POST /api/admin/movies (A-02)', () => {
  it('adds a movie; release date is the IST day (stored as 00:00 IST in UTC)', async () => {
    const res = await admin().post('/api/admin/movies', good)
    expect(res.status).toBe(201)
    expect(res.body.movie).toMatchObject({ title: good.title, releaseDate: '2026-10-02', ratingAvg: 0, ratingCount: 0 })
    expect(res.body.movie.cast).toEqual([
      { name: 'Meera Kapoor', photoUrl: null },
      { name: 'Arjun Mehra', photoUrl: '/api/uploads/files/cast-1.png' },
    ])
    const saved = await Movie.findById(res.body.movie.id)
    expect(saved.releaseDate.toISOString()).toBe('2026-10-01T18:30:00.000Z') // BR-21
  })

  it('refuses each broken rule with a field message', async () => {
    const cases = [
      ['title', { title: ' ' }],
      ['title', { title: 'x'.repeat(151) }],
      ['posterUrl', { posterUrl: 'http://not-https.example/p.jpg' }],
      ['trailerUrl', { trailerUrl: 'javascript:alert(1)' }],
      ['genres', { genres: [] }],
      ['genres', { genres: ['Western'] }], // not in the fixed list
      ['genres', { genres: ['Drama', 'Drama'] }],
      ['languages', { languages: ['hindi'] }], // lists are exact
      ['durationMinutes', { durationMinutes: 20 }],
      ['durationMinutes', { durationMinutes: 301 }],
      ['certificate', { certificate: 'PG' }],
      ['releaseDate', { releaseDate: '2026-02-30' }],
      ['status', { status: 'released' }],
    ]
    for (const [field, change] of cases) {
      const res = await admin().post('/api/admin/movies', { ...good, ...change })
      expect(res.status, JSON.stringify(change)).toBe(400)
      expect(Object.keys(res.body.error.details).some((key) => key.startsWith(field)), JSON.stringify(change)).toBe(true)
    }
    expect(await Movie.countDocuments()).toBe(0)
  })

  it('accepts the new genres Sci-Fi and Mystery', async () => {
    const res = await admin().post('/api/admin/movies', { ...good, genres: ['Sci-Fi', 'Mystery'] })
    expect(res.status).toBe(201)
  })

  it('is admin only (403 for other roles, 401 without login)', async () => {
    await createUser({ email: 'owner@example.com', role: 'owner', phone: '9876543210', owner: { businessName: 'B', approvalStatus: 'approved' } })
    await createUser({ email: 'user@example.com', role: 'user' })
    for (const email of ['owner@example.com', 'user@example.com']) {
      expect((await as(await login(email)).post('/api/admin/movies', good)).status).toBe(403)
    }
    expect((await request(app).get('/api/admin/movies')).status).toBe(401)
  })
})

describe('GET /api/admin/movies (list, api.md 1.6)', () => {
  beforeEach(async () => {
    for (const [title, status, releaseDate] of [
      ['Operation Monsoon', 'now_showing', '2026-09-30'],
      ['Kadal Kaatru', 'now_showing', '2026-09-14'],
      ['Star Voyage 1983', 'coming_soon', '2026-10-31'],
      ['Old Classic', 'inactive', '2020-01-01'],
    ]) {
      await admin().post('/api/admin/movies', { ...good, title, status, releaseDate })
    }
  })

  it('lists newest release first, with page info; inactive ones too', async () => {
    const res = await admin().get('/api/admin/movies')
    expect(res.body).toMatchObject({ page: 1, limit: 20, total: 4 })
    expect(res.body.items.map((m) => m.title)).toEqual(['Star Voyage 1983', 'Operation Monsoon', 'Kadal Kaatru', 'Old Classic'])
  })

  it('searches part of the title (any case) and filters by status', async () => {
    expect((await admin().get('/api/admin/movies?q=monsoon')).body.items.map((m) => m.title)).toEqual(['Operation Monsoon'])
    expect((await admin().get('/api/admin/movies?q=(')).body.total).toBe(0) // special characters are safe
    expect((await admin().get('/api/admin/movies?status=now_showing')).body.total).toBe(2)
  })

  it('pages', async () => {
    const res = await admin().get('/api/admin/movies?page=2&limit=3')
    expect(res.body).toMatchObject({ page: 2, limit: 3, total: 4 })
    expect(res.body.items).toHaveLength(1)
    expect((await admin().get('/api/admin/movies?limit=101')).status).toBe(400)
  })
})

describe('PATCH / GET one / DELETE /api/admin/movies/:id', () => {
  let id
  beforeEach(async () => {
    id = (await admin().post('/api/admin/movies', good)).body.movie.id
  })

  it('changes only the sent fields; an empty trailer link removes it', async () => {
    const res = await admin().patch(`/api/admin/movies/${id}`, { status: 'inactive', trailerUrl: '' })
    expect(res.status).toBe(200)
    expect(res.body.movie).toMatchObject({ status: 'inactive', trailerUrl: null, title: good.title })
  })

  it('refuses an empty change, a bad ID (400) and an unknown ID (404)', async () => {
    expect((await admin().patch(`/api/admin/movies/${id}`, {})).status).toBe(400)
    expect((await admin().patch('/api/admin/movies/not-an-id', { title: 'X' })).status).toBe(400)
    expect((await admin().patch(`/api/admin/movies/${new mongoose.Types.ObjectId()}`, { title: 'X' })).status).toBe(404)
  })

  it('GET one tells the form if the movie is in use', async () => {
    const res = await admin().get(`/api/admin/movies/${id}`)
    expect(res.body).toMatchObject({ movie: { id }, inUse: false })
  })

  it('deletes a movie without shows or bookings', async () => {
    expect((await admin().delete(`/api/admin/movies/${id}`)).status).toBe(204)
    expect(await Movie.countDocuments()).toBe(0)
  })

  it('refuses to delete a movie with a show or a booking (409 IN_USE, make it inactive)', async () => {
    const db = mongoose.connection.db
    for (const collection of ['shows', 'bookings']) {
      await db.collection(collection).insertOne({ movieId: new mongoose.Types.ObjectId(id) })
      const res = await admin().delete(`/api/admin/movies/${id}`)
      expect(res.status, collection).toBe(409)
      expect(res.body.error.code).toBe('IN_USE')
      expect((await admin().get(`/api/admin/movies/${id}`)).body.inUse).toBe(true)
      await db.collection(collection).deleteMany({})
    }
    expect(await Movie.countDocuments()).toBe(1)
  })
})
