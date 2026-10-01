import { z } from 'zod'
import { GST_STATE_CODES, gstinMatchesState } from '../config/gstStates.js'

// O-03 theatre form. Same rules as the server (server/src/validation/theatres.js);
// the server checks again.

export const MAX_THEATRE_PHOTOS = 6
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

// `cities` = the fixed list from GET /api/owner/cities (for the GSTIN state check)
export function theatreFormSchema(cities) {
  return z
    .object({
      name: z.string().trim().min(1, { error: 'Please enter the theatre name.' }).max(100, { error: 'The name can have at most 100 characters.' }),
      cityCode: z.string().min(1, { error: 'Please pick a city.' }),
      address: z.string().trim().min(5, { error: 'Please enter the full address.' }).max(300, { error: 'The address can have at most 300 characters.' }),
      mapLink: z
        .string()
        .trim()
        .refine((url) => url === '' || /^https:\/\/\S+$/.test(url), { error: 'The map link must start with https://' }),
      photos: z.array(z.string()).max(MAX_THEATRE_PHOTOS, { error: `At most ${MAX_THEATRE_PHOTOS} photos.` }),
      gstin: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, { error: 'Please enter a valid 15-character GSTIN.' }),
      amenities: z.object({ wheelchairAccess: z.boolean(), parking: z.boolean() }),
    })
    .superRefine((form, ctx) => {
      const city = cities.find((c) => c.code === form.cityCode)
      if (city && GSTIN_PATTERN.test(form.gstin) && !gstinMatchesState(form.gstin, city.state)) {
        ctx.addIssue({
          code: 'custom',
          path: ['gstin'],
          message: `This GSTIN is not for ${city.state}. A theatre in ${city.name} needs a GSTIN that starts with ${GST_STATE_CODES[city.state] ?? '??'}.`,
        })
      }
    })
}

export const EMPTY_THEATRE = {
  name: '',
  cityCode: '',
  address: '',
  mapLink: '',
  photos: [],
  gstin: '',
  amenities: { wheelchairAccess: false, parking: false },
}

// A theatre from the API → form values
export function theatreToForm(theatre) {
  return {
    name: theatre.name,
    cityCode: theatre.city.code,
    address: theatre.address,
    mapLink: theatre.mapLink ?? '',
    photos: theatre.photos,
    gstin: theatre.gstin,
    amenities: { ...theatre.amenities },
  }
}

export const THEATRE_STATUS_LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
export const THEATRE_STATUS_TONES = { pending: 'mustard', approved: 'green', rejected: 'maroon' }
