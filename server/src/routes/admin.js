import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'

// /api/admin (api.md Section 10). Admin only (ROLE-01).
// Endpoints come in Phase 2 (A-02 onwards).
const router = Router()

router.use(requireAuth, requireRole('admin'))

export default router
