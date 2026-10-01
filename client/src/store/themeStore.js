import { create } from 'zustand'
import { getAutoTheme, loadThemeChoice, resolveTheme, saveThemeChoice } from '../theme/themeMode.js'

// UI-02 theme state, shared by the header switch and Profile.
// choice = what the user picked ('auto' / 'day' / 'night')
// theme  = what is shown now ('day' / 'night')
// Logged in: the profile rules are in theme/themeSync.js (UI-02).
const startChoice = loadThemeChoice()

export const useThemeStore = create((set) => ({
  choice: startChoice,
  theme: resolveTheme(startChoice),

  setChoice: (choice) => {
    saveThemeChoice(choice)
    set({ choice, theme: resolveTheme(choice) })
  },

  // Called every minute while the choice is Auto
  refreshAuto: () =>
    set((state) => (state.choice === 'auto' ? { theme: getAutoTheme() } : {})),
}))
