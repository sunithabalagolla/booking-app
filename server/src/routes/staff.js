import { Router } from 'express'
import { scanLimiter } from '../config/rateLimits.js'
import { createCheckIn, listStaffTheatres } from '../controllers/staff.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { checkInSchema } from '../validation/staff.js'

// /api/staff (api.md Section 9). Gate Staff only (ROLE-01).
// Only the staff's own theatres (ROLE-02): checked inside the check-in (S-03).
const router = Router()

router.use(requireAuth, requireRole('staff'))

router.get('/theatres', listStaffTheatres) // scanner header
router.post('/checkins', scanLimiter, validate({ body: checkInSchema }), createCheckIn) // S-02 … S-05, T-07

export default router
