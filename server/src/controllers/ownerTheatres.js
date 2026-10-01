import { GST_STATE_CODES, gstinMatchesState } from '../config/gstStates.js'
import { findOwned } from '../middleware/ownership.js'
import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { AppError } from '../utils/AppError.js'

// O-03 owner theatres (api.md Section 8: /api/owner/theatres). Own theatres only (ROLE-02).
// Rules (decided 2026-10-01):
// - every new theatre starts Pending (ROLE-04); the admin approves it (A-04)
// - city from the fixed list in settings; the GSTIN must start with that city's state code
// - after approval, city and GSTIN are locked; other fields can change any time
// - editing a rejected theatre sends it back to Pending

// What the API sends. `city` comes from settings (name + GST state).
export function publicTheatre(theatre, cities) {
  const city = cities.find((c) => c.code === theatre.cityCode)
  return {
    id: String(theatre._id),
    name: theatre.name,
    city: city ? { code: city.code, name: city.name, state: city.state } : { code: theatre.cityCode, name: theatre.cityCode, state: null },
    address: theatre.address,
    mapLink: theatre.mapLink ?? null,
    photos: theatre.photos ?? [],
    gstin: theatre.gstin,
    amenities: { wheelchairAccess: theatre.amenities?.wheelchairAccess ?? false, parking: theatre.amenities?.parking ?? false },
    status: theatre.status,
    rejectReason: theatre.rejectReason ?? null,
    createdAt: theatre.createdAt,
  }
}

const fieldError = (field, message) => new AppError(400, 'VALIDATION_ERROR', 'Please check the form.', { [field]: message })

// City must be in the list; the GSTIN must belong to the city's state
function checkCityAndGstin(cities, cityCode, gstin) {
  const city = cities.find((c) => c.code === cityCode)
  if (!city) throw fieldError('cityCode', 'Please pick a city from the list.')
  if (!gstinMatchesState(gstin, city.state)) {
    throw fieldError('gstin', `This GSTIN is not for ${city.state}. A theatre in ${city.name} needs a GSTIN that starts with ${GST_STATE_CODES[city.state] ?? '??'}.`)
  }
}

// GET /api/owner/cities: the fixed city list for the theatre form
export async function listCities(req, res) {
  const { cities } = await getSettings()
  res.json({ cities: cities.map((c) => ({ code: c.code, name: c.name, state: c.state })) })
}

// GET /api/owner/theatres (newest first)
export async function listMyTheatres(req, res) {
  const [{ cities }, theatres] = await Promise.all([getSettings(), Theatre.find({ ownerId: req.user._id }).sort({ createdAt: -1, _id: -1 })])
  res.json({ items: theatres.map((t) => publicTheatre(t, cities)) })
}

// POST /api/owner/theatres. Always starts Pending (ROLE-04).
export async function createTheatre(req, res) {
  const body = req.valid.body
  const { cities } = await getSettings()
  checkCityAndGstin(cities, body.cityCode, body.gstin)

  const theatre = await Theatre.create({
    ...body,
    mapLink: body.mapLink || undefined,
    ownerId: req.user._id,
    status: 'pending',
  })
  res.status(201).json({ theatre: publicTheatre(theatre, cities) })
}

// GET /api/owner/theatres/:id (another owner's theatre → 404)
export async function getMyTheatre(req, res) {
  const [{ cities }, theatre] = await Promise.all([getSettings(), findOwned(Theatre, req.valid.params.id, req.user)])
  res.json({ theatre: publicTheatre(theatre, cities) })
}

// PATCH /api/owner/theatres/:id
export async function updateTheatre(req, res) {
  const body = req.valid.body
  const theatre = await findOwned(Theatre, req.valid.params.id, req.user)
  const { cities } = await getSettings()

  const cityChanges = body.cityCode !== undefined && body.cityCode !== theatre.cityCode
  const gstinChanges = body.gstin !== undefined && body.gstin !== theatre.gstin
  if (theatre.status === 'approved' && (cityChanges || gstinChanges)) {
    throw new AppError(400, 'RULE_BROKEN', 'The city and the GSTIN cannot change after the theatre is approved.', {
      rule: 'O-03',
      reason: 'locked_after_approval',
      field: cityChanges ? 'cityCode' : 'gstin',
    })
  }
  if (cityChanges || gstinChanges) checkCityAndGstin(cities, body.cityCode ?? theatre.cityCode, body.gstin ?? theatre.gstin)

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue
    if (key === 'amenities') {
      // Only the sent amenity changes
      if (value.wheelchairAccess !== undefined) theatre.amenities.wheelchairAccess = value.wheelchairAccess
      if (value.parking !== undefined) theatre.amenities.parking = value.parking
    } else if (key === 'mapLink') {
      theatre.mapLink = value || undefined // '' removes the link
    } else {
      theatre[key] = value
    }
  }
  // A rejected theatre that is edited waits for approval again
  if (theatre.status === 'rejected') {
    theatre.status = 'pending'
    theatre.rejectReason = undefined
  }
  await theatre.save()
  res.json({ theatre: publicTheatre(theatre, cities) })
}
