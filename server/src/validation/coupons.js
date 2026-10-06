import mongoose from 'mongoose'
import { z } from 'zod'
import { COUPON_TYPES } from '../models/Coupon.js'
import { dayField, pageQuery } from './common.js'

// A-06 admin coupons (api.md Section 10). Shapes of single fields only; the rules that
// need several fields or the stored coupon (percent 1–100, end after start, total limit
// not under what is used …) are in controllers/adminCoupons.js (couponRules), because a
// PATCH sends only the changed fields.

export const COUPON_STATUSES = ['scheduled', 'active', 'ended', 'used_up']

// Whole rupees, as paise (like food prices, decided 2026-10-04)
const wholeRupees = (min, max, label) =>
  z
    .number({ error: `Please give ${label}.` })
    .int({ error: 'Whole rupees only.' })
    .min(min, { error: `At least ₹${min / 100}.` })
    .max(max, { error: `At most ₹${(max / 100).toLocaleString('en-IN')}.` })
    .refine((paise) => paise % 100 === 0, { error: 'Whole rupees only.' })
const count = z.number({ error: 'Please give a number.' }).int({ error: 'Please give a whole number.' }).min(1, { error: 'At least 1.' }).max(1000000, { error: 'Too big.' })

const fields = {
  discountType: z.enum(COUPON_TYPES, { error: 'Please pick Percent or Flat.' }),
  value: z.number({ error: 'Please give the discount.' }).int({ error: 'Please give a whole number.' }).min(1, { error: 'At least 1.' }).max(500000, { error: 'Too big.' }),
  minAmountPaise: wholeRupees(100, 10000000, 'an amount').nullable(), // of the tickets; null = none
  maxDiscountPaise: wholeRupees(100, 500000, 'an amount').nullable(), // percent coupons only
  startDate: dayField, // IST whole days (decided 2026-10-06): from 12:00 AM …
  endDate: dayField, // … to 11:59 PM IST
  totalLimit: count.nullable(), // null = no limit
  perUserLimit: count.nullable(),
  cityCodes: z.array(z.string().trim().min(1).max(40), { error: 'Please send a list.' }).max(50),
  theatreIds: z.array(z.string().refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid ID.' }), { error: 'Please send a list.' }).max(200),
  isPublic: z.boolean({ error: 'Please say yes or no.' }), // "Show to users"
}

export const couponCode = z
  .string({ error: 'Please type a code.' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{3,20}$/, { error: 'Use 3 to 20 letters or numbers, no spaces.' })

export const createCouponSchema = z.object({
  code: couponCode,
  discountType: fields.discountType,
  value: fields.value,
  minAmountPaise: fields.minAmountPaise.optional(),
  maxDiscountPaise: fields.maxDiscountPaise.optional(),
  startDate: fields.startDate,
  endDate: fields.endDate,
  totalLimit: fields.totalLimit.optional(),
  perUserLimit: fields.perUserLimit.optional(),
  cityCodes: fields.cityCodes.default([]),
  theatreIds: fields.theatreIds.default([]),
  isPublic: fields.isPublic.default(false),
})

// PATCH: every field optional (not the code: it never changes), at least one
export const updateCouponSchema = z
  .object(Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])))
  .refine((body) => Object.values(body).some((v) => v !== undefined), { error: 'Nothing to change.' })

export const listCouponsQuery = z.object({
  q: z.string().trim().max(20).optional(), // start of the code, any case
  status: z.enum(COUPON_STATUSES).optional(),
  ...pageQuery,
})
