import { checkIn, staffTheatres } from '../services/checkIn.js'

// /api/staff (api.md Section 9): Gate Staff, own theatres only (ROLE-02, S-03 check 2)

// GET /api/staff/theatres → { items: [{ id, name, cityCode }] }
export async function listStaffTheatres(req, res) {
  res.json({ items: await staffTheatres(req.user) })
}

// POST /api/staff/checkins { qrToken | bookingNumber } → always 200 (entered / rejected)
export async function createCheckIn(req, res) {
  res.json(await checkIn(req.valid.body, req.user))
}
