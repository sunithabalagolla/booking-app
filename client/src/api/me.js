import { useAuthStore } from '../store/authStore.js'
import { apiFetch } from './client.js'

// /api/me calls (docs/api.md Section 4)

// UI-02 (later UI-40, UI-41): save settings in the profile. Keeps the user in
// the auth store up to date with the answer.
export async function savePrefs(prefs) {
  const { user } = await apiFetch('/me/prefs', { method: 'PATCH', body: prefs })
  useAuthStore.setState({ user })
  return user
}
