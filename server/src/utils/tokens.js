import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { getAccessSecret } from '../config/auth.js'

// SHA-256 of a token, as stored in the authtokens collection
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// A new random token (email links, refresh tokens). Send `token`, store only `tokenHash`.
export function createToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

// Access token (BR-19): a JWT with only the user ID and role.
// `minutes` = accessTokenMinutes from settings (default 15).
export function signAccessToken(user, minutes) {
  return jwt.sign({ role: user.role }, getAccessSecret(), {
    subject: String(user._id),
    expiresIn: `${minutes}m`,
    algorithm: 'HS256',
  })
}

// Returns the token payload, or throws jwt errors (TokenExpiredError, JsonWebTokenError)
export function verifyAccessToken(token) {
  return jwt.verify(token, getAccessSecret(), { algorithms: ['HS256'] })
}
