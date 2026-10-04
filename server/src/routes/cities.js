import { Router } from 'express'
import { listCities } from '../controllers/cities.js'

// /api/cities (api.md Section 5): the user city picker (U-04), for everyone
const router = Router()

router.get('/', listCities)

export default router
