import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { createCoupon, endCoupon, getCoupon, listCoupons, updateCoupon } from '../controllers/adminCoupons.js'
import { createMovie, deleteMovie, getMovie, listMovies, updateMovie } from '../controllers/adminMovies.js'
import { approveOwner, blockUser, listOwners, rejectOwner, unblockUser } from '../controllers/adminOwners.js'
import { approveTheatre, listTheatres, rejectTheatre } from '../controllers/adminTheatres.js'
import { getAdminSettings, updateSettings } from '../controllers/settings.js'
import { idParams } from '../validation/common.js'
import { createCouponSchema, listCouponsQuery, updateCouponSchema } from '../validation/coupons.js'
import { createMovieSchema, listMoviesQuery, updateMovieSchema } from '../validation/movies.js'
import { blockSchema, listOwnersQuery, listTheatresQuery, rejectOwnerSchema } from '../validation/owners.js'
import { settingsPatchSchema } from '../validation/settings.js'

// /api/admin (api.md Section 10). Admin only (ROLE-01).
// More endpoints come with A-07 onwards.
const router = Router()

router.use(requireAuth, requireRole('admin'))

// A-02 movies
router.get('/movies', validate({ query: listMoviesQuery }), listMovies)
router.post('/movies', validate({ body: createMovieSchema }), createMovie)
router.get('/movies/:id', validate({ params: idParams }), getMovie)
router.patch('/movies/:id', validate({ params: idParams, body: updateMovieSchema }), updateMovie)
router.delete('/movies/:id', validate({ params: idParams }), deleteMovie)

// A-03 owner approvals (audit + E-09 email)
router.get('/owners', validate({ query: listOwnersQuery }), listOwners)
router.post('/owners/:id/approve', validate({ params: idParams }), approveOwner)
router.post('/owners/:id/reject', validate({ params: idParams, body: rejectOwnerSchema }), rejectOwner)

// A-04 theatre approvals (audit + E-09 email to the owner)
router.get('/theatres', validate({ query: listTheatresQuery }), listTheatres)
router.post('/theatres/:id/approve', validate({ params: idParams }), approveTheatre)
router.post('/theatres/:id/reject', validate({ params: idParams, body: rejectOwnerSchema }), rejectTheatre)

// Block / unblock (owners now, A-03; other users with A-07). Audited.
router.post('/users/:id/block', validate({ params: idParams, body: blockSchema }), blockUser)
router.post('/users/:id/unblock', validate({ params: idParams, body: blockSchema }), unblockUser)

// A-05 platform settings (every change is in the audit log)
router.get('/settings', getAdminSettings)
router.patch('/settings', validate({ body: settingsPatchSchema }), updateSettings)

// A-06 coupons (no delete: "End now" keeps the history)
router.get('/coupons', validate({ query: listCouponsQuery }), listCoupons)
router.post('/coupons', validate({ body: createCouponSchema }), createCoupon)
router.get('/coupons/:id', validate({ params: idParams }), getCoupon)
router.patch('/coupons/:id', validate({ params: idParams, body: updateCouponSchema }), updateCoupon)
router.post('/coupons/:id/end', validate({ params: idParams }), endCoupon)

export default router
