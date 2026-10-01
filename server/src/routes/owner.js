import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { createTheatre, getMyTheatre, listCities, listMyTheatres, updateTheatre } from '../controllers/ownerTheatres.js'
import { idParams } from '../validation/common.js'
import { createTheatreSchema, updateTheatreSchema } from '../validation/theatres.js'

// /api/owner (api.md Section 8). The role check is set once for the whole group (ROLE-01).
// Use findOwned / ownedFilter for "own" data (ROLE-02).
const router = Router()

router.use(requireAuth, requireRole('owner'))

// "Owner (any)" endpoints (any approval status) go here, before the approval check

router.use(requireApprovedOwner) // ROLE-03: only approved owners below this line

// O-03 theatres (new ones start Pending, ROLE-04)
router.get('/cities', listCities) // fixed city list for the theatre form
router.get('/theatres', listMyTheatres)
router.post('/theatres', validate({ body: createTheatreSchema }), createTheatre)
router.get('/theatres/:id', validate({ params: idParams }), getMyTheatre)
router.patch('/theatres/:id', validate({ params: idParams, body: updateTheatreSchema }), updateTheatre)

export default router
