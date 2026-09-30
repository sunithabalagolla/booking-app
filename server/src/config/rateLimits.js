import { MemoryStore, rateLimit } from 'express-rate-limit'
import { AppError } from '../utils/AppError.js'

// SEC-03: all rate limit numbers in one place (start values from docs/api.md 1.7).
// Change a number here and every route that uses it follows.
const HOUR = 60 * 60 * 1000

export const LIMITS = {
  signup: { windowMs: HOUR, limit: 5 }, // per IP (start value)
  resendVerify: { windowMs: HOUR, limit: 3 }, // per email (U-01)
}

// Every limiter keeps its own store; tests clear them with resetRateLimits()
const stores = []

function makeLimiter({ windowMs, limit }, keyGenerator) {
  const store = new MemoryStore()
  stores.push(store)
  return rateLimit({
    windowMs,
    limit,
    store,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many tries. Please wait a little and try again.'))
    },
  })
}

// Key by the email in the body (lowercased), so the limit follows the account, not the device
const byEmail = (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase()}`

export const signupLimiter = makeLimiter(LIMITS.signup)
export const resendVerifyLimiter = makeLimiter(LIMITS.resendVerify, byEmail)

// Tests only: forget all counts
export function resetRateLimits() {
  for (const store of stores) store.resetAll()
}
