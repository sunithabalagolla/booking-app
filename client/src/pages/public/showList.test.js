import { describe, expect, it } from 'vitest'
import {
  amenityText,
  dayStrip,
  fromPrice,
  hasAnyShowFilter,
  paramsFromShowFilters,
  showApiFilters,
  showFiltersFromParams,
  showTags,
  showTimeText,
} from './showList.js'

// U-09 show list helpers. 20:00 UTC on Mon 5 Oct = 1:30 AM on Tue 6 Oct in IST.
const now = new Date('2026-10-05T20:00:00Z')
const LANGS = ['Tamil', 'Telugu']
const show = { label: 'matinee', startTime: '14:30', language: 'Tamil', format: '2D', subtitles: false, tags: [], minPricePaise: 12000 }

describe('day strip (U-09)', () => {
  it('7 IST days: Today, Tomorrow, then weekday names', () => {
    const days = dayStrip(now)
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual({ day: '2026-10-06', name: 'Today', date: '6 Oct' })
    expect(days[1]).toEqual({ day: '2026-10-07', name: 'Tomorrow', date: '7 Oct' })
    expect(days[2]).toEqual({ day: '2026-10-08', name: 'Thu', date: '8 Oct' })
    expect(days[6].day).toBe('2026-10-12')
  })
})

describe('show filters in the address (U-09, SF-08)', () => {
  it('reads the day and filters; bad values are ignored', () => {
    const params = new URLSearchParams('date=2026-10-08&language=Telugu&format=3D&subtitles=1&parentBaby=1')
    expect(showFiltersFromParams(params, LANGS, now)).toEqual({ date: '2026-10-08', language: 'Telugu', format: '3D', subtitles: true, wheelchair: false, parentBaby: true })

    const bad = new URLSearchParams('date=2026-10-20&language=Hindi&format=4D&wheelchair=yes')
    expect(showFiltersFromParams(bad, LANGS, now)).toEqual({ date: '2026-10-06', language: '', format: '', subtitles: false, wheelchair: false, parentBaby: false })
  })

  it('writes a short address (today and empty values left out) and round-trips', () => {
    const filters = { date: '2026-10-06', language: '', format: '', subtitles: false, wheelchair: false, parentBaby: false }
    expect(paramsFromShowFilters(filters, now).toString()).toBe('')
    const more = { ...filters, date: '2026-10-09', format: '2D', wheelchair: true }
    const params = paramsFromShowFilters(more, now)
    expect(params.toString()).toBe('date=2026-10-09&format=2D&wheelchair=1')
    expect(showFiltersFromParams(params, LANGS, now)).toEqual(more)
  })

  it('API extras and "any filter on"', () => {
    const filters = { date: '2026-10-06', language: 'Tamil', format: '', subtitles: true, wheelchair: false, parentBaby: false }
    expect(showApiFilters(filters)).toEqual({ language: 'Tamil', subtitles: 'true' })
    expect(hasAnyShowFilter(filters)).toBe(true)
    expect(hasAnyShowFilter({ ...filters, language: '', subtitles: false })).toBe(false)
  })
})

describe('show time buttons + theatre cards (UI-17)', () => {
  it('label text (BR-22) and tags', () => {
    expect(showTimeText(show)).toBe('Matinee · 2:30 PM')
    expect(showTimeText({ ...show, label: 'second', startTime: '21:15' })).toBe('Second show · 9:15 PM')
    expect(showTags(show, ['Tamil'])).toEqual([])
    expect(showTags({ ...show, format: '3D', subtitles: true, tags: ['parent_baby'] }, LANGS)).toEqual(['Tamil', '3D', 'Subtitles', 'Parent & baby'])
  })

  it('"from" price = the lowest of the day', () => {
    expect(fromPrice([show, { ...show, minPricePaise: 9050 }])).toBe('from ₹90.50')
    expect(fromPrice([show])).toBe('from ₹120')
  })

  it('amenities', () => {
    expect(amenityText({ wheelchairAccess: true, parking: true })).toBe('Wheelchair access · Parking')
    expect(amenityText({ wheelchairAccess: false, parking: false })).toBe('')
  })
})
