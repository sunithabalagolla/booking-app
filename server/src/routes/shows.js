import { Router } from 'express'
import { getShow, getShowSeats } from '../controllers/shows.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { idParams } from '../validation/common.js'

// /api/shows (api.md Sections 5 + 6): the seat page (U-10, UI-20)
const router = Router()

router.get('/:id', validate({ params: idParams }), getShow) // guests too
router.get('/:id/seats', requireAuth, requireRole('user'), validate({ params: idParams }), getShowSeats) // login needed from seat selection on (9.2)

export default router
