import { formatRupees } from '../../validation/food.js'
import { formatShortDay, formatTime12, istToday, SHOW_LABEL_NAMES } from '../../validation/shows.js'
import { SHOW_FILTERS } from './search.js'

// U-09 show list (UI-17) on the movie details page. The day and the SF-08 filters live
// in the page address (/movies/:id?date=2026-10-07&format=3D&subtitles=1), so refresh,
// Back and shared links keep them. Plain functions, so they are easy to test.

export const SHOW_DAYS = 7 // today … +6 (U-09, same limit as the API)

// The 7 day buttons: "Today", "Tomorrow", then "Wed" (+ "7 Oct" under each)
export function dayStrip(now = new Date()) {
  return Array.from({ length: SHOW_DAYS }, (_, i) => {
    const day = istToday(i, now)
    const [weekday, date, month] = formatShortDay(day).split(' ')
    return { day, name: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekday, date: `${date} ${month}` }
  })
}

// URLSearchParams → { date, language, format, subtitles, wheelchair, parentBaby }.
// A day outside the strip or a language the movie does not have is ignored.
export function showFiltersFromParams(params, movieLanguages, now = new Date()) {
  const days = dayStrip(now).map((d) => d.day)
  const date = params.get('date')
  return {
    date: days.includes(date) ? date : days[0],
    language: movieLanguages.includes(params.get('language')) ? params.get('language') : '',
    format: ['2D', '3D'].includes(params.get('format')) ? params.get('format') : '',
    subtitles: params.get('subtitles') === '1',
    wheelchair: params.get('wheelchair') === '1',
    parentBaby: params.get('parentBaby') === '1',
  }
}

// filters → the page address (today and empty values left out, so the plain link stays short)
export function paramsFromShowFilters(filters, now = new Date()) {
  const params = new URLSearchParams()
  if (filters.date !== istToday(0, now)) params.set('date', filters.date)
  if (filters.language) params.set('language', filters.language)
  if (filters.format) params.set('format', filters.format)
  for (const { key } of SHOW_FILTERS) if (filters[key]) params.set(key, '1')
  return params
}

// filters → the API query extras (city + date are sent separately)
export function showApiFilters(filters) {
  const query = {}
  if (filters.language) query.language = filters.language
  if (filters.format) query.format = filters.format
  for (const { key } of SHOW_FILTERS) if (filters[key]) query[key] = 'true'
  return query
}

export const hasAnyShowFilter = (filters) => Boolean(filters.language || filters.format) || SHOW_FILTERS.some(({ key }) => filters[key])

// "Matinee · 2:30 PM" (BR-22 label from the server)
export const showTimeText = (show) => `${SHOW_LABEL_NAMES[show.label]} · ${formatTime12(show.startTime)}`

// Small tags under a show time. The language only when the movie has more than one.
export function showTags(show, movieLanguages) {
  const tags = []
  if (movieLanguages.length > 1) tags.push(show.language)
  if (show.format === '3D') tags.push('3D')
  if (show.subtitles) tags.push('Subtitles')
  if (show.tags.includes('parent_baby')) tags.push('Parent & baby')
  return tags
}

// "from ₹120": the lowest ticket price of the theatre's shows that day
export const fromPrice = (shows) => `from ${formatRupees(Math.min(...shows.map((s) => s.minPricePaise)))}`

// "Wheelchair access · Parking"
export function amenityText(amenities = {}) {
  return [amenities.wheelchairAccess && 'Wheelchair access', amenities.parking && 'Parking'].filter(Boolean).join(' · ')
}

// UI-44
export const NO_SHOWS_TEXT = 'No shows today. The projector is resting.'
export const NO_FILTERED_SHOWS_TEXT = 'No shows match these filters on this day.'
