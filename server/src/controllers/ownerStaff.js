import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import { BCRYPT_ROUNDS } from '../config/auth.js'
import { writeAudit } from '../models/AuditLog.js'
import { AuthToken } from '../models/AuthToken.js'
import { Theatre } from '../models/Theatre.js'
import { User } from '../models/User.js'
import { AppError } from '../utils/AppError.js'

// O-09 Gate Staff accounts (api.md Section 8, ROLE-05). Own staff only (ROLE-02).
// Rules (decided 2026-10-12):
// - the owner sets the password and tells the staff in person (no email, BR-25)
// - staff can be linked to any of the owner's theatres (also pending / rejected)
// - no delete: block only (old check-ins keep the staffId)
// - block or a new password → logged out everywhere (refresh tokens deleted;
//   requireAuth stops a blocked account and access tokens older than passwordChangedAt)
// - an email that is already used (by anyone) is refused
// - audit log: staff.create, staff.update, staff.block, staff.unblock

const EMAIL_USED = 'This email is already used.'
const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this staff login.')

function publicStaff(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    status: user.status, // active · blocked
    theatres: (user.staff?.theatreIds ?? []).map((t) => ({ id: String(t._id), name: t.name })),
    createdAt: user.createdAt,
  }
}

const loadStaff = (filter) => User.findOne(filter).populate({ path: 'staff.theatreIds', select: 'name', options: { sort: { name: 1 } } })

// Every theatre must be mine; else a clear message on the field
async function checkMyTheatres(ownerId, theatreIds) {
  const count = await Theatre.countDocuments({ _id: { $in: theatreIds }, ownerId })
  if (count !== theatreIds.length) {
    const message = 'Please pick only your own theatres.'
    throw new AppError(400, 'VALIDATION_ERROR', message, { theatreIds: message })
  }
}

// GET /api/owner/staff → { items }, A to Z by name
export async function listStaff(req, res) {
  const items = await User.find({ role: 'staff', 'staff.ownerId': req.user._id, deletedAt: null })
    .sort({ name: 1, _id: 1 })
    .populate({ path: 'staff.theatreIds', select: 'name', options: { sort: { name: 1 } } })
  res.json({ items: items.map(publicStaff) })
}

// POST /api/owner/staff { name, email, password, theatreIds } → 201 { staff }
export async function createStaff(req, res) {
  const { name, email, password, theatreIds } = req.valid.body
  await checkMyTheatres(req.user._id, theatreIds)
  if (await User.exists({ email })) throw new AppError(409, 'ALREADY_EXISTS', EMAIL_USED, { email: EMAIL_USED })

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS) // SEC-01
  let staff
  try {
    await mongoose.connection.transaction(async (session) => {
      ;[staff] = await User.create(
        [{ name, email, passwordHash, role: 'staff', emailVerified: true, staff: { ownerId: req.user._id, theatreIds } }],
        { session },
      )
      await writeAudit(req, { action: 'staff.create', targetType: 'user', targetId: staff._id, details: { theatreIds } }, { session })
    })
  } catch (error) {
    // Two saves with the same email at the same moment: the unique index decides
    if (error.code === 11000) throw new AppError(409, 'ALREADY_EXISTS', EMAIL_USED, { email: EMAIL_USED })
    throw error
  }
  res.status(201).json({ staff: publicStaff(await loadStaff({ _id: staff._id })) })
}

// PATCH /api/owner/staff/:id { name?, theatreIds?, status?, password? } → { staff }
export async function updateStaff(req, res) {
  const { name, theatreIds, status, password } = req.valid.body
  const mine = { _id: req.valid.params.id, role: 'staff', 'staff.ownerId': req.user._id, deletedAt: null }
  const before = await User.findOne(mine)
  if (!before) throw notFound()
  if (theatreIds) await checkMyTheatres(req.user._id, theatreIds)

  const set = {}
  const changed = [] // for the audit log (never the password itself)
  if (name !== undefined && name !== before.name) {
    set.name = name
    changed.push('name')
  }
  if (theatreIds) {
    set['staff.theatreIds'] = theatreIds
    changed.push('theatreIds')
  }
  if (password) {
    set.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    set.passwordChangedAt = new Date() // older access tokens are refused (requireAuth)
    changed.push('password')
  }
  const statusChange = status && status !== before.status ? status : null
  if (statusChange) set.status = statusChange

  if (changed.length || statusChange) {
    await mongoose.connection.transaction(async (session) => {
      await User.updateOne(mine, { $set: set }, { session })
      // Blocked or new password → logged out on every device
      if (statusChange === 'blocked' || password) {
        await AuthToken.deleteMany({ userId: before._id, type: 'refresh' }, { session })
      }
      if (changed.length) {
        const details = { changed, ...(theatreIds ? { theatreIds } : {}) }
        await writeAudit(req, { action: 'staff.update', targetType: 'user', targetId: before._id, details }, { session })
      }
      if (statusChange) {
        await writeAudit(req, { action: statusChange === 'blocked' ? 'staff.block' : 'staff.unblock', targetType: 'user', targetId: before._id }, { session })
      }
    })
  }
  res.json({ staff: publicStaff(await loadStaff({ _id: before._id })) })
}
