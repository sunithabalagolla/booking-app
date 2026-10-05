// U-07 movie details + U-08 age warning helpers. Plain functions, so they are easy to test.

// U-08: only "A" movies ask "This movie is for adults 18+" before going on to book
export const needsAgeCheck = (movie) => movie.certificate === 'A'

// "★ 4.2 (18 ratings)" · "★ 5.0 (1 rating)" · "No ratings yet"
export function ratingText({ ratingAvg, ratingCount }) {
  if (!ratingCount) return 'No ratings yet'
  return `★ ${ratingAvg.toFixed(1)} (${ratingCount} rating${ratingCount === 1 ? '' : 's'})`
}

// Certificate stamp colours (Stamp tones): U green, UA mustard, A maroon
export const CERTIFICATE_TONES = { U: 'green', UA: 'mustard', A: 'maroon' }

// U-08: a "yes" is remembered for this browser visit (sessionStorage), per movie
// (decided 2026-10-04). Storage can be blocked; then it simply asks again.
export const AGE_OK_KEY = 'talkies-age-ok'

export function hasAgeOk(movieId, storage = globalThis.sessionStorage) {
  try {
    return JSON.parse(storage?.getItem(AGE_OK_KEY) ?? '[]').includes(movieId)
  } catch {
    return false
  }
}

export function saveAgeOk(movieId, storage = globalThis.sessionStorage) {
  try {
    const ids = JSON.parse(storage?.getItem(AGE_OK_KEY) ?? '[]')
    if (!ids.includes(movieId)) storage?.setItem(AGE_OK_KEY, JSON.stringify([...ids, movieId]))
  } catch {
    // Not saved: the question comes again next time, which is safe
  }
}
