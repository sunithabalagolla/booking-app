import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { AppError } from '../utils/AppError.js'
import { verifyAccessToken } from '../utils/tokens.js'

// Needs a valid access token: "Authorization: Bearer <token>" (api.md 1.2).
// Loads the user from the database on every request, so a blocked user is
// stopped at once, even with a token that has not expired yet.
// Role checks (ROLE-01) are added in their own task.
export async function requireAuth(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')
  if (!match) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.')
  }

  let payload
  try {
    payload = verifyAccessToken(match[1])
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // The client refreshes the token and repeats the request
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your login has expired.')
    }
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.')
  }

  const user = await User.findById(payload.sub)
  if (!user || user.deletedAt) {
    throw new AppError(401, 'UNAUTHORIZED', 'Please log in to continue.')
  }
  if (user.status === 'blocked') {
    throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account is blocked. Please contact support.')
  }

  req.user = user
  next()
}
