import mongoose from 'mongoose'
import { writeAudit } from '../models/AuditLog.js'
import { AuthToken } from '../models/AuthToken.js'
import { User } from '../models/User.js'
import { sendEmail } from '../services/email/index.js'
import { ownerDecisionTemplate } from '../services/email/templates.js'
import { AppError } from '../utils/AppError.js'

// A-03 owner approvals (api.md Section 10) + owner block / unblock.
// Allowed changes (decided 2026-10-01):
//   approve: pending or rejected → approved (only when the email is verified)
//   reject:  pending → rejected (reason required)
//   an approved owner is not rejected; the admin blocks them instead

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this owner.')

function publicOwner(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    businessName: user.owner.businessName,
    approvalStatus: user.owner.approvalStatus,
    rejectReason: user.owner.rejectReason ?? null,
    decidedAt: user.owner.decidedAt ?? null,
    decidedBy: user.owner.decidedBy ? { id: String(user.owner.decidedBy._id), name: user.owner.decidedBy.name } : null,
    emailVerified: user.emailVerified,
    status: user.status, // active · blocked
    createdAt: user.createdAt,
  }
}

// GET /api/admin/owners?approvalStatus=&q=&page=&limit=
// Pending: oldest first (first come, first served). Others: newest first.
export async function listOwners(req, res) {
  const { approvalStatus, q, page, limit } = req.valid.query
  const filter = { role: 'owner', deletedAt: null }
  if (approvalStatus) filter['owner.approvalStatus'] = approvalStatus
  if (q) {
    // Start of the name, email or business name, any case (like A-07 search)
    const starts = { $regex: `^${escapeRegex(q)}`, $options: 'i' }
    filter.$or = [{ name: starts }, { email: starts }, { 'owner.businessName': starts }]
  }
  const sort = approvalStatus === 'pending' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 }

  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).populate('owner.decidedBy', 'name'),
    User.countDocuments(filter),
  ])
  res.json({ items: items.map(publicOwner), page, limit, total })
}

// Why did the change not happen? → a clear error
async function explainRefusal(id) {
  const owner = await User.findOne({ _id: id, role: 'owner', deletedAt: null })
  if (!owner) throw notFound()
  if (!owner.emailVerified) {
    throw new AppError(400, 'RULE_BROKEN', 'This owner has not verified the email yet, so they cannot be approved.', { rule: 'A-03', reason: 'email_not_verified' })
  }
  throw new AppError(400, 'RULE_BROKEN', `This owner is already ${owner.owner.approvalStatus}.`, { rule: 'A-03', reason: 'already_decided' })
}

// One atomic change (only if the owner is still in an allowed status) + the
// audit entry, in one transaction. Then the E-09 email. Two admins at the same
// moment: only one wins.
async function decide(req, { from, set, unset, action, reason }) {
  const id = req.valid.params.id
  let owner
  await mongoose.connection.transaction(async (session) => {
    owner = await User.findOneAndUpdate(
      { _id: id, role: 'owner', deletedAt: null, emailVerified: true, 'owner.approvalStatus': { $in: from } },
      { $set: { ...set, 'owner.decidedBy': req.user._id, 'owner.decidedAt': new Date() }, ...(unset ? { $unset: unset } : {}) },
      { returnDocument: 'after', session },
    )
    if (!owner) return
    await writeAudit(req, { action, targetType: 'user', targetId: owner._id, details: reason ? { reason } : undefined }, { session })
  })
  if (!owner) await explainRefusal(id)

  const approved = owner.owner.approvalStatus === 'approved'
  const message = ownerDecisionTemplate({ name: owner.name, businessName: owner.owner.businessName, approved, reason, link: `${clientUrl()}/login` })
  try {
    await sendEmail({ to: owner.email, ...message })
  } catch (error) {
    // The decision is saved; the owner sees it on the waiting page too
    console.error(`Could not send E-09 to owner ${owner._id}:`, error.message)
  }
  await owner.populate('owner.decidedBy', 'name')
  return owner
}

// POST /api/admin/owners/:id/approve
export async function approveOwner(req, res) {
  const owner = await decide(req, {
    from: ['pending', 'rejected'],
    set: { 'owner.approvalStatus': 'approved' },
    unset: { 'owner.rejectReason': 1 },
    action: 'owner.approve',
  })
  res.json({ owner: publicOwner(owner) })
}

// POST /api/admin/owners/:id/reject  { reason }
export async function rejectOwner(req, res) {
  const { reason } = req.valid.body
  const owner = await decide(req, {
    from: ['pending'],
    set: { 'owner.approvalStatus': 'rejected', 'owner.rejectReason': reason },
    action: 'owner.reject',
    reason,
  })
  res.json({ owner: publicOwner(owner) })
}

// POST /api/admin/users/:id/block · /unblock  { reason? }
// For owners now (A-03); other users come with A-07. Blocking logs the owner out
// at once (refresh tokens deleted; requireAuth checks on every request) and stops
// their Gate Staff too (ROLE-05).
async function setBlocked(req, res, blocked) {
  const { id } = req.valid.params
  const target = await User.findOne({ _id: id, deletedAt: null })
  if (!target) throw new AppError(404, 'NOT_FOUND', 'We could not find this account.')
  if (target.role !== 'owner') {
    throw new AppError(400, 'RULE_BROKEN', 'Only owner accounts can be blocked for now. Other accounts come with A-07.', { rule: 'A-07', reason: 'owners_only' })
  }

  const status = blocked ? 'blocked' : 'active'
  if (target.status !== status) {
    await mongoose.connection.transaction(async (session) => {
      await User.updateOne({ _id: id }, { $set: { status } }, { session })
      if (blocked) {
        // Logged out everywhere: the owner and their Gate Staff
        const staffIds = (await User.find({ role: 'staff', 'staff.ownerId': id }, '_id', { session })).map((s) => s._id)
        await AuthToken.deleteMany({ userId: { $in: [target._id, ...staffIds] }, type: 'refresh' }, { session })
      }
      const details = req.valid.body.reason ? { reason: req.valid.body.reason } : undefined
      await writeAudit(req, { action: blocked ? 'user.block' : 'user.unblock', targetType: 'user', targetId: target._id, details }, { session })
    })
  }

  const fresh = await User.findById(id).populate('owner.decidedBy', 'name')
  res.json({ owner: publicOwner(fresh) })
}

export const blockUser = (req, res) => setBlocked(req, res, true)
export const unblockUser = (req, res) => setBlocked(req, res, false)
