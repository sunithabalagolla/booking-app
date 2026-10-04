import { describe, expect, it } from 'vitest'
import { CITY_STORAGE_KEY, findCity, loadCityCode, saveCityCode } from './cityStore.js'

// U-04: the city is saved in this browser for the next visit
const fakeStorage = () => {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) }
}
const blocked = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('city storage (U-04)', () => {
  it('saves, loads and forgets the city', () => {
    const storage = fakeStorage()
    expect(loadCityCode(storage)).toBe(null)
    saveCityCode('hyderabad', storage)
    expect(storage.getItem(CITY_STORAGE_KEY)).toBe('hyderabad')
    expect(loadCityCode(storage)).toBe('hyderabad')
    saveCityCode(null, storage)
    expect(loadCityCode(storage)).toBe(null)
  })

  it('blocked storage (private mode) never crashes', () => {
    expect(loadCityCode(blocked)).toBe(null)
    expect(() => saveCityCode('hyderabad', blocked)).not.toThrow()
  })

  it('a saved city counts only while it is in the list (has an approved theatre)', () => {
    const cities = [
      { code: 'chennai', name: 'Chennai' },
      { code: 'hyderabad', name: 'Hyderabad' },
    ]
    expect(findCity('hyderabad', cities)).toEqual({ code: 'hyderabad', name: 'Hyderabad' })
    expect(findCity('mumbai', cities)).toBe(null)
    expect(findCity(null, cities)).toBe(null)
  })
})
