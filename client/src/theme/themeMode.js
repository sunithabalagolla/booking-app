// UI-02 theme rules: Auto (default), Day show, Night show.
// The small script in index.html uses the same rules before the page shows.
// If you change them here, change them there too.

export const THEME_CHOICES = ['auto', 'day', 'night']
export const THEME_STORAGE_KEY = 'talkies-theme'

// Auto: 6:00 AM–6:59 PM = Day show, 7:00 PM–5:59 AM = Night show (device local time)
export function getAutoTheme(date = new Date()) {
  const hour = date.getHours()
  return hour >= 6 && hour < 19 ? 'day' : 'night'
}

// Turns the choice ('auto' / 'day' / 'night') into the look to show ('day' / 'night')
export function resolveTheme(choice, date = new Date()) {
  return choice === 'auto' ? getAutoTheme(date) : choice
}

// Guests: the choice is kept in localStorage.
// Storage can be blocked (private mode), so never let it crash the app.
export function loadThemeChoice() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_CHOICES.includes(saved) ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveThemeChoice(choice) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Not saved; the theme still works for this visit
  }
}

// Puts the look on the page with a cross-fade (View Transitions API).
// Instant when reduce motion is on or the browser has no View Transitions.
export function applyTheme(theme) {
  const root = document.documentElement
  if (root.dataset.theme === theme) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || !document.startViewTransition) {
    root.dataset.theme = theme
    return
  }
  document.startViewTransition(() => {
    root.dataset.theme = theme
  })
}
