// Same fixed lists as the server (server/src/config/movieOptions.js), A-02 / U-06.
// movieOptions.test.js checks that both files match.

export const LANGUAGES = ['Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi', 'English']

export const GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'Romance',
  'Thriller',
  'Horror',
  'Family',
  'Animation',
  'Crime',
  'Fantasy',
  'Musical',
  'Historical',
  'Sci-Fi',
  'Mystery',
]

export const CERTIFICATES = ['U', 'UA', 'A']
export const MOVIE_STATUSES = ['coming_soon', 'now_showing', 'inactive']

// Labels and stamp colours for the status (UI-30 stamps)
export const STATUS_LABELS = { coming_soon: 'Coming soon', now_showing: 'Now showing', inactive: 'Inactive' }
export const STATUS_TONES = { coming_soon: 'mustard', now_showing: 'green', inactive: 'maroon' }
