import { create } from 'zustand'

// U-04: the city the user picked. Saved in this browser only (localStorage,
// decided 2026-10-04), so it is there on the next visit. Every user list
// (movies, shows…) asks for this city.

export const CITY_STORAGE_KEY = 'talkies-city'

// Storage can be blocked (private mode), so never let it crash the app.
// `storage` is a parameter only so tests can pass a fake one.
export function loadCityCode(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(CITY_STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function saveCityCode(code, storage = globalThis.localStorage) {
  try {
    if (code) storage?.setItem(CITY_STORAGE_KEY, code)
    else storage?.removeItem(CITY_STORAGE_KEY)
  } catch {
    // Not saved; the city still works for this visit
  }
}

// The saved city from the list, or null when none is saved or it is not in
// the list any more (no approved theatre there now)
export const findCity = (code, cities) => cities.find((c) => c.code === code) ?? null

export const useCityStore = create((set) => ({
  cityCode: loadCityCode(),
  setCity: (code) => {
    saveCityCode(code)
    set({ cityCode: code })
  },
}))
