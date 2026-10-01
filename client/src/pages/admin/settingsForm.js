// A-05 settings page: which fields, how they show, and what to send.
// Plain functions, so they are easy to test (settingsForm.test.js).
//
// type: 'int' (whole number) · 'percent' (up to 2 decimals) · 'rupees' (shown in ₹, saved in paise) · 'text'
// `needed`: empty means bookings cannot open yet (database.md 5.4)

export const SETTINGS_GROUPS = [
  {
    title: 'Booking',
    fields: [
      { path: 'holdMinutes', label: 'Seat hold time', unit: 'minutes', type: 'int', rule: 'BR-01' },
      { path: 'maxSeatsPerBooking', label: 'Max seats per booking', type: 'int', rule: 'BR-02' },
      { path: 'convenienceFeePaise', label: 'Convenience fee per ticket, GST included', unit: '₹', type: 'rupees', rule: 'BR-03' },
    ],
  },
  {
    title: 'Refunds and cancellation',
    fields: [
      { path: 'cancelCutoffMinutes', label: 'Users can cancel until', unit: 'minutes before the show', type: 'int', rule: 'BR-04' },
      { path: 'userRefundTicketPercent', label: 'Ticket refund when the user cancels', unit: '%', type: 'percent', rule: 'BR-05' },
      { path: 'userRefundFoodPercent', label: 'Food refund when the user cancels', unit: '%', type: 'percent', rule: 'BR-05' },
    ],
  },
  {
    title: 'Gate and shows',
    fields: [
      { path: 'checkinBeforeMinutes', label: 'Gate opens', unit: 'minutes before the show', type: 'int', rule: 'BR-08' },
      { path: 'defaultCleaningBreakMinutes', label: 'Cleaning break for new screens', unit: 'minutes', type: 'int', rule: 'BR-09' },
    ],
  },
  {
    title: 'Waitlist, deals and transfer',
    fields: [
      { path: 'waitlistOfferMinutes', label: 'Waitlist offer time', unit: 'minutes', type: 'int', rule: 'BR-13' },
      { path: 'dealStartMinutes', label: 'Last-minute deals start', unit: 'minutes before the show', type: 'int', rule: 'BR-14' },
      { path: 'dealMaxPercent', label: 'Max deal discount', unit: '%', type: 'percent', rule: 'BR-14' },
      { path: 'transferCutoffMinutes', label: 'Ticket transfer allowed until', unit: 'minutes before the show', type: 'int', rule: 'BR-15' },
    ],
  },
  {
    title: 'Commission and GST',
    fields: [
      { path: 'commissionPercent', label: 'Platform commission', unit: '%', type: 'percent', rule: 'BR-11', needed: true },
      { path: 'gst.ticketPercent', label: 'GST on tickets', unit: '%', type: 'percent', rule: 'BR-20', needed: true },
      { path: 'gst.foodPercent', label: 'GST on food', unit: '%', type: 'percent', rule: 'BR-20', needed: true },
      { path: 'gst.convenienceFeePercent', label: 'GST on the convenience fee', unit: '%', type: 'percent', rule: 'BR-20', needed: true },
      { path: 'gst.hsnSac.ticket', label: 'HSN / SAC code: tickets', type: 'text', rule: '11.3', needed: true },
      { path: 'gst.hsnSac.food', label: 'HSN / SAC code: food', type: 'text', rule: '11.3', needed: true },
      { path: 'gst.hsnSac.convenienceFee', label: 'HSN / SAC code: convenience fee', type: 'text', rule: '11.3', needed: true },
    ],
  },
  {
    title: 'Platform company (on invoices)',
    fields: [
      { path: 'platform.companyName', label: 'Company name', type: 'text', rule: '11.3', needed: true },
      { path: 'platform.gstin', label: 'GSTIN', type: 'text', rule: '11.3', needed: true },
      { path: 'platform.address', label: 'Address', type: 'text', rule: '11.3', needed: true },
    ],
  },
  {
    title: 'Login and links',
    fields: [
      { path: 'accessTokenMinutes', label: 'Access token life', unit: 'minutes', type: 'int', rule: 'BR-19' },
      { path: 'refreshTokenDays', label: 'Stay logged in for', unit: 'days', type: 'int', rule: 'BR-19' },
      { path: 'resetLinkMinutes', label: 'Password reset link works for', unit: 'minutes', type: 'int', rule: 'U-03' },
    ],
  },
  {
    title: 'Uploads',
    fields: [
      { path: 'uploadMaxMb', label: 'Max image size', unit: 'MB', type: 'int', rule: 'SEC-11' },
      { path: 'posterMaxWidthPx', label: 'Poster width (Cloudinary resizes)', unit: 'px', type: 'int', rule: 'NF-08' },
    ],
  },
]

export const ALL_FIELDS = SETTINGS_GROUPS.flatMap((g) => g.fields)

export const valueAt = (obj, path) => path.split('.').reduce((v, key) => v?.[key], obj)

// Settings from the API → form text (empty string for "not set")
export function settingsToForm(settings) {
  const form = {}
  for (const field of ALL_FIELDS) {
    const value = valueAt(settings, field.path)
    if (value == null) form[field.path] = ''
    else if (field.type === 'rupees') form[field.path] = (value / 100).toFixed(2)
    else form[field.path] = String(value)
  }
  return form
}

const PATTERNS = {
  int: [/^\d+$/, 'Please enter a whole number.'],
  percent: [/^\d+(\.\d{1,2})?$/, 'Please enter a number (up to 2 decimals).'],
  rupees: [/^\d+(\.\d{1,2})?$/, 'Please enter an amount in rupees, e.g. 30 or 30.50.'],
}

// Form text → { body, errors }. `body` has only the fields that changed, nested
// like the API wants ({ gst: { ticketPercent: 18 } }). The server checks the ranges.
export function formToChanges(form, settings) {
  const body = {}
  const errors = {}
  for (const field of ALL_FIELDS) {
    const raw = (form[field.path] ?? '').trim()
    const before = valueAt(settings, field.path)

    if (raw === '') {
      if (before != null) errors[field.path] = 'Please enter a value.' // a saved value cannot be emptied
      continue
    }

    let value = raw
    if (field.type !== 'text') {
      const [pattern, message] = PATTERNS[field.type]
      if (!pattern.test(raw)) {
        errors[field.path] = message
        continue
      }
      value = field.type === 'rupees' ? Math.round(Number(raw) * 100) : Number(raw)
    }
    if (value === before) continue

    // 'gst.hsnSac.ticket' → body.gst.hsnSac.ticket
    const keys = field.path.split('.')
    let target = body
    for (const key of keys.slice(0, -1)) target = target[key] ??= {}
    target[keys.at(-1)] = value
  }
  return { body, errors }
}

// The seed fills TEST values (made-up HSN codes, "(TEST)" company). Show a warning.
export function hasTestValues(settings) {
  const codes = Object.values(settings?.gst?.hsnSac ?? {})
  return codes.some((code) => typeof code === 'string' && code.startsWith('TEST-')) || /\(TEST\)/.test(settings?.platform?.companyName ?? '')
}
