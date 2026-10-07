import { Router } from 'express'
import { bookingLimiter, paymentLimiter } from '../config/rateLimits.js'
import { cancel, createPayment, deleteCoupon, getCancelPreview, getBooking, getOffers, getTicketPdf, giveUpHold, hold, listBookings, setCoupon, setFood } from '../controllers/bookings.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { albumQuery, couponBody, foodBody, holdBody } from '../validation/bookings.js'
import { idParams } from '../validation/common.js'

// /api/bookings (api.md Section 6): users only (9.2: login from seat selection on)
const router = Router()

router.use(requireAuth, requireRole('user'))

router.get('/', validate({ query: albumQuery }), listBookings) // U-18 ticket album
router.post('/hold', bookingLimiter, validate({ body: holdBody }), hold) // U-12
router.get('/:id', validate({ params: idParams }), getBooking)
router.delete('/:id/hold', validate({ params: idParams }), giveUpHold) // "Give up seats"
router.put('/:id/food', bookingLimiter, validate({ params: idParams, body: foodBody }), setFood) // U-13
router.put('/:id/coupon', bookingLimiter, validate({ params: idParams, body: couponBody }), setCoupon) // U-15
router.delete('/:id/coupon', bookingLimiter, validate({ params: idParams }), deleteCoupon)
router.get('/:id/offers', validate({ params: idParams }), getOffers) // U-15 Available offers
router.post('/:id/payments', paymentLimiter, validate({ params: idParams }), createPayment) // U-16 create order
router.get('/:id/ticket.pdf', validate({ params: idParams }), getTicketPdf) // U-17
router.get('/:id/cancel-preview', validate({ params: idParams }), getCancelPreview) // U-20
router.post('/:id/cancel', bookingLimiter, validate({ params: idParams }), cancel) // U-20

export default router
