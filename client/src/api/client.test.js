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
    return { ok: next.status < 400, status: next.status, json: async () => body }
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

describe('restoreSession (app start)', () => {
  it('logs in again with the refresh cookie', async () => {
    useAuthStore.setState({ status: 'loading', accessToken: null, user: null })
    fakeServer({ '/auth/refresh': [refreshed('fresh-token')] })
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'user', accessToken: 'fresh-token' })
  })

  it('becomes a guest without a good cookie (no "Interval over!" message)', async () => {
    useAuthStore.setState({ status: 'loading', accessToken: null, user: null })
    fakeServer({ '/auth/refresh': [{ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }] })
    await restoreSession()
    expect(useAuthStore.getState()).toMatchObject({ status: 'guest', sessionExpired: false })
  })
})
