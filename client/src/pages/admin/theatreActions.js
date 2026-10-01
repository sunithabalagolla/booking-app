// A-04: which buttons a theatre row shows (same rules as owners, decided 2026-10-01).
//   owner blocked → no buttons (an "Owner blocked" stamp shows instead)
//   pending → Approve, Reject
//   rejected → Approve (the admin can change their mind)
//   approved → none
export function theatreActions(theatre) {
  if (theatre.owner.status === 'blocked') return []
  if (theatre.status === 'pending') return ['approve', 'reject']
  if (theatre.status === 'rejected') return ['approve']
  return []
}
