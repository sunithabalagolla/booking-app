import { Router } from 'express'
import { getPublicSettings } from '../controllers/settings.js'

// /api/settings (api.md Section 5): values the screens need, for everyone
const router = Router()

router.get('/public', getPublicSettings)

export default router
