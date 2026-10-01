import { savePrefs } from '../api/me.js'
import { useAuthStore } from '../store/authStore.js'
import { useThemeStore } from '../store/themeStore.js'

// UI-02: the theme choice in the user profile (decided 2026-10-01).
// - Guests: localStorage only.
// - At login: profile theme empty (null = never chosen) → keep the device choice
//   and save it to the profile. Profile has a choice → the profile wins.
// - Logged in and changing the theme → save to the profile too. If saving fails,
//   the new look stays and nothing shows on screen.

// Pure rule, easy to test
export function themeOnLogin(profileTheme, deviceChoice) {
  if (profileTheme) return { choice: profileTheme, saveToProfile: false }
  return { choice: deviceChoice, saveToProfile: true }
}

function saveQuietly(choice) {
  savePrefs({ theme: choice }).catch((error) => {
    console.warn('Theme not saved to the profile:', error.message)
  })
}

// Called when someone logs in (also after a page reload restores the login)
export function syncThemeAtLogin() {
  const user = useAuthStore.getState().user
  if (!user) return
  const { choice, saveToProfile } = themeOnLogin(user.prefs?.theme, useThemeStore.getState().choice)
  if (saveToProfile) saveQuietly(choice)
  else useThemeStore.getState().setChoice(choice) // also saved in localStorage, so the next page load starts right
}

// The theme switch (header, sidebar, staff bar, later Profile) uses this
export function chooseTheme(choice) {
  useThemeStore.getState().setChoice(choice)
  if (useAuthStore.getState().status === 'user') saveQuietly(choice)
}
