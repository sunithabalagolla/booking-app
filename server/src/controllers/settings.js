import mongoose from 'mongoose'
import { writeAudit } from '../models/AuditLog.js'
import { getSettings, Settings } from '../models/Settings.js'
import { flattenChanges } from '../validation/settings.js'

// A-05 platform settings (api.md: GET / PATCH /api/admin/settings, GET /api/settings/public)

// The whole document for the admin page
function adminSettings(settings) {
  const data = settings.toObject()
  delete data._id
  delete data.__v
  delete data.createdAt
  return data
}

// Only what the screens need (api.md), plus uploadMaxMb for the upload check in the browser
export function publicSettings(s) {
  return {
    holdMinutes: s.holdMinutes,
    maxSeatsPerBooking: s.maxSeatsPerBooking,
    convenienceFeePaise: s.convenienceFeePaise,
    cancelCutoffMinutes: s.cancelCutoffMinutes,
    userRefundTicketPercent: s.userRefundTicketPercent,
    transferCutoffMinutes: s.transferCutoffMinutes,
    uploadMaxMb: s.uploadMaxMb,
  }
}

// GET /api/settings/public (guests too)
export async function getPublicSettings(req, res) {
  res.json({ settings: publicSettings(await getSettings()) })
}

// GET /api/admin/settings
export async function getAdminSettings(req, res) {
  res.json({ settings: adminSettings(await getSettings()) })
}

const valueAt = (doc, path) => path.split('.').reduce((v, key) => v?.[key], doc)

// PATCH /api/admin/settings. Saves only the sent fields that really changed and
// writes one audit entry with the old and new values, in one transaction (SEC-13).
export async function updateSettings(req, res) {
  const current = (await getSettings()).toObject()
  const changes = {}
  const before = {}
  for (const [path, value] of Object.entries(flattenChanges(req.valid.body))) {
    if (valueAt(current, path) === value) continue // same as now: nothing to save or log
    changes[path] = value
    before[path] = valueAt(current, path) ?? null
  }

  if (Object.keys(changes).length === 0) {
    return res.json({ settings: adminSettings(await getSettings()), changed: [] })
  }

  let saved
  await mongoose.connection.transaction(async (session) => {
    saved = await Settings.findByIdAndUpdate('platform', { $set: changes }, { returnDocument: 'after', runValidators: true, session })
    await writeAudit(req, { action: 'settings.update', targetType: 'settings', targetId: 'platform', details: { before, after: changes } }, { session })
  })
  res.json({ settings: adminSettings(saved), changed: Object.keys(changes) })
}
