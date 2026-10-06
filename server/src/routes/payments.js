import { Router } from 'express'
import { paymentLimiter } from '../config/rateLimits.js'
import { gatewayPay, verifyPayment } from '../controllers/bookings.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { gatewayPayBody, verifyBody } from '../validation/payments.js'

// U-16 mock payment (api.md Section 6), users only. Two routers on two paths:
// /api/mock-gateway (the fake Razorpay page, swapped out for real Razorpay later)
// and /api/payments (our verify step).
export const mockGatewayRoutes = Router()
mockGatewayRoutes.use(requireAuth, requireRole('user'))
mockGatewayRoutes.post('/pay', paymentLimiter, validate({ body: gatewayPayBody }), gatewayPay)

export const paymentRoutes = Router()
paymentRoutes.use(requireAuth, requireRole('user'))
paymentRoutes.post('/verify', paymentLimiter, validate({ body: verifyBody }), verifyPayment)
