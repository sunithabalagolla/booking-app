import { z } from 'zod'
import { CERTIFICATES, GENRES, LANGUAGES, MOVIE_STATUSES } from '../config/movieOptions.js'

// A-02 movie form. Same rules as the server (server/src/validation/movies.js);
// the server checks again.

const isRealDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day)

export const movieFormSchema = z.object({
  title: z.string().trim().min(1, { error: 'Please enter the title.' }).max(150, { error: 'Title can have at most 150 characters.' }),
  posterUrl: z.string().min(1, { error: 'Please upload a poster.' }),
  trailerUrl: z
    .string()
    .trim()
    .refine((url) => url === '' || /^https:\/\/\S+$/.test(url), { error: 'The trailer link must start with https://' }),
  cast: z
    .array(z.object({ name: z.string().trim().min(1, { error: 'Please enter the name.' }).max(80), photoUrl: z.string().optional() }))
    .max(30, { error: 'At most 30 cast members.' }),
  genres: z.array(z.enum(GENRES)).min(1, { error: 'Please pick at least 1 genre.' }),
  languages: z.array(z.enum(LANGUAGES)).min(1, { error: 'Please pick at least 1 language.' }),
  // The form field is text; it must be a whole number of minutes
  durationMinutes: z
    .string()
    .trim()
    .regex(/^\d+$/, { error: 'Please enter the duration in whole minutes.' })
    .transform(Number)
    .pipe(z.number().min(30, { error: 'Duration must be at least 30 minutes.' }).max(300, { error: 'Duration can be at most 300 minutes.' })),
  certificate: z.enum(CERTIFICATES, { error: 'Please pick U, UA or A.' }),
  releaseDate: z.string().refine(isRealDay, { error: 'Please pick a date.' }),
  status: z.enum(MOVIE_STATUSES, { error: 'Please pick a status.' }),
})

// Empty form for "+ Add movie"
export const EMPTY_MOVIE = {
  title: '',
  posterUrl: '',
  trailerUrl: '',
  cast: [],
  genres: [],
  languages: [],
  durationMinutes: '',
  certificate: '',
  releaseDate: '',
  status: 'coming_soon',
}

// A movie from the API → form values (numbers become text, empty photo left out)
export function movieToForm(movie) {
  return {
    title: movie.title,
    posterUrl: movie.posterUrl,
    trailerUrl: movie.trailerUrl ?? '',
    cast: movie.cast.map((c) => (c.photoUrl ? { name: c.name, photoUrl: c.photoUrl } : { name: c.name })),
    genres: movie.genres,
    languages: movie.languages,
    durationMinutes: String(movie.durationMinutes),
    certificate: movie.certificate,
    releaseDate: movie.releaseDate,
    status: movie.status,
  }
}

// 'YYYY-MM-DD' → "2 Oct 2026" (the day is already in IST, so no time zone maths)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
