import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { LIMITS, resetRateLimits } from '../src/config/rateLimits.js'

// SEC-08 headers + CORS allow-list, SEC-03 "everything else" limit.
// No database needed: these answers come before any database work.
const CLIENT = 'http://localhost:5173' // CLIENT_URL in tests/setupEnv.js

beforeEach(() => resetRateLimits())

describe('SEC-08 helmet headers', () => {
  it('sends security headers and hides Express', async () => {
    const res = await request(app).get('/api/no-such-path')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['content-security-policy']).toBeTruthy()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('SEC-08 CORS allow-list (CLIENT_URL)', () => {
  it('allows the Talkies client, with cookies', async () => {
    const res = await request(app).get('/api/no-such-path').set('Origin', CLIENT)
    expect(res.headers['access-control-allow-origin']).toBe(CLIENT)
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('answers the browser pre-check (OPTIONS) for the client', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', CLIENT)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe(CLIENT)
  })

  it('gives no CORS headers to another site (the browser then blocks it), and no 500', async () => {
    const res = await request(app).get('/api/no-such-path').set('Origin', 'https://evil.example')
    expect(res.status).toBe(404)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('SEC-03 "everything else" limit', () => {
  it(`allows ${LIMITS.general.limit} calls per 15 min per IP, then 429; /api/health is never limited`, async () => {
    for (let i = 0; i < LIMITS.general.limit; i++) await request(app).get('/api/no-such-path')

    const over = await request(app).get('/api/no-such-path')
    expect(over.status).toBe(429)
    expect(over.body.error.code).toBe('RATE_LIMITED')

    const health = await request(app).get('/api/health')
    expect(health.status).not.toBe(429) // 503 here: no database in this test file
  })
})
