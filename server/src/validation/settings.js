import { z } from 'zod'

// PATCH /api/admin/settings (A-05). Every field optional, at least one.
// Ranges agreed with the developer (2026-10-01).

const whole = (label, min, max, unit = '') =>
  z
    .number({ error: `${label} must be a number.` })
    .int({ error: `${label} must be a whole number.` })
    .min(min, { error: `${label} must be at least ${min}${unit}.` })
    .max(max, { error: `${label} can be at most ${max}${unit}.` })

const percent = (label, max = 100) =>
  z
    .number({ error: `${label} must be a number.` })
    .min(0, { error: `${label} must be at least 0 %.` })
    .max(max, { error: `${label} can be at most ${max} %.` })
    // at most 2 decimals (small tolerance: 0.29 * 100 is 28.999… in floating point)
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-9, { error: `${label} can have at most 2 decimals.` })

const text = (label, max) =>
  z.string({ error: `Please enter the ${label}.` }).trim().min(1, { error: `Please enter the ${label}.` }).max(max, { error: `The ${label} can have at most ${max} characters.` })

// GSTIN: 2-digit state code, 10-character PAN, entity number, 'Z', check character
export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const settingsPatchSchema = z
  .object({
    holdMinutes: whole('Hold time', 1, 60, ' minutes'),
    maxSeatsPerBooking: whole('Max seats', 1, 20),
    convenienceFeePaise: whole('Convenience fee', 0, 50000, ' paise'),
    cancelCutoffMinutes: whole('Cancel cutoff', 0, 1440, ' minutes'),
    userRefundTicketPercent: percent('Ticket refund'),
    userRefundFoodPercent: percent('Food refund'),
    checkinBeforeMinutes: whole('Check-in time', 0, 1440, ' minutes'),
    defaultCleaningBreakMinutes: whole('Cleaning break', 0, 120, ' minutes'),
    commissionPercent: percent('Commission'),
    waitlistOfferMinutes: whole('Waitlist offer time', 1, 60, ' minutes'),
    dealStartMinutes: whole('Deal start', 0, 1440, ' minutes'),
    dealMaxPercent: percent('Max deal discount', 90),
    transferCutoffMinutes: whole('Transfer cutoff', 0, 1440, ' minutes'),
    accessTokenMinutes: whole('Access token life', 5, 60, ' minutes'),
    refreshTokenDays: whole('Refresh token life', 1, 30, ' days'),
    resetLinkMinutes: whole('Reset link life', 10, 120, ' minutes'),
    gst: z
      .object({
        ticketPercent: percent('GST on tickets'),
        foodPercent: percent('GST on food'),
        convenienceFeePercent: percent('GST on the convenience fee'),
        hsnSac: z.object({ ticket: text('HSN / SAC code', 20), food: text('HSN / SAC code', 20), convenienceFee: text('HSN / SAC code', 20) }).partial(),
      })
      .partial(),
    platform: z
      .object({
        companyName: text('company name', 150),
        gstin: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, { error: 'Please enter a valid 15-character GSTIN.' }),
        address: text('address', 300),
      })
      .partial(),
    uploadMaxMb: whole('Upload size', 1, 10, ' MB'),
    posterMaxWidthPx: whole('Poster width', 400, 2000, ' px'),
    // The city list is seeded and cannot be changed here (database.md 5.4)
    cities: z.undefined({ error: 'The city list cannot be changed here.' }),
  })
  .partial()
  .refine((body) => Object.keys(flattenChanges(body)).length > 0, { error: 'Nothing to change.' })

// { gst: { ticketPercent: 12 } } → { 'gst.ticketPercent': 12 }
export function flattenChanges(body, prefix = '') {
  const flat = {}
  for (const [key, value] of Object.entries(body ?? {})) {
    if (value === undefined) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.assign(flat, flattenChanges(value, path))
    else flat[path] = value
  }
  return flat
}
