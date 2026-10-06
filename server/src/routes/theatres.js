import { Router } from 'express'
import { getCanteenMenu } from '../controllers/theatres.js'
import { validate } from '../middleware/validate.js'
import { idParams } from '../validation/common.js'

// /api/theatres (api.md Section 5): for users and guests
const router = Router()

router.get('/:id/food', validate({ params: idParams }), getCanteenMenu) // U-13 canteen menu

export default router
