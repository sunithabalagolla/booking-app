import mongoose from 'mongoose'

// auditlogs collection (database.md 5.22, A-14, SEC-13): who did what and when.
// Read only: the app only adds entries, it never changes or deletes them.
const { Schema } = mongoose

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true }, // e.g. 'settings.update', 'owner.approve'
    targetType: { type: String, required: true }, // e.g. 'settings', 'user', 'theatre'
    targetId: { type: Schema.Types.Mixed, required: true }, // ObjectId, or text ('platform' for settings)
    details: Schema.Types.Mixed, // e.g. { before, after }, reason
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ actorId: 1, createdAt: -1 })
auditLogSchema.index({ targetType: 1, targetId: 1 })

export const AuditLog = mongoose.model('AuditLog', auditLogSchema)

// Adds one entry. Pass `session` to make it part of the same transaction as the change.
export async function writeAudit(req, { action, targetType, targetId, details }, { session } = {}) {
  const [entry] = await AuditLog.create(
    [{ actorId: req.user._id, actorRole: req.user.role, action, targetType, targetId, details, ip: req.ip }],
    { session },
  )
  return entry
}
