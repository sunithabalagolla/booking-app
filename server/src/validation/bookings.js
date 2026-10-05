import mongoose from 'mongoose'
import { z } from 'zod'

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
