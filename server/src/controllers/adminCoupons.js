import mongoose from 'mongoose'
import { writeAudit } from '../models/AuditLog.js'
import { Coupon } from '../models/Coupon.js'
import { getSettings } from '../models/Settings.js'
import { Theatre } from '../models/Theatre.js'
import { AppError } from '../utils/AppError.js'
import { escapeRegex } from '../utils/escapeRegex.js'
import { dateToIstDay, istDayToDate, istToday } from '../utils/time.js'

// A-06 admin coupons (api.md Section 10). Tickets only (BR-16). Decided 2026-10-06:
// - dates are whole IST days: start 12:00 AM, end 11:59 PM IST
// - no delete (used coupons keep their history); "End now" sets the end to now
// - create, update and end are written to the audit log (A-14)
// - "Show to users" (isPublic): listed in Available offers on the bill (U-15)

const DAY_MS = 24 * 60 * 60 * 1000
const notFound = () => new AppError(404, 'NOT_FOUND', 'We could not find this coupon.')

// Ended first (an "End now" before the start is ended, not scheduled)
export function couponStatus(coupon, now = new Date()) {
  if (now > coupon.endAt) return 'ended'
  if (now < coupon.startAt) return 'scheduled'
  if (coupon.totalLimit != null && coupon.usedCount >= coupon.totalLimit) return 'used_up'
  return 'active'
}

// The same four as Mongo filters (list status filter)
function statusFilter(status, now) {
  const running = { startAt: { $lte: now }, endAt: { $gte: now } }
  switch (status) {
    case 'ended':
      return { endAt: { $lt: now } }
    case 'scheduled':
      return { startAt: { $gt: now }, endAt: { $gte: now } }
    case 'used_up':
      return { ...running, totalLimit: { $ne: null }, $expr: { $gte: ['$usedCount', '$totalLimit'] } }
    case 'active':
      return { ...running, $or: [{ totalLimit: null }, { $expr: { $lt: ['$usedCount', '$totalLimit'] } }] }
    default:
      return {}
  }
}

export function publicCoupon(coupon, now = new Date()) {
  return {
    id: String(coupon._id),
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    minAmountPaise: coupon.minAmountPaise ?? null,
    maxDiscountPaise: coupon.maxDiscountPaise ?? null,
    startAt: coupon.startAt,
    endAt: coupon.endAt,
    startDate: dateToIstDay(coupon.startAt), // IST days for the form
    endDate: dateToIstDay(coupon.endAt),
    totalLimit: coupon.totalLimit ?? null,
    perUserLimit: coupon.perUserLimit ?? null,
    usedCount: coupon.usedCount,
    cityCodes: coupon.cityCodes ?? [],
    theatreIds: (coupon.theatreIds ?? []).map(String),
    isPublic: Boolean(coupon.isPublic),
    status: couponStatus(coupon, now),
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  }
}

// IST days → stored times: 00:00 IST of the start day, 23:59:59.999 IST of the end day
const startOf = (day) => istDayToDate(day)
const endOf = (day) => new Date(istDayToDate(day).getTime() + DAY_MS - 1)

// Rules that need several fields, the stored coupon or the database.
// c = the coupon after the change (IST days in startDate / endDate). Throws 400 with
// field → message, like the Zod errors, so the form shows them next to the fields.
async function checkRules(c, { isNew, usedCount = 0 }) {
  const errors = {}
  if (c.discountType === 'percent' && c.value > 100) errors.value = 'A percent is 1 to 100.'
  if (c.discountType === 'flat' && (c.value % 100 !== 0 || c.value < 100 || c.value > 500000)) errors.value = 'Whole rupees, ₹1 to ₹5,000.'
  if (c.discountType === 'flat' && c.maxDiscountPaise != null) errors.maxDiscountPaise = 'Only for percent coupons.'
  if (c.endDate < c.startDate) errors.endDate = 'The end date must be on or after the start date.'
  else if (isNew && c.endDate < istToday()) errors.endDate = 'The end date cannot be in the past.'
  if (c.totalLimit != null && c.totalLimit < usedCount) errors.totalLimit = `Already used ${usedCount} times, so the limit cannot be lower.`
  if (c.perUserLimit != null && c.totalLimit != null && c.perUserLimit > c.totalLimit) errors.perUserLimit = 'Cannot be more than the total limit.'

  if (c.cityCodes.length) {
    const { cities } = await getSettings()
    if (c.cityCodes.some((code) => !cities.some((city) => city.code === code))) errors.cityCodes = 'Please pick cities from the list.'
  }
  if (c.theatreIds.length) {
    const found = await Theatre.countDocuments({ _id: { $in: c.theatreIds }, status: 'approved' })
    if (found !== new Set(c.theatreIds.map(String)).size) errors.theatreIds = 'Please pick approved theatres only.'
  }
  if (Object.keys(errors).length) throw new AppError(400, 'VALIDATION_ERROR', 'Please check the coupon details.', errors)
}

// Form values → the fields we store
function toDb(c) {
  const { startDate, endDate, ...rest } = c
  const doc = { ...rest }
  if (startDate !== undefined) doc.startAt = startOf(startDate)
  if (endDate !== undefined) doc.endAt = endOf(endDate)
  return doc
}

// GET /api/admin/coupons?q=&status=&page=: newest first
export async function listCoupons(req, res) {
  const { q, status, page, limit } = req.valid.query
  const now = new Date()
  const filter = { ...statusFilter(status, now) }
  if (q) filter.code = { $regex: `^${escapeRegex(q.toUpperCase())}` } // start of the code
  const [items, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Coupon.countDocuments(filter)])
  res.json({ items: items.map((c) => publicCoupon(c, now)), page, limit, total })
}

// GET /api/admin/coupons/:id (edit form)
export async function getCoupon(req, res) {
  const coupon = await Coupon.findById(req.valid.params.id)
  if (!coupon) throw notFound()
  res.json({ coupon: publicCoupon(coupon) })
}

// POST /api/admin/coupons → 201 { coupon }. Same code again → 409 ALREADY_EXISTS.
export async function createCoupon(req, res) {
  const body = req.valid.body
  await checkRules(body, { isNew: true })
  if (await Coupon.exists({ code: body.code })) throw codeTaken()

  let coupon
  try {
    await mongoose.connection.transaction(async (session) => {
      ;[coupon] = await Coupon.create([{ ...toDb(body), createdBy: req.user._id }], { session })
      await writeAudit(req, { action: 'coupon.create', targetType: 'coupon', targetId: coupon._id, details: { code: coupon.code } }, { session })
    })
  } catch (error) {
    if (error.code === 11000) throw codeTaken() // made at the same moment by another admin
    throw error
  }
  res.status(201).json({ coupon: publicCoupon(coupon) })
}
const codeTaken = () => new AppError(409, 'ALREADY_EXISTS', 'A coupon with this code already exists.', { code: 'A coupon with this code already exists.' })

// PATCH /api/admin/coupons/:id: any field except the code. Audit: old + new values
// of the changed fields only.
export async function updateCoupon(req, res) {
  const coupon = await Coupon.findById(req.valid.params.id)
  if (!coupon) throw notFound()
  const changes = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined))
  const current = publicCoupon(coupon)
  const merged = { ...current, ...changes }
  await checkRules(merged, { isNew: false, usedCount: coupon.usedCount })

  // Only fields that really change go to the database and the audit log
  const changed = Object.keys(changes).filter((key) => JSON.stringify(changes[key]) !== JSON.stringify(current[key]))
  if (changed.length) {
    const update = { $set: {}, $unset: {} }
    for (const [key, value] of Object.entries(toDb(Object.fromEntries(changed.map((k) => [k, changes[k]]))))) {
      if (value === null) update.$unset[key] = 1
      else update.$set[key] = value
    }
    for (const op of ['$set', '$unset']) if (!Object.keys(update[op]).length) delete update[op]
    await mongoose.connection.transaction(async (session) => {
      await Coupon.updateOne({ _id: coupon._id }, update, { session })
      const before = Object.fromEntries(changed.map((k) => [k, current[k]]))
      const after = Object.fromEntries(changed.map((k) => [k, changes[k]]))
      await writeAudit(req, { action: 'coupon.update', targetType: 'coupon', targetId: coupon._id, details: { code: coupon.code, before, after } }, { session })
    })
  }
  res.json({ coupon: publicCoupon(await Coupon.findById(coupon._id)), changed })
}

// POST /api/admin/coupons/:id/end: "End now" (decided 2026-10-06). The end becomes now;
// the coupon and its uses stay. Already ended → 400 RULE_BROKEN.
export async function endCoupon(req, res) {
  const now = new Date()
  let ended
  await mongoose.connection.transaction(async (session) => {
    ended = await Coupon.findOneAndUpdate({ _id: req.valid.params.id, endAt: { $gt: now } }, { $set: { endAt: now } }, { session, returnDocument: 'before' })
    if (ended) await writeAudit(req, { action: 'coupon.end', targetType: 'coupon', targetId: ended._id, details: { code: ended.code, before: { endAt: ended.endAt }, after: { endAt: now } } }, { session })
  })
  if (!ended) {
    if (!(await Coupon.exists({ _id: req.valid.params.id }))) throw notFound()
    throw new AppError(400, 'RULE_BROKEN', 'This coupon has already ended.', { rule: 'A-06', reason: 'already_ended' })
  }
  res.json({ coupon: publicCoupon(await Coupon.findById(ended._id), new Date(now.getTime() + 1)) })
}
