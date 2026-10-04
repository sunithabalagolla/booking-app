import { describe, expect, it } from 'vitest'
import { activeFilterCount, apiQuery, EMPTY_FILTERS, filtersFromParams, hasShowFilter, paramsFromFilters, searchHref, withQ } from './search.js'

// U-06 search + filters in the page address
const full = { q: ' monsoon ', language: ['Tamil', 'Telugu'], genre: ['Action'], format: '3D', subtitles: true, wheelchair: false, parentBaby: true }

describe('search filters (U-06)', () => {
  it('filters → address → filters (round trip)', () => {
    const params = paramsFromFilters(full)
    expect(params.toString()).toBe('q=monsoon&language=Tamil%2CTelugu&genre=Action&format=3D&subtitles=1&parentBaby=1')
    expect(filtersFromParams(params)).toEqual({ ...full, q: 'monsoon' })
  })

  it('empty filters → empty address', () => {
    expect(paramsFromFilters(EMPTY_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('a typed address keeps only known values, in list order', () => {
    const filters = filtersFromParams(new URLSearchParams('language=Klingon,Telugu,Hindi&genre=Western&format=4D&subtitles=yes'))
    expect(filters).toMatchObject({ language: ['Hindi', 'Telugu'], genre: [], format: '', subtitles: false })
  })

  it('API query: lists joined, booleans as "true", empty values left out', () => {
    expect(apiQuery(full)).toEqual({ q: 'monsoon', language: 'Tamil,Telugu', genre: 'Action', format: '3D', subtitles: 'true', parentBaby: 'true' })
    expect(apiQuery(EMPTY_FILTERS)).toEqual({})
  })

  it('counts the filters that are on (not the text); knows when shows are needed', () => {
    expect(activeFilterCount(full)).toBe(6)
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: 'x' })).toBe(0)
    expect(hasShowFilter({ ...EMPTY_FILTERS, language: ['Hindi'] })).toBe(false)
    expect(hasShowFilter({ ...EMPTY_FILTERS, wheelchair: true })).toBe(true)
    expect(hasShowFilter({ ...EMPTY_FILTERS, format: '2D' })).toBe(true)
  })
})

describe('header search box (UI-15)', () => {
  it('Enter opens the Search page with the text', () => {
    expect(searchHref(' tamil ')).toBe('/movies?q=tamil')
    expect(searchHref('  ')).toBe('/movies')
  })

  it('on the Search page it changes only q and keeps the filters', () => {
    const params = new URLSearchParams('q=old&language=Tamil&subtitles=1')
    expect(withQ(params, ' new ').toString()).toBe('q=new&language=Tamil&subtitles=1')
    expect(withQ(params, '').toString()).toBe('language=Tamil&subtitles=1')
    expect(params.get('q')).toBe('old') // the old address is not changed
  })
})
