// U-05 Home helpers. Plain functions, so they are easy to test.

export const NOW_SHOWING_LIMIT = 50
export const COMING_SOON_LIMIT = 20

// The marquee banner shows the busiest movie of the city: the list comes most shows first
export const bannerMovie = (nowShowing) => nowShowing[0] ?? null

// UI-44 style empty state for a city without shows this week
export const noShowsText = (cityName) => `No shows in ${cityName} this week. The projector is resting.`
