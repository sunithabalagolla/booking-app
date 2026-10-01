import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../store/authStore.js'
import { useThemeStore } from '../store/themeStore.js'
import { chooseTheme, syncThemeAtLogin, themeOnLogin } from './themeSync.js'

// A fake server that records PATCH /api/me/prefs calls
function fakePrefsServer({ fail = false } = {}) {
  const bodies = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      bodies.push(JSON.parse(options.body))
      if (fail) return { ok: false, status: 500, json: async () => ({ error: { code: 'SERVER_ERROR' } }) }
      const user = { ...useAuthStore.getState().user, prefs: { theme: bodies.at(-1).theme } }
      return { ok: true, status: 200, json: async () => ({ user }) }
    }),
  )
  return bodies
}

const loggedIn = (theme) =>
  useAuthStore.setState({ status: 'user', accessToken: 't', user: { id: '1', name: 'Asha', prefs: { theme } } })

beforeEach(() => {
  useThemeStore.setState({ choice: 'auto', theme: 'day' })
  useAuthStore.setState({ status: 'guest', accessToken: null, user: null })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('themeOnLogin rule (UI-02)', () => {
  it('profile empty → keep the device choice and save it to the profile', () => {
    expect(themeOnLogin(null, 'night')).toEqual({ choice: 'night', saveToProfile: true })
    expect(themeOnLogin(undefined, 'auto')).toEqual({ choice: 'auto', saveToProfile: true })
  })

  it('profile has a choice → the profile wins, nothing to save', () => {
    expect(themeOnLogin('day', 'night')).toEqual({ choice: 'day', saveToProfile: false })
    expect(themeOnLogin('auto', 'night')).toEqual({ choice: 'auto', saveToProfile: false })
  })
})

describe('syncThemeAtLogin', () => {
  it('first login: saves the device choice to the profile and keeps the look', async () => {
    useThemeStore.setState({ choice: 'night', theme: 'night' })
    loggedIn(null)
    const bodies = fakePrefsServer()

    syncThemeAtLogin()
    await vi.waitFor(() => expect(bodies).toEqual([{ theme: 'night' }]))
    expect(useThemeStore.getState().choice).toBe('night')
    await vi.waitFor(() => expect(useAuthStore.getState().user.prefs.theme).toBe('night'))
  })

  it('profile choice wins over the device and nothing is sent', () => {
    useThemeStore.setState({ choice: 'night', theme: 'night' })
    loggedIn('day')
    const bodies = fakePrefsServer()

    syncThemeAtLogin()
    expect(useThemeStore.getState()).toMatchObject({ choice: 'day', theme: 'day' })
    expect(bodies).toHaveLength(0)
  })
})

describe('chooseTheme', () => {
  it('guest: changes the look, sends nothing', () => {
    const bodies = fakePrefsServer()
    chooseTheme('night')
    expect(useThemeStore.getState().choice).toBe('night')
    expect(bodies).toHaveLength(0)
  })

  it('logged in: changes the look and saves to the profile', async () => {
    loggedIn('day')
    const bodies = fakePrefsServer()
    chooseTheme('night')
    expect(useThemeStore.getState().theme).toBe('night')
    await vi.waitFor(() => expect(bodies).toEqual([{ theme: 'night' }]))
  })

  it('saving fails: the new look stays, only a console note', async () => {
    loggedIn('day')
    fakePrefsServer({ fail: true })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    chooseTheme('night')
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(useThemeStore.getState().choice).toBe('night')
  })
})
