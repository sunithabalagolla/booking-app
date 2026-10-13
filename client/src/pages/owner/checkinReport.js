// O-10 check-in report helpers

// Gate column (BR-08 window): stamp tones from UI-30; "Over" is plain text
export const GATE_STAMPS = {
  open: { tone: 'green', label: 'Gate open' },
  not_open: { tone: 'mustard', label: 'Not open yet' },
  over: { tone: null, label: 'Over' }, // plain text, no stamp
  cancelled: { tone: 'maroon', label: 'Cancelled' },
}

export const anyGateOpen = (items = []) => items.some((show) => show.gate === 'open')

// "67%" of booked tickets that came; "—" when nothing is booked
export function cameShare(booked, came) {
  return booked > 0 ? `${Math.round((came / booked) * 100)}%` : '—'
}

// Booked tickets that have not come (yet)
export const notCome = (booked, came) => Math.max(0, booked - came)
