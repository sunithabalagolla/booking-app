// Login token settings (BR-19, SEC-02).
// The token lifetimes are fixed here for now. They move to the settings
// collection with A-05 (Phase 2), so the admin can change them.

// bcrypt cost for password hashes (SEC-01)
export const BCRYPT_ROUNDS = 12

export const ACCESS_TOKEN_MINUTES = 15
export const REFRESH_TOKEN_DAYS = 7

// Password reset link life (U-03, settings resetLinkMinutes in database.md)
export const RESET_LINK_MINUTES = 30

// Refresh token cookie: httpOnly (page scripts cannot read it), sent only to /api/auth
export const REFRESH_COOKIE = 'talkies_rt'

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production (SEC-08)
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  }
}

// Secret for signing access tokens. Read when needed, so tests can set it.
export function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET is missing or shorter than 32 characters. Set it in .env.')
  }
  return secret
}
