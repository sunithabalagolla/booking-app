import { describe, expect, it } from 'vitest'
import { formatDuration, movieMeta, releaseLabel } from '../../validation/movies.js'
import { bannerMovie, noShowsText, showChips, tickerMessages } from './home.js'

// U-05 Home helpers
describe('home helpers (U-05)', () => {
  it('certificate + languages', () => {
    expect(movieMeta({ certificate: 'UA', languages: ['Hindi', 'English'] })).toBe('UA · Hindi, English')
  })

  it('coming soon release label', () => {
    expect(releaseLabel('2026-10-09', '2026-10-04')).toBe('Releases Fri 9 Oct')
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

describe('Stage banner + ticker helpers', () => {
  it('duration like "2h 36m"', () => {
    expect([156, 120, 45, 98].map(formatDuration)).toEqual(['2h 36m', '2h', '45m', '1h 38m'])
  })

  it('show chips: all theatres, time order, each label + time once, at most 6', () => {
    const items = [
      { shows: [{ label: 'second', startTime: '21:45' }, { label: 'matinee', startTime: '13:00' }] },
      { shows: [{ label: 'matinee', startTime: '13:00' }, { label: 'morning', startTime: '09:30' }] },
    ]
    expect(showChips(items).map((c) => c.text)).toEqual(['Morning show · 9:30 AM', 'Matinee · 1:00 PM', 'Second show · 9:45 PM'])
    const many = [{ shows: Array.from({ length: 9 }, (_, i) => ({ label: 'first', startTime: `1${i}:00` })) }]
    expect(showChips(many)).toHaveLength(6)
    expect(showChips([])).toEqual([])
  })

  it('ticker: coming soon movies with their dates', () => {
    const soon = [
      { title: 'Star Voyage 1983', releaseDate: '2026-11-03' },
      { title: 'Old', releaseDate: '2026-10-01' },
    ]
    expect(tickerMessages(soon, '2026-10-04')).toEqual(['Star Voyage 1983 – releases Tue 3 Nov', 'Old – out now'])
  })
})
