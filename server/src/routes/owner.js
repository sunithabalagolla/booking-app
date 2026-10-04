import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { createTheatre, getMyTheatre, listCities, listMyTheatres, updateTheatre } from '../controllers/ownerTheatres.js'
import { createFood, deleteFood, listTheatreFood, updateFood } from '../controllers/ownerFood.js'
import { createShows, getMyShow, listMyShows, listOwnerMovies, updateShow } from '../controllers/ownerShows.js'
import { createScreen, getMyScreen, listTheatreScreens, updateScreen } from '../controllers/ownerScreens.js'
import { idParams } from '../validation/common.js'
import { createFoodSchema, updateFoodSchema } from '../validation/food.js'
import { createShowSchema, listShowsQuery, updateShowSchema } from '../validation/shows.js'
import { createScreenSchema, updateScreenSchema } from '../validation/screens.js'
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

// O-04 screens + seat layout (also for pending / rejected theatres; no delete)
router.get('/theatres/:id/screens', validate({ params: idParams }), listTheatreScreens)
router.post('/theatres/:id/screens', validate({ params: idParams, body: createScreenSchema }), createScreen)
router.get('/screens/:id', validate({ params: idParams }), getMyScreen)
router.patch('/screens/:id', validate({ params: idParams, body: updateScreenSchema }), updateScreen)

// O-07 canteen items (also for pending / rejected theatres; real delete, bookings keep a copy)
router.get('/theatres/:id/food', validate({ params: idParams }), listTheatreFood)
router.post('/theatres/:id/food', validate({ params: idParams, body: createFoodSchema }), createFood)
router.patch('/food/:id', validate({ params: idParams, body: updateFoodSchema }), updateFood)
router.delete('/food/:id', validate({ params: idParams }), deleteFood)

// O-05 shows (theatre must be approved, ROLE-04; no delete: cancel is O-06)
router.get('/movies', listOwnerMovies) // movie picker: Now showing + Coming soon
router.get('/shows', validate({ query: listShowsQuery }), listMyShows)
router.post('/shows', validate({ body: createShowSchema }), createShows)
router.get('/shows/:id', validate({ params: idParams }), getMyShow)
router.patch('/shows/:id', validate({ params: idParams, body: updateShowSchema }), updateShow)

export default router
