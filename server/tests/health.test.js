import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { closeTestDB, connectTestDB } from './helpers/db.js'

describe('GET /api/health', () => {
  it('answers 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'error', db: 'disconnected' })
  })

  it('answers 200 with db connected when the database is connected', async () => {
    await connectTestDB()
    try {
      const res = await request(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ status: 'ok', db: 'connected' })
    } finally {
      await closeTestDB()
    }
  })

  it('answers 404 for an unknown /api path', async () => {
    const res = await request(app).get('/api/no-such-path')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(res.body.error.requestId).toBe(res.headers['x-request-id'])
  })
})
