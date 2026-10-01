import { create } from 'zustand'

// O-01: an owner who is not approved yet (or was rejected) waits on /owner/pending
export function needsApproval(user) {
  return user?.role === 'owner' && user.owner?.approvalStatus !== 'approved'
}

// The kind of person for page rules: 'user', 'owner' (approved), 'owner_pending', 'staff', 'admin'
export function roleKey(user) {
  return needsApproval(user) ? 'owner_pending' : user?.role
}

// Each kind of person's own home page. `from` = the page a user came from.
// Staff always open the scanner (S-01); owners and admins their register (ROLE-01).
export function homePathFor(user, from = '/') {
  const homes = { staff: '/staff/scan', owner_pending: '/owner/pending', owner: '/owner', admin: '/admin' }
  return homes[roleKey(user)] ?? from
}

// Public browsing pages (Home, later movies and shows): everyone except Gate Staff (S-01)
export const PUBLIC = ['guest', 'user', 'owner', 'owner_pending', 'admin']

// Page guard rule (used by RoleRoute). Returns:
//   undefined → still checking the login, wait
//   null      → may open the page
//   a path    → go there instead ('/login' for guests, else their own home)
export function roleRedirect({ status, user }, allow) {
  if (status === 'loading') return undefined
  if (status !== 'user') return allow.includes('guest') ? null : '/login'
  return allow.includes(roleKey(user)) ? null : homePathFor(user)
}

// "Was logged in" hint in localStorage: only '1', never a token or user data.
// Set at login, removed at logout. Without it, the app start does not try a
// silent refresh, so a guest's browser shows no 401 (restoreSession).
const LOGIN_HINT_KEY = 'talkies_was_logged_in'

export function hasLoginHint() {
  try {
    return localStorage.getItem(LOGIN_HINT_KEY) === '1'
  } catch {
    return false // storage blocked: behave like a guest
  }
}

function setLoginHint(on) {
  try {
    if (on) localStorage.setItem(LOGIN_HINT_KEY, '1')
    else localStorage.removeItem(LOGIN_HINT_KEY)
  } catch {
    // storage blocked: the login still works in this tab
  }
}

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

  setSession: ({ accessToken, user }) => {
    setLoginHint(true)
    set({ status: 'user', accessToken, user, sessionExpired: false })
  },
  clearSession: ({ expired = false } = {}) => {
    setLoginHint(false)
    set({ status: 'guest', accessToken: null, user: null, sessionExpired: expired })
  },
}))
