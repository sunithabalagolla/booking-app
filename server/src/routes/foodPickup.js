import { Router } from 'express'
import { scanLimiter } from '../config/rateLimits.js'
import { collectFoodOrder, lookupFoodOrder } from '../controllers/foodPickup.js'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { checkInSchema } from '../validation/staff.js'

// /api/food-pickup (api.md Section 9): O-11 canteen counter. Approved owners (own theatres)
// and Gate Staff (their theatres); the theatre is checked inside the service (ROLE-02).
// Body = the same as the gate scan: { qrToken } or { bookingNumber }.
const router = Router()

router.use(requireAuth, requireRole('owner', 'staff'), requireApprovedOwner)

router.post('/lookup', scanLimiter, validate({ body: checkInSchema }), lookupFoodOrder)
router.post('/collect', scanLimiter, validate({ body: checkInSchema }), collectFoodOrder)

export default router
