import mongoose from 'mongoose'
import { z } from 'zod'
import { pageQuery } from './common.js'
import { FOOD_PICKUPS } from '../models/Booking.js'

// U-12 POST /api/bookings/hold. The client sends only IDs (SEC-10): never prices.
// The seat limit (BR-02) comes from settings, so it is checked in the service.
export const holdBody = z.object({
  showId: z.string({ error: 'Please pick a show.' }).refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid ID.' }),
  seatIds: z
    .array(z.string().regex(/^[A-Z][1-9]\d?$/, { error: 'Not a valid seat.' }), { error: 'Please pick at least one seat.' })
    .min(1, { error: 'Please pick at least one seat.' })
    .max(40, { error: 'Too many seats.' })
    .refine((ids) => new Set(ids).size === ids.length, { error: 'A seat is in the list twice.' }),
})

// U-13: most of one item in one booking (decided 2026-10-06). The menu sends it to the client.
export const MAX_FOOD_QTY = 10

const objectId = (message) => z.string({ error: message }).refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid ID.' })

// PUT /api/bookings/:id/food: the whole food list (empty = no food) + pickup time (SF-06).
// Only IDs and counts: names and prices come from the database (SEC-10).
export const foodBody = z
  .object({
    items: z
      .array(
        z.object({
          foodItemId: objectId('Please pick an item.'),
          qty: z.number({ error: 'Please give a number.' }).int({ error: 'Please give a whole number.' }).min(1, { error: 'At least 1.' }).max(MAX_FOOD_QTY, { error: `Up to ${MAX_FOOD_QTY} of one item.` }),
        }),
        { error: 'Please send the food list.' },
      )
      .max(50, { error: 'Too many items.' })
      .refine((items) => new Set(items.map((i) => i.foodItemId)).size === items.length, { error: 'An item is in the list twice.' }),
    pickup: z.enum(FOOD_PICKUPS, { error: 'Please choose Before movie or Interval.' }).optional(),
  })
  .refine((body) => body.items.length === 0 || body.pickup, { error: 'Please choose Before movie or Interval.', path: ['pickup'] })

// PUT /api/bookings/:id/coupon: the code as typed (any case, spaces around are fine)
export const couponBody = z.object({
  code: z
    .string({ error: 'Please type a coupon code.' })
    .trim()
    .min(1, { error: 'Please type a coupon code.' })
    .max(30, { error: 'This coupon code is too long.' })
    .transform((code) => code.toUpperCase()),
})

// U-18 ticket album: GET /api/bookings?tab=upcoming|past&page&limit (10 per page, decided 2026-10-07)
export const albumQuery = z.object({
  tab: z.enum(['upcoming', 'past']).default('upcoming'),
  page: pageQuery.page,
  limit: z.coerce.number().int().min(1).max(50).default(10),
})
