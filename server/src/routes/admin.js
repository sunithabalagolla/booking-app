import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { createMovie, deleteMovie, getMovie, listMovies, updateMovie } from '../controllers/adminMovies.js'
import { idParams } from '../validation/common.js'
import { createMovieSchema, listMoviesQuery, updateMovieSchema } from '../validation/movies.js'

// /api/admin (api.md Section 10). Admin only (ROLE-01).
// More endpoints come with A-03, A-04, A-05 …
const router = Router()

router.use(requireAuth, requireRole('admin'))

// A-02 movies
router.get('/movies', validate({ query: listMoviesQuery }), listMovies)
router.post('/movies', validate({ body: createMovieSchema }), createMovie)
router.get('/movies/:id', validate({ params: idParams }), getMovie)
router.patch('/movies/:id', validate({ params: idParams, body: updateMovieSchema }), updateMovie)
router.delete('/movies/:id', validate({ params: idParams }), deleteMovie)

export default router
