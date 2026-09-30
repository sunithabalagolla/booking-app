import mongoose from 'mongoose'

// authtokens collection (database.md 5.2): verify email links, reset links, refresh tokens.
// Only the SHA-256 hash of a token is stored; the real token is in the email link / cookie.
const { Schema } = mongoose

export const TOKEN_TYPES = ['verify_email', 'reset_password', 'refresh']

const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true },
)

authTokenSchema.index({ tokenHash: 1 }, { unique: true })
authTokenSchema.index({ userId: 1, type: 1 })
// TTL: MongoDB deletes expired tokens by itself, but only about every 60 s,
// so code must always check expiresAt > now too (database.md Section 3)
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const AuthToken = mongoose.model('AuthToken', authTokenSchema)
