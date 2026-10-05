import { describe, expect, it } from 'vitest'
import { AGE_OK_KEY, hasAgeOk, needsAgeCheck, ratingText, saveAgeOk } from './movie.js'

// U-07 + U-08 helpers
const fakeStorage = () => {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }
}
const blocked = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('movie details (U-07)', () => {
  it('rating text', () => {
    expect(ratingText({ ratingAvg: 4.25, ratingCount: 18 })).toBe('★ 4.3 (18 ratings)')
    expect(ratingText({ ratingAvg: 5, ratingCount: 1 })).toBe('★ 5.0 (1 rating)')
    expect(ratingText({ ratingAvg: 0, ratingCount: 0 })).toBe('No ratings yet')
  })
})

describe('age warning (U-08)', () => {
  it('only "A" movies ask', () => {
    expect(['U', 'UA', 'A'].map((certificate) => needsAgeCheck({ certificate }))).toEqual([false, false, true])
  })

  it('a "yes" is remembered per movie for this visit', () => {
    const storage = fakeStorage()
    expect(hasAgeOk('m1', storage)).toBe(false)
    saveAgeOk('m1', storage)
    saveAgeOk('m1', storage) // only once
    expect(hasAgeOk('m1', storage)).toBe(true)
    expect(hasAgeOk('m2', storage)).toBe(false)
    expect(JSON.parse(storage.getItem(AGE_OK_KEY))).toEqual(['m1'])
  })

  it('blocked or broken storage never crashes: it simply asks again', () => {
    expect(hasAgeOk('m1', blocked)).toBe(false)
    expect(() => saveAgeOk('m1', blocked)).not.toThrow()
    const broken = fakeStorage()
    broken.setItem(AGE_OK_KEY, '{oops')
    expect(hasAgeOk('m1', broken)).toBe(false)
  })
})
