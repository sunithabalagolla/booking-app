// A-03: which buttons an owner row shows (decided 2026-10-01). Plain function, tested.
//   pending + email verified → Approve, Reject
//   pending, email not verified → nothing (waits for the email)
//   rejected → Approve (the admin can change their mind)
//   approved → Block / Unblock (an approved owner is not rejected)
export function ownerActions(owner) {
  if (owner.approvalStatus === 'approved') return [owner.status === 'blocked' ? 'unblock' : 'block']
  if (!owner.emailVerified) return []
  if (owner.approvalStatus === 'pending') return ['approve', 'reject']
  return ['approve']
}

export const APPROVAL_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
export const APPROVAL_TONES = { pending: 'mustard', approved: 'green', rejected: 'maroon' }
