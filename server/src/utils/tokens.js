import { createHash, randomBytes } from 'node:crypto'

// SHA-256 of a token, as stored in the authtokens collection
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

// A new random token for an email link. Send `token`, store only `tokenHash`.
export function createToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}
