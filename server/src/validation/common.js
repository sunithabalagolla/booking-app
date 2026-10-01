import mongoose from 'mongoose'
import { z } from 'zod'

// Small shared Zod parts (SEC-06)

// api.md 1.6: ?page=1&limit=20 (max 100)
export const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}

export const idParams = z.object({
  id: z.string().refine((id) => mongoose.isValidObjectId(id), { error: 'Not a valid ID.' }),
})

// 'YYYY-MM-DD' that is a real calendar day
export const dayField = z
  .string({ error: 'Please pick a date.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Please pick a date.' })
  .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day), {
    error: 'Please pick a real date.',
  })

// Image links we save: a Cloudinary https link, or (development) a local upload path
export const imageUrlField = z
  .string()
  .trim()
  .max(500)
  .refine((url) => /^https:\/\/\S+$/.test(url) || /^\/api\/uploads\/files\/[\w.-]+$/.test(url), {
    error: 'Please upload an image.',
  })
