import { Router } from 'express'
import { resendVerifyLimiter, signupLimiter } from '../config/rateLimits.js'
import { resendVerify, signup, verifyEmail } from '../controllers/auth.js'
import { validate } from '../middleware/validate.js'
import { resendVerifySchema, signupSchema, verifyEmailSchema } from '../validation/auth.js'

// /api/auth (api.md Section 3). More routes come with U-02, U-03 and O-01.
const router = Router()

router.post('/signup', signupLimiter, validate({ body: signupSchema }), signup)
router.post('/verify-email', validate({ body: verifyEmailSchema }), verifyEmail)
router.post('/resend-verify', resendVerifyLimiter, validate({ body: resendVerifySchema }), resendVerify)

export default router
