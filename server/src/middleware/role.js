import { AppError } from '../utils/AppError.js'

// ROLE-01: only these roles may call the route. Use after requireAuth.
// Wrong role → 403 FORBIDDEN (api.md 1.3, T-01).
export function requireRole(...roles) {
  return function checkRole(req, res, next) {
    if (!roles.includes(req.user?.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.')
    }
    next()
  }
}

// ROLE-03: owners must be approved by an admin first (pending / rejected → 403).
// Other roles pass through, so this can sit after requireRole('owner').
export function requireApprovedOwner(req, res, next) {
  if (req.user?.role === 'owner' && req.user.owner?.approvalStatus !== 'approved') {
    throw new AppError(403, 'OWNER_NOT_APPROVED', 'Your owner account is waiting for admin approval.')
  }
  next()
}
