import { User } from '../models/User.js'

// Is this account stopped from logging in? (A-03, A-07, ROLE-05)
// Returns null when the account may be used, or the reason:
//   'account' → the account itself is blocked
//   'owner'   → a Gate Staff account whose owner is blocked (or gone)
// Used at login, refresh and on every request (requireAuth).
export async function blockedReason(user) {
  if (user.status === 'blocked') return 'account'
  if (user.role === 'staff') {
    const owner = await User.findById(user.staff?.ownerId).select('status deletedAt')
    if (!owner || owner.status === 'blocked' || owner.deletedAt) return 'owner'
  }
  return null
}

export const BLOCKED_MESSAGES = {
  account: 'This account is blocked. Please contact support.',
  owner: "Your theatre owner's account is blocked, so staff logins are stopped. Please contact the owner.",
}
