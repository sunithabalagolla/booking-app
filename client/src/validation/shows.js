import { z } from 'zod'

// O-05 show form + time helpers. Same rules as the server (server/src/controllers/ownerShows.js);
// the server checks again (and does the overlap check, T-08).
// All days and times here are IST: 'YYYY-MM-DD' and 'HH:mm' (BR-21).

export const MAX_DATES = 14
export const MAX_DAYS_AHEAD = 30
const SEAT_CLASSES = ['balcony', 'first', 'second']
export const CLASS_NAMES = { balcony: 'Balcony', first: 'First class', second: 'Second class' }

// BR-22 label names
export const SHOW_LABEL_NAMES = { morning: 'Morning show', matinee: 'Matinee', first: 'First show', second: 'Second show' }

// BR-22 from an IST start time 'HH:mm'
export function labelForTime(time) {
  const hour = Number(time.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 16) return 'matinee'
  if (hour < 20) return 'first'
  return 'second'
}

// '14:30' → '2:30 PM'
export function formatTime12(time) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// '22:00' + 165 min → { time: '00:45', nextDay: true } (BR-10 end time)
export function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const inDay = total % (24 * 60)
  return { time: `${String(Math.floor(inDay / 60)).padStart(2, '0')}:${String(inDay % 60).padStart(2, '0')}`, nextDay: total >= 24 * 60 }
}

// Today in IST (+ addDays) as 'YYYY-MM-DD'
export function istToday(addDays = 0, now = new Date()) {
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000 + addDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 'YYYY-MM-DD' → 'Mon 5 Oct' (the day is already IST, so no time zone maths)
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function formatShortDay(day) {
  const date = new Date(`${day}T00:00:00Z`)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

// The days an owner can pick: today … +30
export function dayChoices(now = new Date()) {
  return Array.from({ length: MAX_DAYS_AHEAD + 1 }, (_, i) => istToday(i, now))
}

// Seat classes the screen has (they each need a price)
export const neededClasses = (screen) => SEAT_CLASSES.filter((c) => screen.seatCount[c] > 0)

// "Matinee · 2:30 PM – ends 4:45 PM (120 min + 15 min cleaning)"
export function showPreview(startTime, movie, screen) {
  const end = addMinutes(startTime, movie.durationMinutes + screen.cleaningBreakMinutes)
  return `${SHOW_LABEL_NAMES[labelForTime(startTime)]} · ${formatTime12(startTime)} – ends ${formatTime12(end.time)}${end.nextDay ? ' (next day)' : ''} (${movie.durationMinutes} min + ${screen.cleaningBreakMinutes} min cleaning)`
}

export const EMPTY_SHOW_FORM = { theatreId: '', screenId: '', movieId: '', language: '', format: '2D', subtitles: false, parentBaby: false, startTime: '', dates: [], date: '', prices: { balcony: '', first: '', second: '' } }

// A show from the API → form values (edit)
export function showToForm(show, theatreId) {
  const prices = { balcony: '', first: '', second: '' }
  for (const p of show.prices) prices[p.seatClass] = String(p.pricePaise / 100)
  return {
    ...EMPTY_SHOW_FORM,
    theatreId,
    screenId: show.screen.id,
    movieId: show.movie.id,
    language: show.language,
    format: show.format,
    subtitles: show.subtitles,
    parentBaby: show.tags.includes('parent_baby'),
    startTime: show.startTime,
    date: show.date,
    prices,
  }
}

const rupees = /^\d+$/

// `movie` and `screen` = the picked ones (or undefined); `edit` = one date instead of several
export function showFormSchema({ movie, screen, edit = false, now = new Date() }) {
  const today = istToday(0, now)
  const lastDay = istToday(MAX_DAYS_AHEAD, now)
  return z
    .object({
      theatreId: z.string().min(1, { error: 'Please pick a theatre.' }),
      screenId: z.string().min(1, { error: 'Please pick a screen.' }),
      movieId: z.string().min(1, { error: 'Please pick a movie.' }),
      language: z.string().min(1, { error: 'Please pick a language.' }),
      format: z.enum(['2D', '3D']),
      subtitles: z.boolean(),
      parentBaby: z.boolean(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Please enter the start time.' }),
      dates: edit ? z.array(z.string()) : z.array(z.string()).min(1, { error: 'Please pick at least one date.' }).max(MAX_DATES, { error: `At most ${MAX_DATES} dates at once.` }),
      date: edit ? z.string().min(1, { error: 'Please pick a date.' }) : z.string(),
      prices: z.object({ balcony: z.string(), first: z.string(), second: z.string() }),
    })
    .superRefine((form, ctx) => {
      const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message })
      if (movie && form.language && !movie.languages.includes(form.language)) issue('language', `Please pick one of: ${movie.languages.join(', ')}.`)
      if (screen && form.format === '3D' && screen.format !== '3D') issue('format', 'A 3D show needs a 3D screen.')
      if (movie && form.parentBaby && movie.certificate === 'A') issue('parentBaby', 'Parent-and-baby shows are not allowed for "A" movies.')
      if (screen) {
        const bad = neededClasses(screen).filter((c) => {
          const text = form.prices[c].trim()
          return !rupees.test(text) || Number(text) < 1 || Number(text) > 5000
        })
        if (bad.length) issue('prices', `Please enter whole rupees from ₹1 to ₹5,000 for: ${bad.map((c) => CLASS_NAMES[c]).join(', ')}.`)
      }
      for (const day of edit ? [form.date].filter(Boolean) : form.dates) {
        if (day < today || day > lastDay) issue(edit ? 'date' : 'dates', `Please pick dates from today up to ${MAX_DAYS_AHEAD} days ahead.`)
        else if (movie && day < movie.releaseDate) issue(edit ? 'date' : 'dates', `${movie.title} is released on ${movie.releaseDate}. Please pick that day or later.`)
      }
    })
}

// Checked form values → API body (prices in paise, only the classes the screen has)
export function formToBody(form, screen, { edit = false } = {}) {
  return {
    movieId: form.movieId,
    screenId: form.screenId,
    ...(edit ? { date: form.date } : { dates: [...form.dates].sort() }),
    startTime: form.startTime,
    language: form.language,
    format: form.format,
    subtitles: form.subtitles,
    tags: form.parentBaby ? ['parent_baby'] : [],
    prices: neededClasses(screen).map((c) => ({ seatClass: c, pricePaise: Number(form.prices[c].trim()) * 100 })),
  }
}

// Server error details → form field names
export function showErrors(details = {}, { edit = false } = {}) {
  const map = { tags: 'parentBaby', ...(edit && { dates: 'date' }) }
  const errors = {}
  for (const [key, message] of Object.entries(details)) {
    const field = key.split('.')[0]
    errors[map[field] ?? field] ??= message
  }
  return errors
}
