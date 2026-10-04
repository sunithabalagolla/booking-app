import { GENRES, LANGUAGES } from '../../config/movieOptions.js'

// U-06 search + filters (SF-08). The filters live in the page address
// (/movies?q=monsoon&language=Tamil,Telugu&subtitles=1), so Back and shared links work.
// Plain functions, so they are easy to test.

export const SEARCH_LIMIT = 50 // no paging for now (decided 2026-10-04)

export const SHOW_FILTERS = [
  { key: 'subtitles', label: 'Subtitles' },
  { key: 'wheelchair', label: 'Wheelchair-friendly screen' },
  { key: 'parentBaby', label: 'Parent-and-baby show' },
]

export const EMPTY_FILTERS = { q: '', language: [], genre: [], format: '', subtitles: false, wheelchair: false, parentBaby: false }

// Only values from the fixed lists, in list order (a typed address cannot add others)
const pick = (text, options) => {
  const values = (text ?? '').split(',')
  return options.filter((o) => values.includes(o))
}

// URLSearchParams → filters
export function filtersFromParams(params) {
  return {
    q: params.get('q') ?? '',
    language: pick(params.get('language'), LANGUAGES),
    genre: pick(params.get('genre'), GENRES),
    format: ['2D', '3D'].includes(params.get('format')) ? params.get('format') : '',
    subtitles: params.get('subtitles') === '1',
    wheelchair: params.get('wheelchair') === '1',
    parentBaby: params.get('parentBaby') === '1',
  }
}

// filters → the short page address part (empty values left out)
export function paramsFromFilters(filters) {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set('q', filters.q.trim())
  if (filters.language.length) params.set('language', filters.language.join(','))
  if (filters.genre.length) params.set('genre', filters.genre.join(','))
  if (filters.format) params.set('format', filters.format)
  for (const { key } of SHOW_FILTERS) if (filters[key]) params.set(key, '1')
  return params
}

// filters → the API query (GET /api/movies; booleans as "true")
export function apiQuery(filters) {
  const query = {}
  if (filters.q.trim()) query.q = filters.q.trim()
  if (filters.language.length) query.language = filters.language.join(',')
  if (filters.genre.length) query.genre = filters.genre.join(',')
  if (filters.format) query.format = filters.format
  for (const { key } of SHOW_FILTERS) if (filters[key]) query[key] = 'true'
  return query
}

// How many filters are on (the search text does not count): "Filters (3)"
export function activeFilterCount(filters) {
  return filters.language.length + filters.genre.length + (filters.format ? 1 : 0) + SHOW_FILTERS.filter(({ key }) => filters[key]).length
}

// Format or SF-08 on → Coming soon movies cannot match (they have no shows yet)
export const hasShowFilter = (filters) => Boolean(filters.format) || SHOW_FILTERS.some(({ key }) => filters[key])

// UI-44
export const NO_RESULTS_TEXT = 'This reel is not in our cans. Try another name.'
