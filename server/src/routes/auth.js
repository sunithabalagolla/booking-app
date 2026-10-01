import { Router } from 'express'
import { forgotPasswordLimiter, loginLimiter, resendVerifyLimiter, signupLimiter } from '../config/rateLimits.js'
import { ownerSignup, resendVerify, signup, verifyEmail } from '../controllers/auth.js'
import { forgotPassword, resetPassword } from '../controllers/password.js'
import { login, logout, refresh } from '../controllers/session.js'
import { validate } from '../middleware/validate.js'
import {
  forgotPasswordSchema,
  loginSchema,
  ownerSignupSchema,
  resendVerifySchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from '../validation/auth.js'

// /api/auth (api.md Section 3)
const router = Router()

// U-01 sign up + verify email
router.post('/signup', signupLimiter, validate({ body: signupSchema }), signup)
router.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmail)
router.post('/resend-verify', resendVerifyLimiter, validate({ body: resendVerifySchema }), resendVerify)

// O-01 owner register. Same limiter object as /signup, so both share one count per IP.
router.post('/owner-signup', signupLimiter, validate({ body: ownerSignupSchema }), ownerSignup)

// U-02 login / refresh / logout
router.post('/login', loginLimiter, validate({ body: loginSchema }), login)
router.post('/refresh', refresh)
router.post('/logout', logout)

// U-03 forgot / reset password
router.post('/forgot-password', forgotPasswordLimiter, validate({ body: forgotPasswordSchema }), forgotPassword)
router.post('/reset-password', validate({ body: resetPasswordSchema }), resetPassword)

export default router
