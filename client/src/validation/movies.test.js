import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import { EMPTY_MOVIE, formatDay, movieFormSchema, movieToForm } from './movies.js'

const good = {
  ...EMPTY_MOVIE,
  title: 'Kadal Kaatru',
  posterUrl: '/api/uploads/files/poster-1.png',
  genres: ['Romance'],
  languages: ['Tamil'],
  durationMinutes: '135',
  certificate: 'U',
  releaseDate: '2026-10-02',
  status: 'now_showing',
}

describe('movieFormSchema (A-02)', () => {
  it('accepts a good movie and turns the duration into a number', () => {
    expect(movieFormSchema.parse(good).durationMinutes).toBe(135)
  })

  it('gives a message for each empty required field of a new form', () => {
    const errors = fieldErrors(movieFormSchema.safeParse(EMPTY_MOVIE).error)
    expect(Object.keys(errors).sort()).toEqual(['certificate', 'durationMinutes', 'genres', 'languages', 'posterUrl', 'releaseDate', 'title'])
  })

  it('refuses a broken duration, date and trailer link', () => {
    const errors = fieldErrors(
      movieFormSchema.safeParse({ ...good, durationMinutes: '12.5', releaseDate: '2026-02-30', trailerUrl: 'http://x' }).error,
    )
    expect(Object.keys(errors).sort()).toEqual(['durationMinutes', 'releaseDate', 'trailerUrl'])
  })
})

describe('movieToForm / formatDay', () => {
  it('turns an API movie into form values', () => {
    const form = movieToForm({ ...good, durationMinutes: 135, trailerUrl: null, cast: [{ name: 'A', photoUrl: null }] })
    expect(form).toMatchObject({ durationMinutes: '135', trailerUrl: '', cast: [{ name: 'A' }] })
  })

  it('shows an IST day the Indian way', () => {
    expect(formatDay('2026-10-02')).toBe('2 Oct 2026')
  })
})

describe('tagline (A-02, optional)', () => {
  it('may be empty, at most 120 characters, and comes back from the API as text', () => {
    const base = { ...EMPTY_MOVIE, title: 'T', posterUrl: '/p.png', genres: ['Drama'], languages: ['Hindi'], durationMinutes: '120', certificate: 'U', releaseDate: '2026-10-04' }
    expect(movieFormSchema.safeParse(base).success).toBe(true)
    expect(movieFormSchema.parse({ ...base, tagline: ' One storm. ' }).tagline).toBe('One storm.')
    expect(movieFormSchema.safeParse({ ...base, tagline: 'x'.repeat(121) }).success).toBe(false)
    expect(movieToForm({ ...base, durationMinutes: 120, cast: [], tagline: null }).tagline).toBe('')
  })
})
