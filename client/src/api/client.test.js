import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../store/authStore.js'
import { apiFetch, restoreSession } from './client.js'

// A fake server: each route answers with a list of responses, one per call
function fakeServer(routes) {
  const calls = []
  const fetch = vi.fn(async (url, options) => {
    const path = url.replace('/api', '')
    calls.push({ path, auth: options.headers.Authorization })
    const next = routes[path].shift()
    const body = typeof next.body === 'function' ? next.body() : next.body
    return { ok: next.status < 400, status: next.status, json: async () => body, blob: async () => next.blob }
  })
  vi.stubGlobal('fetch', fetch)
  return calls
}

const expired = { status: 401, body: { error: { code: 'TOKEN_EXPIRED', message: 'expired' } } }
const refreshed = (token) => ({ status: 200, body: { accessToken: token, user: { name: 'Asha' } } })

beforeEach(() => {
  useAuthStore.setState({ status: 'user', accessToken: 'old-token', user: { name: 'Asha' }, sessionExpired: false })
})
afterEach(() => vi.unstubAllGlobals())

describe('apiFetch token refresh (U-02)', () => {
  it('sends the access token', async () => {
    const calls = fakeServer({ '/me': [{ status: 200, body: { ok: true } }] })
    await apiFetch('/me')
    expect(calls[0].auth).toBe('Bearer old-token')
  })

  it('refreshes once when the token expired, then repeats the call with the new token', async () => {
    const calls = fakeServer({
      '/me': [expired, { status: 200, body: { user: 'me' } }],
      '/auth/refresh': [refreshed('new-token')],
    })

    expect(await apiFetch('/me')).toEqual({ user: 'me' })
    expect(calls.map((c) => c.path)).toEqual(['/me', '/auth/refresh', '/me'])
    expect(calls[2].auth).toBe('Bearer new-token')
    expect(useAuthStore.getState().accessToken).toBe('new-token')
  })

  it('two calls at the same time share ONE refresh (refresh tokens work only once)', async () => {
    const calls = fakeServer({
      '/a': [expired, { status: 200, body: 'a' }],
      '/b': [expired, { status: 200, body: 'b' }],
      '/auth/refresh': [refreshed('new-token')],
    })

    expect(await Promise.all([apiFetch('/a'), apiFetch('/b')])).toEqual(['a', 'b'])
    expect(calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1)
  })

  it('logs out with "Interval over!" when the refresh fails', async () => {
    fakeServer({
      '/me': [expired],
      '/auth/refresh': [{ status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'no' } } }],
    })

    await expect(apiFetch('/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', accessToken: null, sessionExpired: true })
  })

  it('does not refresh for other errors', async () => {
    const calls = fakeServer({ '/me': [{ status: 403, body: { error: { code: 'FORBIDDEN', message: 'no' } } }] })
    await expect(apiFetch('/me')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(calls).toHaveLength(1)
  })
})

// A small in-memory localStorage (tests run in Node, which has none)
function fakeStorage(items = {}) {
  const store = new Map(Object.entries(items))
  vi.stubGlobal('localStorage', {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  })
  return store
}

describe('restoreSession (app start)', () => {
  beforeEach(() => useAuthStore.setState({ status: 'loading', accessToken: null, user: null }))

  it('logs in again with the refresh cookie when this browser was logged in', async () => {
    fakeStorage({ talkies_was_logged_in: '1' })
    fakeServer({ '/auth/refresh': [refreshed('fresh-token')] })
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'user', accessToken: 'fresh-token' })
  })

  it('a guest (no hint) makes no refresh call at all, so no 401 in the console', async () => {
    fakeStorage()
    const calls = fakeServer({ '/auth/refresh': [] })
    await restoreSession()
    expect(calls).toHaveLength(0)
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', sessionExpired: false })
  })

  it('becomes a guest without a good cookie and removes the hint (no "Interval over!")', async () => {
    const storage = fakeStorage({ talkies_was_logged_in: '1' })
    fakeServer({ '/auth/refresh': [{ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }] })
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', sessionExpired: false })
    expect(storage.has('talkies_was_logged_in')).toBe(false)
  })
})

describe('login hint', () => {
  it('is set at login and removed at logout; it never holds the token', () => {
    const storage = fakeStorage()
    useAuthStore.getState().setSession({ accessToken: 'secret-token', user: { name: 'Asha' } })
    expect(storage.get('talkies_was_logged_in')).toBe('1')
    expect([...storage.values()].join()).not.toContain('secret-token')

    useAuthStore.getState().clearSession()
    expect(storage.has('talkies_was_logged_in')).toBe(false)
  })
})

describe('apiFetch file answers (U-17 PDF downloads)', () => {
  it('blob: true gives the file; an expired token is refreshed first', async () => {
    const pdf = { size: 1234, type: 'application/pdf' }
    const calls = fakeServer({
      '/bookings/b1/ticket.pdf': [expired, { status: 200, blob: pdf }],
      '/auth/refresh': [refreshed('new-token')],
    })
    expect(await apiFetch('/bookings/b1/ticket.pdf', { blob: true })).toBe(pdf)
    expect(calls[0].auth).toBe('Bearer old-token')
    expect(calls.at(-1)).toEqual({ path: '/bookings/b1/ticket.pdf', auth: 'Bearer new-token' })
  })

  it('an error answer is still the server message', async () => {
    fakeServer({ '/bookings/b1/ticket.pdf': [{ status: 400, body: { error: { code: 'RULE_BROKEN', message: 'A ticket is ready only for a confirmed booking.' } } }] })
    await expect(apiFetch('/bookings/b1/ticket.pdf', { blob: true })).rejects.toMatchObject({ code: 'RULE_BROKEN', message: 'A ticket is ready only for a confirmed booking.' })
  })
})
