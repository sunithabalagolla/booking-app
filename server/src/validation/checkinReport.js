import mongoose from 'mongoose'
import { z } from 'zod'
import { dayField } from './common.js'

// O-10 check-in report query (api.md Section 8). Both optional: date = IST day (default today).
export const checkinReportQuery = z.object({
  date: dayField.optional(),
  theatreId: z
    .string()
    .refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid ID.' })
    .optional(),
})
