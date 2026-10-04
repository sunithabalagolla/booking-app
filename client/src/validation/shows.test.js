import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import {
  addMinutes,
  dayChoices,
  EMPTY_SHOW_FORM,
  formatShortDay,
  formatTime12,
  formToBody,
  istToday,
  labelForTime,
  showErrors,
  showFormSchema,
  showPreview,
  showToForm,
} from './shows.js'

// O-05 show form + time helpers (IST)
const NOW = new Date('2026-10-04T12:00:00Z') // 5:30 PM IST, 4 Oct 2026
const movie = { id: 'm1', title: 'Sapnon Ka Safar', languages: ['Hindi', 'English'], durationMinutes: 120, certificate: 'UA', releaseDate: '2026-09-24' }
const aMovie = { ...movie, id: 'm2', certificate: 'A' }
const screen = { id: 's1', format: '2D', cleaningBreakMinutes: 15, seatCount: { balcony: 4, first: 0, second: 10 } }
const good = { ...EMPTY_SHOW_FORM, theatreId: 't1', screenId: 's1', movieId: 'm1', language: 'Hindi', startTime: '14:30', dates: ['2026-10-06', '2026-10-05'], prices: { balcony: '250', first: '', second: '120' } }

describe('time helpers', () => {
  it('labels change at 12:00, 4:00 PM and 8:00 PM (BR-22)', () => {
    expect(['11:59', '12:00', '15:59', '16:00', '19:59', '20:00'].map(labelForTime)).toEqual(['morning', 'matinee', 'matinee', 'first', 'first', 'second'])
  })

  it('12-hour times, end time past midnight, IST days', () => {
    expect(formatTime12('00:05')).toBe('12:05 AM')
    expect(formatTime12('12:00')).toBe('12:00 PM')
    expect(formatTime12('21:45')).toBe('9:45 PM')
    expect(addMinutes('22:00', 165)).toEqual({ time: '00:45', nextDay: true })
    expect(istToday(0, new Date('2026-10-04T19:00:00Z'))).toBe('2026-10-05') // 00:30 IST next day
    expect(formatShortDay('2026-10-05')).toBe('Mon 5 Oct')
    expect(dayChoices(NOW)).toHaveLength(31)
  })

  it('preview: label, start, end incl. cleaning break', () => {
    expect(showPreview('14:30', movie, screen)).toBe('Matinee · 2:30 PM – ends 4:45 PM (120 min + 15 min cleaning)')
    expect(showPreview('22:30', movie, screen)).toMatch(/ends 12:45 AM \(next day\)/)
  })
})

describe('showFormSchema (O-05)', () => {
  const schema = (opts = {}) => showFormSchema({ movie, screen, now: NOW, ...opts })

  it('a good form → body with sorted dates, tags and prices in paise for the screen classes', () => {
    const body = formToBody(schema().parse(good), screen)
    expect(body).toEqual({
      movieId: 'm1',
      screenId: 's1',
      dates: ['2026-10-05', '2026-10-06'],
      startTime: '14:30',
      language: 'Hindi',
      format: '2D',
      subtitles: false,
      tags: [],
      prices: [
        { seatClass: 'balcony', pricePaise: 25000 },
        { seatClass: 'second', pricePaise: 12000 },
      ],
    })
  })

  it('gives a message for each empty field', () => {
    const errors = fieldErrors(showFormSchema({ now: NOW }).safeParse(EMPTY_SHOW_FORM).error)
    expect(Object.keys(errors).sort()).toEqual(['dates', 'language', 'movieId', 'screenId', 'startTime', 'theatreId'])
  })

  it('checks language, 3D screen, parent-and-baby on "A", prices and dates', () => {
    const errors = (form, opts) => fieldErrors(schema(opts).safeParse({ ...good, ...form }).error)
    expect(errors({ language: 'Tamil' }).language).toMatch(/Hindi, English/)
    expect(errors({ format: '3D' }).format).toMatch(/3D screen/)
    expect(errors({ parentBaby: true }, { movie: aMovie }).parentBaby).toMatch(/"A"/)
    expect(schema().safeParse({ ...good, parentBaby: true }).success).toBe(true)
    expect(errors({ prices: { balcony: '249.50', first: '', second: '' } }).prices).toMatch(/Balcony, Second class/)
    expect(errors({ dates: ['2026-10-03'] }).dates).toMatch(/from today/)
    expect(errors({ dates: ['2026-11-04'] }).dates).toMatch(/30 days/)
    expect(errors({ dates: ['2026-10-05'] }, { movie: { ...movie, releaseDate: '2026-10-08' } }).dates).toMatch(/released on 2026-10-08/)
    expect(errors({ dates: Array.from({ length: 15 }, (_, i) => istToday(i, NOW)) }).dates).toMatch(/At most 14/)
  })

  it('edit: one date; a show from the API → form → body', () => {
    const show = {
      movie: { id: 'm1' },
      screen: { id: 's1' },
      date: '2026-10-07',
      startTime: '20:30',
      language: 'English',
      format: '2D',
      subtitles: true,
      tags: ['parent_baby'],
      prices: [
        { seatClass: 'balcony', pricePaise: 25000 },
        { seatClass: 'second', pricePaise: 12000 },
      ],
    }
    const form = showToForm(show, 't1')
    expect(form.prices).toEqual({ balcony: '250', first: '', second: '120' })
    const body = formToBody(schema({ edit: true }).parse(form), screen, { edit: true })
    expect(body).toMatchObject({ date: '2026-10-07', startTime: '20:30', subtitles: true, tags: ['parent_baby'] })
    expect('dates' in body).toBe(false)
  })

  it('server errors → form fields', () => {
    expect(showErrors({ tags: 'x', 'prices.0.pricePaise': 'y', dates: 'z' })).toEqual({ parentBaby: 'x', prices: 'y', dates: 'z' })
    expect(showErrors({ dates: 'z' }, { edit: true })).toEqual({ date: 'z' })
  })
})
