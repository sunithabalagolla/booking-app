import { create } from 'zustand'

// Who is logged in (U-02). Kept in memory only, never in localStorage, so page
// scripts cannot steal the token. After a page reload the refresh cookie
// logs the user in again (see restoreSession in api/client.js).
export const useAuthStore = create((set) => ({
  // 'loading' until the first silent refresh is done, then 'guest' or 'user'
  status: 'loading',
  accessToken: null,
  user: null,
  // true when the login ran out while using the app (UI-36 "Interval over!")
  sessionExpired: false,

  setSession: ({ accessToken, user }) => set({ status: 'user', accessToken, user, sessionExpired: false }),
  clearSession: ({ expired = false } = {}) =>
    set({ status: 'guest', accessToken: null, user: null, sessionExpired: expired }),
}))
