// The user data the browser may see (api.md Section 3).
// Only the parts for that role; never the password hash.
export function publicUser(user) {
  const data = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    prefs: {
      theme: user.prefs?.theme ?? 'auto',
      sound: user.prefs?.sound ?? false,
      reduceMotion: user.prefs?.reduceMotion ?? false,
    },
  }

  if (user.role === 'user') {
    data.badges = (user.badges ?? []).map((b) => ({ code: b.code, earnedAt: b.earnedAt }))
    data.enteredCount = user.enteredCount ?? 0
  }
  if (user.role === 'owner' && user.owner) {
    data.owner = {
      businessName: user.owner.businessName,
      approvalStatus: user.owner.approvalStatus,
      rejectReason: user.owner.rejectReason ?? null,
    }
  }
  if (user.role === 'staff' && user.staff) {
    data.staff = { theatreIds: user.staff.theatreIds.map(String) }
  }
  return data
}
