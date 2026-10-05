import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Movie } from '../src/models/Movie.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// U-07 GET /api/movies/:id (guests)

const makeMovie = (fields = {}) =>
  Movie.create({
    title: 'Kadal Kaatru',
    tagline: 'Songs of the sea breeze',
    posterUrl: '/api/uploads/files/p.png',
    trailerUrl: 'https://example.com/trailer',
    cast: [{ name: 'Lakshmi Narayanan', photoUrl: '/api/uploads/files/c.png' }, { name: 'Karthik Raman' }],
    genres: ['Romance', 'Musical'],
    languages: ['Tamil', 'Telugu'],
    durationMinutes: 135,
    certificate: 'U',
    releaseDate: istDayToDate(istToday(-17)),
    status: 'now_showing',
    ratingAvg: 4.2,
    ratingCount: 18,
    ...fields,
  })

beforeAll(async () => {
  await connectTestDB()
  await Movie.init()
})
beforeEach(clearTestDB)
afterAll(closeTestDB)

describe('GET /api/movies/:id (U-07)', () => {
  it('guests get every field the details page shows', async () => {
    const movie = await makeMovie()
    const res = await request(app).get(`/api/movies/${movie._id}`)
    expect(res.status).toBe(200)
    expect(res.body.movie).toEqual({
      id: String(movie._id),
      title: 'Kadal Kaatru',
      tagline: 'Songs of the sea breeze',
      posterUrl: '/api/uploads/files/p.png',
      trailerUrl: 'https://example.com/trailer',
      cast: [
        { name: 'Lakshmi Narayanan', photoUrl: '/api/uploads/files/c.png' },
        { name: 'Karthik Raman', photoUrl: null },
      ],
      genres: ['Romance', 'Musical'],
      languages: ['Tamil', 'Telugu'],
      durationMinutes: 135,
      certificate: 'U',
      releaseDate: istToday(-17),
      status: 'now_showing',
      ratingAvg: 4.2,
      ratingCount: 18,
    })
  })

  it('coming soon movies are shown too; missing parts come back empty', async () => {
    const movie = await makeMovie({ status: 'coming_soon', tagline: undefined, trailerUrl: undefined, cast: [] })
    const res = await request(app).get(`/api/movies/${movie._id}`)
    expect(res.body.movie).toMatchObject({ status: 'coming_soon', tagline: null, trailerUrl: null, cast: [] })
  })

  it('inactive, unknown or bad ID → not found', async () => {
    const inactive = await makeMovie({ status: 'inactive' })
    expect((await request(app).get(`/api/movies/${inactive._id}`)).status).toBe(404)
    expect((await request(app).get(`/api/movies/${new mongoose.Types.ObjectId()}`)).status).toBe(404)
    expect((await request(app).get('/api/movies/not-an-id')).status).toBe(400)
  })
})
