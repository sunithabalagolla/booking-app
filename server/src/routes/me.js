import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { publicUser } from '../utils/publicUser.js'

// /api/me (api.md Section 4). Profile edits come with U-25.
const router = Router()

router.use(requireAuth)

router.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router
