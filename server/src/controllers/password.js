import bcrypt from 'bcrypt'
import { BCRYPT_ROUNDS, RESET_LINK_MINUTES } from '../config/auth.js'
import { AuthToken } from '../models/AuthToken.js'
import { User } from '../models/User.js'
import { sendEmail } from '../services/email/index.js'
import { resetPasswordTemplate } from '../services/email/templates.js'
import { AppError } from '../utils/AppError.js'
import { createToken, hashToken } from '../utils/tokens.js'

// U-03 forgot / reset password (api.md Section 3, E-02). Works for all 4 roles.

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'

// POST /api/auth/forgot-password. Always answers the same, so nobody can
// find out which emails have an account.
export async function forgotPassword(req, res) {
  const { email } = req.valid.body
  const user = await User.findOne({ email, status: 'active', deletedAt: null })

  if (user) {
    // Only the newest link works
    await AuthToken.deleteMany({ userId: user._id, type: 'reset_password' })
    const { token, tokenHash } = createToken()
    await AuthToken.create({
      userId: user._id,
      type: 'reset_password',
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000),
    })

    const link = `${clientUrl()}/reset-password?token=${encodeURIComponent(token)}`
    const message = resetPasswordTemplate({ name: user.name, link, minutes: RESET_LINK_MINUTES })
    try {
      await sendEmail({ to: user.email, ...message })
    } catch (error) {
      // Do not tell the browser (it would show that the account exists); the user can ask again
      console.error(`Could not send reset email to user ${user._id}:`, error.message)
    }
  }

  res.json({ message: 'If this email has an account, we sent a link to reset the password.' })
}

const linkError = (reason) =>
  new AppError(400, 'RULE_BROKEN', 'This link has expired or does not work any more. Please ask for a new one.', { reason })

// POST /api/auth/reset-password
export async function resetPassword(req, res) {
  const { token: raw, password } = req.valid.body
  const tokenHash = hashToken(raw)

  // Hash first (slow), so the link is used up only when everything else is ready
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS) // SEC-01
  const now = new Date()

  // Mark the link as used in one atomic step, so it works only once
  const token = await AuthToken.findOneAndUpdate(
    { tokenHash, type: 'reset_password', usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  )
  if (!token) {
    const old = await AuthToken.findOne({ tokenHash, type: 'reset_password' })
    throw linkError(old && !old.usedAt && old.expiresAt <= now ? 'link_expired' : 'link_invalid')
  }

  // The link proves the person owns the email, so it also verifies it (decided 2026-10-01)
  const updated = await User.updateOne(
    { _id: token.userId, status: 'active', deletedAt: null },
    { $set: { passwordHash, emailVerified: true, passwordChangedAt: now } }, // requireAuth refuses older access tokens
  )
  if (updated.matchedCount === 0) throw linkError('link_invalid') // blocked or deleted meanwhile

  // Log out all devices (refresh tokens; access tokens are stopped by passwordChangedAt),
  // and remove any other reset links
  await AuthToken.deleteMany({ userId: token.userId, type: { $in: ['refresh', 'reset_password'] } })

  res.json({ message: 'Password changed. Please log in with your new password.' })
}
