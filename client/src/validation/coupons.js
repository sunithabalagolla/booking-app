import { z } from 'zod'
import { formatRupees } from './food.js'
import { formatShortDay, istToday } from './shows.js'

// A-06 admin coupons + U-15 Available offers: form ↔ API and display helpers.
// The server checks everything again (and the rules that need the stored coupon).

export const COUPON_STATUSES = ['active', 'scheduled', 'used_up', 'ended']
export const COUPON_STATUS_LABELS = { active: 'Active', scheduled: 'Scheduled', used_up: 'Used up', ended: 'Ended' }
export const COUPON_STATUS_TONES = { active: 'green', scheduled: 'mustard', used_up: 'maroon', ended: 'maroon' }

// Form values are text (inputs); rupees, not paise
export const EMPTY_COUPON = {
  code: '',
  discountType: 'percent',
  value: '',
  maxDiscount: '',
  minAmount: '',
  startDate: istToday(),
  endDate: '',
  totalLimit: '',
  perUserLimit: '',
  cityCodes: [],
  theatreIds: [],
  isPublic: false,
}

const optionalWhole = (max, message) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max), { error: message })

export const couponFormSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, { error: 'Use 3 to 20 letters or numbers, no spaces.' }),
    discountType: z.enum(['percent', 'flat']),
    value: z.string().trim().regex(/^\d+$/, { error: 'Please give a whole number.' }),
    maxDiscount: optionalWhole(5000, 'Whole rupees, ₹1 to ₹5,000.'),
    minAmount: optionalWhole(100000, 'Whole rupees, ₹1 to ₹1,00,000.'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Please pick a date.' }),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Please pick a date.' }),
    totalLimit: optionalWhole(1000000, 'A whole number, 1 or more.'),
    perUserLimit: optionalWhole(1000000, 'A whole number, 1 or more.'),
    cityCodes: z.array(z.string()),
    theatreIds: z.array(z.string()),
    isPublic: z.boolean(),
  })
  .superRefine((f, ctx) => {
    const value = Number(f.value)
    if (f.discountType === 'percent' && (value < 1 || value > 100)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'A percent is 1 to 100.' })
    if (f.discountType === 'flat' && (value < 1 || value > 5000)) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Whole rupees, ₹1 to ₹5,000.' })
    if (f.endDate && f.startDate && f.endDate < f.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date must be on or after the start date.' })
  })

const paiseOrNull = (rupees) => (rupees.trim() === '' ? null : Number(rupees) * 100)
const numberOrNull = (text) => (text.trim() === '' ? null : Number(text))

// Checked form → API body. Flat: value in paise, no max discount. Empty = null (none).
// The code is sent only for a new coupon (it never changes).
export function formToBody(form, { isNew }) {
  const flat = form.discountType === 'flat'
  const body = {
    discountType: form.discountType,
    value: flat ? Number(form.value) * 100 : Number(form.value),
    maxDiscountPaise: flat ? null : paiseOrNull(form.maxDiscount),
    minAmountPaise: paiseOrNull(form.minAmount),
    startDate: form.startDate,
    endDate: form.endDate,
    totalLimit: numberOrNull(form.totalLimit),
    perUserLimit: numberOrNull(form.perUserLimit),
    cityCodes: form.cityCodes,
    theatreIds: form.theatreIds,
    isPublic: form.isPublic,
  }
  if (isNew) body.code = form.code.trim().toUpperCase()
  return body
}

// API coupon → form values (edit)
export function couponToForm(c) {
  const rupees = (paise) => (paise == null ? '' : String(paise / 100))
  return {
    code: c.code,
    discountType: c.discountType,
    value: String(c.discountType === 'flat' ? c.value / 100 : c.value),
    maxDiscount: rupees(c.maxDiscountPaise),
    minAmount: rupees(c.minAmountPaise),
    startDate: c.startDate,
    endDate: c.endDate,
    totalLimit: c.totalLimit == null ? '' : String(c.totalLimit),
    perUserLimit: c.perUserLimit == null ? '' : String(c.perUserLimit),
    cityCodes: c.cityCodes,
    theatreIds: c.theatreIds,
    isPublic: c.isPublic,
  }
}

// "20% off tickets, up to ₹100 · tickets ₹200 or more" / "₹50 off tickets"
export function offerText(c) {
  const main = c.discountType === 'percent' ? `${c.value}% off tickets${c.maxDiscountPaise != null ? `, up to ${formatRupees(c.maxDiscountPaise)}` : ''}` : `${formatRupees(c.value)} off tickets`
  return c.minAmountPaise != null ? `${main} · tickets ${formatRupees(c.minAmountPaise)} or more` : main
}

// "Used 3 / 100", "Used 3" (no limit)
export const usedText = (c) => (c.totalLimit == null ? `Used ${c.usedCount}` : `Used ${c.usedCount} / ${c.totalLimit}`)

// "All cities" or the city names; theatres by name
export function whereText(c, cityNames = {}, theatreNames = {}) {
  if (c.theatreIds.length) return c.theatreIds.map((id) => theatreNames[id] ?? 'A theatre').join(', ')
  if (c.cityCodes.length) return c.cityCodes.map((code) => cityNames[code] ?? code).join(', ')
  return 'All cities'
}

// ISO time → "Ends Mon 4 Jan" (IST day)
export function endsText(endAt) {
  const istDay = new Date(new Date(endAt).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return `Ends ${formatShortDay(istDay)}`
}
