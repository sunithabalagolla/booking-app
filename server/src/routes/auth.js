import { Router } from 'express'
import { loginLimiter, resendVerifyLimiter, signupLimiter } from '../config/rateLimits.js'
import { resendVerify, signup, verifyEmail } from '../controllers/auth.js'
import { login, logout, refresh } from '../controllers/session.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, resendVerifySchema, signupSchema, verifyEmailSchema } from '../validation/auth.js'

// /api/auth (api.md Section 3). More routes come with U-03 and O-01.
const router = Router()

// U-01 sign up + verify email
router.post('/signup', signupLimiter, validate({ body: signupSchema }), signup)
router.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmail)
router.post('/resend-verify', resendVerifyLimiter, validate({ body: resendVerifySchema }), resendVerify)

// U-02 login / refresh / logout
router.post('/login', loginLimiter, validate({ body: loginSchema }), login)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router
