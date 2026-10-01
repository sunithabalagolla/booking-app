import { z } from 'zod'
import { CERTIFICATES, GENRES, LANGUAGES, MOVIE_STATUSES } from '../config/movieOptions.js'
import { dayField, imageUrlField, pageQuery } from './common.js'

// A-02 movie fields (api.md Section 10). Lists come from config/movieOptions.js.

// A list of picks from a fixed list: at least 1, no doubles
const pickList = (options, label) =>
  z
    .array(z.enum(options, { error: `Unknown ${label}.` }), { error: `Please pick at least 1 ${label}.` })
    .min(1, { error: `Please pick at least 1 ${label}.` })
    .refine((list) => new Set(list).size === list.length, { error: `Each ${label} only once.` })

const movieFields = {
  title: z.string({ error: 'Please enter the title.' }).trim().min(1, { error: 'Please enter the title.' }).max(150, { error: 'Title can have at most 150 characters.' }),
  posterUrl: imageUrlField,
  trailerUrl: z
    .string()
    .trim()
    .max(500)
    .refine((url) => url === '' || /^https:\/\/\S+$/.test(url), { error: 'The trailer link must start with https://' })
    .optional(),
  cast: z
    .array(
      z.object({
        name: z.string({ error: 'Please enter the name.' }).trim().min(1, { error: 'Please enter the name.' }).max(80),
        photoUrl: imageUrlField.optional(),
      }),
    )
    .max(30, { error: 'At most 30 cast members.' })
    .optional(),
  genres: pickList(GENRES, 'genre'),
  languages: pickList(LANGUAGES, 'language'),
  durationMinutes: z
    .number({ error: 'Please enter the duration in minutes.' })
    .int({ error: 'Duration must be whole minutes.' })
    .min(30, { error: 'Duration must be at least 30 minutes.' })
    .max(300, { error: 'Duration can be at most 300 minutes.' }),
  certificate: z.enum(CERTIFICATES, { error: 'Please pick U, UA or A.' }),
  releaseDate: dayField, // IST day (BR-21)
  status: z.enum(MOVIE_STATUSES, { error: 'Please pick a status.' }),
}

export const createMovieSchema = z.object(movieFields)

// PATCH: the same fields, all optional, at least one
export const updateMovieSchema = z
  .object(movieFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })

export const listMoviesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(MOVIE_STATUSES).optional(),
  ...pageQuery,
})
