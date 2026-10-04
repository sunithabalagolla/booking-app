import { Router } from 'express'
import { listMovies } from '../controllers/movies.js'
import { validate } from '../middleware/validate.js'
import { publicMoviesQuery } from '../validation/movies.js'

// /api/movies (api.md Section 5): movie lists for users and guests
const router = Router()

router.get('/', validate({ query: publicMoviesQuery }), listMovies) // U-05 (U-06 adds search + filters)

export default router
