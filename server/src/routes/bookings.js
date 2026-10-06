import { Router } from 'express'
import { bookingLimiter } from '../config/rateLimits.js'
import { deleteCoupon, getBooking, getOffers, giveUpHold, hold, setCoupon, setFood } from '../controllers/bookings.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { couponBody, foodBody, holdBody } from '../validation/bookings.js'
import { idParams } from '../validation/common.js'

// /api/bookings (api.md Section 6): users only (9.2: login from seat selection on)
const router = Router()

router.use(requireAuth, requireRole('user'))

router.post('/hold', bookingLimiter, validate({ body: holdBody }), hold) // U-12
router.get('/:id', validate({ params: idParams }), getBooking)
router.delete('/:id/hold', validate({ params: idParams }), giveUpHold) // "Give up seats"
router.put('/:id/food', bookingLimiter, validate({ params: idParams, body: foodBody }), setFood) // U-13
router.put('/:id/coupon', bookingLimiter, validate({ params: idParams, body: couponBody }), setCoupon) // U-15
router.delete('/:id/coupon', bookingLimiter, validate({ params: idParams }), deleteCoupon)
router.get('/:id/offers', validate({ params: idParams }), getOffers) // U-15 Available offers

export default router
