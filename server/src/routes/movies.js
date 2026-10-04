import { Router } from 'express'
import { listMovies, listMovieShows } from '../controllers/movies.js'
import { validate } from '../middleware/validate.js'
import { movieShowsParams, movieShowsQuery, publicMoviesQuery } from '../validation/movies.js'

// /api/movies (api.md Section 5): movie lists for users and guests
const router = Router()

router.get('/', validate({ query: publicMoviesQuery }), listMovies) // U-05 (U-06 adds search + filters)
router.get('/:id/shows', validate({ params: movieShowsParams, query: movieShowsQuery }), listMovieShows) // U-09 (Home banner chips first)

export default router
