import { describe, expect, it } from 'vitest'
import { getAutoTheme, loadThemeChoice, resolveTheme } from './themeMode.js'

// A date today at the given local time
const at = (hours, minutes) => {
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d
}

describe('getAutoTheme (UI-02)', () => {
  it.each([
    { label: '5:59 AM', h: 5, m: 59, expected: 'night' },
    { label: '6:00 AM', h: 6, m: 0, expected: 'day' },
    { label: '6:59 PM', h: 18, m: 59, expected: 'day' },
    { label: '7:00 PM', h: 19, m: 0, expected: 'night' },
    { label: 'midnight', h: 0, m: 0, expected: 'night' },
    { label: 'noon', h: 12, m: 0, expected: 'day' },
  ])('$label → $expected', ({ h, m, expected }) => {
    expect(getAutoTheme(at(h, m))).toBe(expected)
  })
})

describe('resolveTheme', () => {
  it('auto follows the time', () => {
    expect(resolveTheme('auto', at(10, 0))).toBe('day')
    expect(resolveTheme('auto', at(22, 0))).toBe('night')
  })

  it('a fixed choice wins over the time', () => {
    expect(resolveTheme('day', at(22, 0))).toBe('day')
    expect(resolveTheme('night', at(10, 0))).toBe('night')
  })
})

describe('loadThemeChoice', () => {
  it('falls back to auto when storage is not available', () => {
    // Tests run in Node, where localStorage does not exist (like blocked storage)
    expect(loadThemeChoice()).toBe('auto')
  })
})
