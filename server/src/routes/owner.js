import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'

// /api/owner (api.md Section 8). The role check is set once for the whole group (ROLE-01).
// Endpoints come in Phase 2 (O-03 onwards). Use findOwned / ownedFilter for "own" data (ROLE-02).
const router = Router()

router.use(requireAuth, requireRole('owner'))

// "Owner (any)" endpoints (any approval status) go here, before the approval check

router.use(requireApprovedOwner) // ROLE-03: only approved owners below this line

export default router
