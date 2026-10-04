import { describe, expect, it } from 'vitest'
import { movieMeta, releaseLabel } from '../../validation/movies.js'
import { bannerMovie, noShowsText } from './home.js'

// U-05 Home helpers
describe('home helpers (U-05)', () => {
  it('certificate + languages', () => {
    expect(movieMeta({ certificate: 'UA', languages: ['Hindi', 'English'] })).toBe('UA · Hindi, English')
  })

  it('coming soon release label', () => {
    expect(releaseLabel('2026-10-09', '2026-10-04')).toBe('From Fri 9 Oct')
    expect(releaseLabel('2026-10-04', '2026-10-04')).toBe('Out now')
  })

  it('banner = the first (busiest) movie, none for an empty list', () => {
    expect(bannerMovie([{ id: 'a' }, { id: 'b' }])).toEqual({ id: 'a' })
    expect(bannerMovie([])).toBe(null)
  })

  it('empty city text', () => {
    expect(noShowsText('Chennai')).toBe('No shows in Chennai this week. The projector is resting.')
  })
})
