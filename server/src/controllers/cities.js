import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'

// U-04 city picker (api.md: GET /api/cities, guests too).
// Only cities with at least one APPROVED theatre, names from the fixed list in
// settings, A to Z (database.md 5.7).
export async function listCities(req, res) {
  const [{ cities }, codes] = await Promise.all([getSettings(), Theatre.distinct('cityCode', { status: 'approved' })])
  const items = cities
    .filter((c) => codes.includes(c.code))
    .map((c) => ({ code: c.code, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  res.json({ cities: items })
}
