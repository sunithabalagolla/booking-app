import { ipKeyGenerator, MemoryStore, rateLimit } from 'express-rate-limit'
import { AppError } from '../utils/AppError.js'

// SEC-03: all rate limit numbers in one place (start values from docs/api.md 1.7).
// Change a number here and every route that uses it follows.
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

export const LIMITS = {
  signup: { windowMs: HOUR, limit: 5 }, // per IP, user + owner sign up together (start value)
  resendVerify: { windowMs: HOUR, limit: 3 }, // per email (U-01)
  login: { windowMs: 15 * MINUTE, limit: 5 }, // wrong logins per email + IP (BR-17)
  forgotPassword: { windowMs: HOUR, limit: 3 }, // per email (start value, U-03)
}

// Every limiter keeps its own store; tests clear them with resetRateLimits()
const stores = []

function makeLimiter({ windowMs, limit }, extra = {}) {
  const store = new MemoryStore()
  stores.push(store)
  return rateLimit({
    windowMs,
    limit,
    store,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many tries. Please wait a little and try again.'))
    },
    ...extra,
  })
}

// The email in the body, lowercased, so the limit follows the account
const emailOf = (req) => String(req.body?.email ?? '').trim().toLowerCase()

export const signupLimiter = makeLimiter(LIMITS.signup)

export const resendVerifyLimiter = makeLimiter(LIMITS.resendVerify, {
  keyGenerator: (req) => `email:${emailOf(req)}`,
})

export const forgotPasswordLimiter = makeLimiter(LIMITS.forgotPassword, {
  keyGenerator: (req) => `forgot:${emailOf(req)}`,
})

// BR-17: only WRONG logins (401) count. A correct login, or a correct password
// for an account that is not verified yet, does not use up a try.
export const loginLimiter = makeLimiter(LIMITS.login, {
  keyGenerator: (req) => `login:${emailOf(req)}|${ipKeyGenerator(req.ip)}`,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  skipSuccessfulRequests: true,
})

// Tests only: forget all counts
export function resetRateLimits() {
  for (const store of stores) store.resetAll()
}
