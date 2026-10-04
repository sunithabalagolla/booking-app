import { formatShortDay, formatTime12, SHOW_LABEL_NAMES } from '../../validation/shows.js'

// U-05 Home helpers ("Stage" design, docs/home-design.md). Plain functions, so they are easy to test.

export const NOW_SHOWING_LIMIT = 50
export const COMING_SOON_LIMIT = 20

// The marquee banner shows the busiest movie of the city: the list comes most shows first
export const bannerMovie = (nowShowing) => nowShowing[0] ?? null

// UI-44 style empty state for a city without shows this week
export const noShowsText = (cityName) => `No shows in ${cityName} this week. The projector is resting.`

// Banner "TODAY IN [CITY]" chips: the movie's shows of one day from GET /api/movies/:id/shows
// (all theatres), in time order, the same label + time only once, at most `max`.
export function showChips(items, max = 6) {
  const seen = new Set()
  return items
    .flatMap((group) => group.shows)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .filter((show) => {
      const key = `${show.label} ${show.startTime}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, max)
    .map((show) => ({ key: `${show.label}-${show.startTime}`, text: `${SHOW_LABEL_NAMES[show.label]} · ${formatTime12(show.startTime)}` }))
}

// UI-26 ticker: coming soon movies with their dates first (deals, admin messages later)
export function tickerMessages(comingSoon, today) {
  return comingSoon.map((movie) => (movie.releaseDate > today ? `${movie.title} – releases ${formatShortDay(movie.releaseDate)}` : `${movie.title} – out now`))
}
