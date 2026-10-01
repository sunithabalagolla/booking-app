import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

// /api/staff (api.md Section 9). Gate Staff only (ROLE-01).
// Endpoints come in Phase 7 (S-02 onwards). Only the staff's own theatres (ROLE-02).
const router = Router()

router.use(requireAuth, requireRole('staff'))

export default router
