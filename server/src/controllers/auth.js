import bcrypt from 'bcrypt'
import { AuthToken } from '../models/AuthToken.js'
import { User } from '../models/User.js'
import { sendEmail } from '../services/email/index.js'
import { verifyEmailTemplate } from '../services/email/templates.js'
import { AppError } from '../utils/AppError.js'
import { createToken, hashToken } from '../utils/tokens.js'

const BCRYPT_ROUNDS = 12
export const VERIFY_LINK_HOURS = 24 // U-01

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173'

// Makes a new verify link for the user (old links stop working) and sends E-01
async function sendVerifyEmail(user) {
  await AuthToken.deleteMany({ userId: user._id, type: 'verify_email' })

  const { token, tokenHash } = createToken()
  await AuthToken.create({
    userId: user._id,
    type: 'verify_email',
    tokenHash,
    expiresAt: new Date(Date.now() + VERIFY_LINK_HOURS * 60 * 60 * 1000),
  })

  const link = `${clientUrl()}/verify-email?token=${encodeURIComponent(token)}`
  const email = verifyEmailTemplate({ name: user.name, link, hours: VERIFY_LINK_HOURS })
  try {
    await sendEmail({ to: user.email, ...email })
  } catch (error) {
    // The account is saved; the user can press "Resend" later
    console.error(`Could not send verify email to user ${user._id}:`, error.message)
  }
}

// POST /api/auth/signup (U-01)
export async function signup(req, res) {
  const { name, email, password } = req.valid.body

  if (await User.exists({ email })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'This email already has an account. Log in, or resend the verify email.')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS) // SEC-01
  const user = await User.create({ name, email, passwordHash, role: 'user' })
  await sendVerifyEmail(user)

  res.status(201).json({ message: 'Account created. Please check your email to verify it.', email: user.email })
}

// POST /api/auth/verify-email (U-01)
export async function verifyEmail(req, res) {
  const tokenHash = hashToken(req.valid.body.token)
  const now = new Date()

  // Mark the link as used in one atomic step, so it works only once
  const token = await AuthToken.findOneAndUpdate(
    { tokenHash, type: 'verify_email', usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  )

  if (!token) {
    // Why did it fail? Give the client a clear reason.
    const old = await AuthToken.findOne({ tokenHash, type: 'verify_email' })
    if (old?.usedAt) {
      const user = await User.findById(old.userId)
      // Link already used and the account is verified (e.g. link opened twice): that is fine
      if (user?.emailVerified) return res.json({ message: 'Your email is already verified.', alreadyVerified: true })
    }
    const reason = old && old.expiresAt <= now ? 'link_expired' : 'link_invalid'
    throw new AppError(400, 'RULE_BROKEN', 'This link has expired or does not work any more. Please ask for a new one.', { reason })
  }

  await User.updateOne({ _id: token.userId }, { $set: { emailVerified: true } })
  res.json({ message: 'Email verified. You can log in now.' })
}

// POST /api/auth/resend-verify (U-01). Always answers the same, so nobody can
// find out which emails have an account.
export async function resendVerify(req, res) {
  const { email } = req.valid.body
  const user = await User.findOne({ email, emailVerified: false, status: 'active', deletedAt: null })
  if (user && ['user', 'owner'].includes(user.role)) {
    await sendVerifyEmail(user)
  }
  res.json({ message: 'If this email has an account that is not verified yet, we sent a new link.' })
}
