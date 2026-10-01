// Fixed lists for movies (A-02, U-06 filters). One place, so filters stay clean
// ("Hindi", never "hindi"). The client has the same lists in
// client/src/config/movieOptions.js; a client test checks they match.

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

export const CERTIFICATES = ['U', 'UA', 'A'] // U-08: 'A' shows the 18+ warning
export const MOVIE_STATUSES = ['coming_soon', 'now_showing', 'inactive']
