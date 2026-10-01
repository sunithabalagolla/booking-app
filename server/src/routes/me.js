import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { User } from '../models/User.js'
import { publicUser } from '../utils/publicUser.js'
import { prefsSchema } from '../validation/me.js'

// /api/me (api.md Section 4). Profile edits come with U-25.
const router = Router()

router.use(requireAuth)

router.get('/', (req, res) => {
  res.json({ user: publicUser(req.user) })
})

// UI-02 theme (and later UI-40 sound, UI-41 reduce motion). Saves only the sent fields.
router.patch('/prefs', validate({ body: prefsSchema }), async (req, res) => {
  const changes = {}
  for (const [key, value] of Object.entries(req.valid.body)) {
    if (value !== undefined) changes[`prefs.${key}`] = value
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: changes }, { returnDocument: 'after', runValidators: true })
  res.json({ user: publicUser(user) })
})

export default router
