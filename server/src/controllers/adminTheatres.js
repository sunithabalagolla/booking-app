import mongoose from 'mongoose'
import { writeAudit } from '../models/AuditLog.js'
import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { sendEmail } from '../services/email/index.js'
import { theatreDecisionTemplate } from '../services/email/templates.js'
import { AppError } from '../utils/AppError.js'
import { publicTheatre } from './ownerTheatres.js'

// A-04 theatre approvals (api.md Section 10). Same rules as owners (decided 2026-10-01):
//   approve: pending or rejected → approved (not while the owner is blocked)
//   reject:  pending → rejected (reason required)
//   an approved theatre is not rejected

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'
const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this theatre.')

// The theatre + who owns it + who decided (the admin list needs all of it)
function adminTheatre(theatre, cities) {
  const owner = theatre.ownerId
  return {
    ...publicTheatre(theatre, cities),
    owner: {
      id: String(owner._id),
      name: owner.name,
      businessName: owner.owner?.businessName ?? null,
      email: owner.email,
      phone: owner.phone ?? null,
      status: owner.status, // active · blocked
    },
    decidedAt: theatre.decidedAt ?? null,
    decidedBy: theatre.decidedBy ? { id: String(theatre.decidedBy._id), name: theatre.decidedBy.name } : null,
  }
}

const withPeople = (query) => query.populate('ownerId', 'name email phone status owner.businessName').populate('decidedBy', 'name')

// GET /api/admin/theatres?status=&cityCode=&page=&limit=
// Pending: oldest first (first come, first served). Others: newest first.
export async function listTheatres(req, res) {
  const { status, cityCode, page, limit } = req.valid.query
  const filter = {}
  if (status) filter.status = status
  if (cityCode) filter.cityCode = cityCode
  const sort = status === 'pending' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 }

  const [{ cities }, items, total] = await Promise.all([
    getSettings(),
    withPeople(Theatre.find(filter).sort(sort).skip((page - 1) * limit).limit(limit)),
    Theatre.countDocuments(filter),
  ])
  res.json({ items: items.map((t) => adminTheatre(t, cities)), page, limit, total })
}

// One atomic change (only if the theatre is still in an allowed status) + the
// audit entry, in one transaction. Then the E-09 email to the owner.
async function decide(req, { from, set, unset, action, reason }) {
  const { id } = req.valid.params
  const current = await withPeople(Theatre.findById(id))
  if (!current) throw notFound()
  if (set.status === 'approved' && current.ownerId.status === 'blocked') {
    throw new AppError(400, 'RULE_BROKEN', 'The owner of this theatre is blocked, so the theatre cannot be approved.', { rule: 'A-04', reason: 'owner_blocked' })
  }

  let theatre
  await mongoose.connection.transaction(async (session) => {
    theatre = await Theatre.findOneAndUpdate(
      { _id: id, status: { $in: from } },
      { $set: { ...set, decidedBy: req.user._id, decidedAt: new Date() }, ...(unset ? { $unset: unset } : {}) },
      { returnDocument: 'after', session },
    )
    if (!theatre) return
    await writeAudit(req, { action, targetType: 'theatre', targetId: theatre._id, details: reason ? { reason } : undefined }, { session })
  })
  if (!theatre) {
    throw new AppError(400, 'RULE_BROKEN', `This theatre is already ${(await Theatre.findById(id)).status}.`, { rule: 'A-04', reason: 'already_decided' })
  }

  const { cities } = await getSettings()
  await theatre.populate([
    { path: 'ownerId', select: 'name email phone status owner.businessName' },
    { path: 'decidedBy', select: 'name' },
  ])
  const owner = theatre.ownerId
  const message = theatreDecisionTemplate({
    name: owner.name,
    theatreName: theatre.name,
    approved: theatre.status === 'approved',
    reason,
    link: `${clientUrl()}/owner/theatres/${theatre._id}`,
  })
  try {
    await sendEmail({ to: owner.email, ...message })
  } catch (error) {
    // The decision is saved; the owner sees it in the theatre list too
    console.error(`Could not send E-09 for theatre ${theatre._id}:`, error.message)
  }
  return adminTheatre(theatre, cities)
}

// POST /api/admin/theatres/:id/approve
export async function approveTheatre(req, res) {
  const theatre = await decide(req, { from: ['pending', 'rejected'], set: { status: 'approved' }, unset: { rejectReason: 1 }, action: 'theatre.approve' })
  res.json({ theatre })
}

// POST /api/admin/theatres/:id/reject  { reason }
export async function rejectTheatre(req, res) {
  const { reason } = req.valid.body
  const theatre = await decide(req, { from: ['pending'], set: { status: 'rejected', rejectReason: reason }, action: 'theatre.reject', reason })
  res.json({ theatre })
}
