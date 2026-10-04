import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { CITIES } from '../src/seed/steps/settings.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// U-04 city picker: only cities with an approved theatre

const ownerId = new mongoose.Types.ObjectId()
const theatre = (cityCode, status) => Theatre.create({ ownerId, name: `T ${cityCode} ${status}`, cityCode, address: '1 Main Road, Somewhere', gstin: '36AABCS1234A1Z5', status })

beforeAll(async () => {
  await connectTestDB()
  await Theatre.init()
})
beforeEach(async () => {
  await clearTestDB()
  await Settings.create({ _id: 'platform', cities: CITIES })
})
afterAll(closeTestDB)

describe('GET /api/cities (U-04)', () => {
  it('guests get only cities with an approved theatre, A to Z, names from settings', async () => {
    await theatre('hyderabad', 'approved')
    await theatre('hyderabad', 'approved') // two theatres, one city
    await theatre('chennai', 'approved')
    await theatre('bengaluru', 'pending')
    await theatre('mumbai', 'rejected')

    const res = await request(app).get('/api/cities')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      cities: [
        { code: 'chennai', name: 'Chennai' },
        { code: 'hyderabad', name: 'Hyderabad' },
      ],
    })
  })

  it('no approved theatres → an empty list', async () => {
    await theatre('hyderabad', 'pending')
    expect((await request(app).get('/api/cities')).body).toEqual({ cities: [] })
  })
})
