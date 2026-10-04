import mongoose from 'mongoose'
import { z } from 'zod'
import { LANGUAGES } from '../config/movieOptions.js'
import { SHOW_TAGS } from '../models/Show.js'
import { SEAT_CLASSES } from '../utils/seatLayout.js'
import { dayField, pageQuery } from './common.js'

// O-05 show fields (api.md Section 8). Rules that need the database (movie, screen,
// theatre, dates, overlap) are checked in controllers/ownerShows.js.

export const MAX_DATES_PER_REQUEST = 14
export const MAX_DAYS_AHEAD = 30
export const MIN_TICKET_PAISE = 100
export const MAX_TICKET_PAISE = 500000

const idField = (message) => z.string({ error: message }).refine((id) => mongoose.isValidObjectId(id), { error: message })
const priceMessage = 'Each price must be whole rupees from ₹1 to ₹5,000.'

const showFields = {
  movieId: idField('Please pick a movie.'),
  screenId: idField('Please pick a screen.'),
  startTime: z.string({ error: 'Please enter the start time.' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Please enter the start time.' }), // HH:mm IST
  language: z.enum(LANGUAGES, { error: 'Please pick a language.' }),
  format: z.enum(['2D', '3D'], { error: 'Please pick 2D or 3D.' }),
  subtitles: z.boolean(),
  tags: z
    .array(z.enum(SHOW_TAGS))
    .max(SHOW_TAGS.length)
    .refine((tags) => new Set(tags).size === tags.length, { error: 'Each tag only once.' }),
  // Whole rupees ₹1–₹5,000 per seat class (decided 2026-10-04); which classes is checked against the screen
  prices: z
    .array(
      z.object({
        seatClass: z.enum(SEAT_CLASSES),
        pricePaise: z
          .number({ error: priceMessage })
          .int({ error: priceMessage })
          .min(MIN_TICKET_PAISE, { error: priceMessage })
          .max(MAX_TICKET_PAISE, { error: priceMessage })
          .refine((paise) => paise % 100 === 0, { error: priceMessage }),
      }),
    )
    .min(1, { error: 'Please enter the prices.' })
    .refine((prices) => new Set(prices.map((p) => p.seatClass)).size === prices.length, { error: 'Each seat class only once.' }),
}

// dates: IST days, one show per day, all or none
export const createShowSchema = z.object({
  ...showFields,
  subtitles: showFields.subtitles.default(false),
  tags: showFields.tags.default([]),
  dates: z
    .array(dayField, { error: 'Please pick at least one date.' })
    .min(1, { error: 'Please pick at least one date.' })
    .max(MAX_DATES_PER_REQUEST, { error: `At most ${MAX_DATES_PER_REQUEST} dates at once.` })
    .refine((dates) => new Set(dates).size === dates.length, { error: 'Each date only once.' }),
})

// Edit one show: the same fields, `date` instead of `dates`
export const updateShowSchema = z
  .object({ ...showFields, date: dayField })
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })

// GET /api/owner/shows: from / to are IST days
export const listShowsQuery = z.object({
  theatreId: idField('Not a valid ID.').optional(),
  screenId: idField('Not a valid ID.').optional(),
  from: dayField.optional(),
  to: dayField.optional(),
  ...pageQuery,
})
