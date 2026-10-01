import { z } from 'zod'
import { imageUrlField } from './common.js'
import { GSTIN_PATTERN } from './settings.js'

// O-03 theatre fields (api.md Section 8). The city and the GSTIN state are
// checked against settings in the controller.

export const MAX_THEATRE_PHOTOS = 6

const theatreFields = {
  name: z.string({ error: 'Please enter the theatre name.' }).trim().min(1, { error: 'Please enter the theatre name.' }).max(100, { error: 'The name can have at most 100 characters.' }),
  cityCode: z.string({ error: 'Please pick a city.' }).trim().min(1, { error: 'Please pick a city.' }).max(50),
  address: z.string({ error: 'Please enter the address.' }).trim().min(5, { error: 'Please enter the full address.' }).max(300, { error: 'The address can have at most 300 characters.' }),
  mapLink: z
    .string()
    .trim()
    .max(500)
    .refine((url) => url === '' || /^https:\/\/\S+$/.test(url), { error: 'The map link must start with https://' })
    .optional(),
  photos: z.array(imageUrlField).max(MAX_THEATRE_PHOTOS, { error: `At most ${MAX_THEATRE_PHOTOS} photos.` }).optional(),
  gstin: z.string({ error: 'Please enter the GSTIN.' }).trim().toUpperCase().regex(GSTIN_PATTERN, { error: 'Please enter a valid 15-character GSTIN.' }),
  amenities: z
    .object({
      wheelchairAccess: z.boolean().optional(),
      parking: z.boolean().optional(),
    })
    .optional(),
}

export const createTheatreSchema = z.object(theatreFields)

export const updateTheatreSchema = z
  .object(theatreFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })
