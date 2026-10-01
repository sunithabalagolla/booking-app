import bcrypt from 'bcrypt'
import { BCRYPT_ROUNDS, REFRESH_COOKIE, refreshCookieOptions } from '../config/auth.js'
import { AuthToken } from '../models/AuthToken.js'
import { getSettings } from '../models/Settings.js'
import { User } from '../models/User.js'
import { AppError } from '../utils/AppError.js'
import { publicUser } from '../utils/publicUser.js'
import { createToken, hashToken, signAccessToken } from '../utils/tokens.js'

// U-02 login / refresh / logout (api.md Section 3, BR-19, SEC-02)

// Used when the email is unknown, so a wrong email takes as long as a wrong
// password and nobody can find out which emails have an account
let dummyHash
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('not-a-real-password-0', BCRYPT_ROUNDS))

// Makes a new refresh token (stored hashed) + cookie, and returns a new access token.
// Lifetimes from settings (BR-19, A-05): a change applies to new logins / refreshes.
async function startSession(res, user) {
  const { accessTokenMinutes, refreshTokenDays } = await getSettings()
  const { token, tokenHash } = createToken()
  await AuthToken.create({
    userId: user._id,
    type: 'refresh',
    tokenHash,
    expiresAt: new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000),
  })
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions(refreshTokenDays))
  return signAccessToken(user, accessTokenMinutes)
}

function clearRefreshCookie(res) {
  // clearCookie needs the same options as when the cookie was set (but no maxAge)
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
}

// POST /api/auth/login. Same login for all 4 roles (S-01).
export async function login(req, res) {
  const { email, password } = req.valid.body

  const user = await User.findOne({ email }).select('+passwordHash')
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()))
  if (!user || !user.passwordHash || !passwordOk || user.deletedAt) {
    throw new AppError(401, 'INVALID_LOGIN', 'The email or password is not correct.')
  }

  // Only after a correct password, so these do not tell strangers anything
  if (!user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first. We can send you a new link.')
  }
  if (user.status === 'blocked') {
    throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account is blocked. Please contact support.')
  }

  const accessToken = await startSession(res, user)
  res.json({ accessToken, user: publicUser(user) })
}

// POST /api/auth/refresh. Rotation: the old refresh token is deleted and a
// new one is made, so every refresh token works only once.
export async function refresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE]
  if (!raw) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.')
  }

  // Atomic: if two requests send the same token, only one gets it
  const token = await AuthToken.findOneAndDelete({
    tokenHash: hashToken(raw),
    type: 'refresh',
    expiresAt: { $gt: new Date() }, // the TTL index deletes late, so check the time too
  })
  const user = token && (await User.findById(token.userId))

  if (!user || user.deletedAt || user.status === 'blocked' || !user.emailVerified) {
    clearRefreshCookie(res)
    throw new AppError(401, 'UNAUTHORIZED', 'Interval over! Please log in again to continue the show.')
  }

  const accessToken = await startSession(res, user)
  res.json({ accessToken, user: publicUser(user) })
}

// POST /api/auth/logout
export async function logout(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE]
  if (raw) {
    await AuthToken.deleteOne({ tokenHash: hashToken(raw), type: 'refresh' })
  }
  clearRefreshCookie(res)
  res.status(204).end()
}
