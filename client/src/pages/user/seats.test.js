import { describe, expect, it } from 'vitest'
import { applySeatUpdate, classSections, clockWords, dropTaken, formatClock, secondsLeft, seatInfo, seatLabel, seatState, selectionSummary, sortSeatIds, takenMap, toggleSeat } from './seats.js'

// U-10 seat page helpers (UI-20, UI-21, NF-04, BR-02)
const seat = (seatId, seatClass, wheelchair = false) => ({ type: 'seat', seatId, seatClass, wheelchair })
// Top (back) to bottom (screen): balcony, walkway, first, first, second
const grid = [
  { label: 'E', cells: [seat('E1', 'balcony'), { type: 'aisle' }, seat('E2', 'balcony')] },
  { label: null, cells: [{ type: 'aisle' }, { type: 'aisle' }, { type: 'aisle' }] },
  { label: 'D', cells: [seat('D1', 'first'), { type: 'blocked' }, seat('D2', 'first')] },
  { label: 'C', cells: [seat('C1', 'first'), seat('C2', 'first'), seat('C10', 'first')] },
  { label: 'A', cells: [seat('A1', 'second', true), seat('A2', 'second'), seat('A3', 'second')] },
]
const prices = [
  { seatClass: 'balcony', pricePaise: 25000 },
  { seatClass: 'first', pricePaise: 18000 },
  { seatClass: 'second', pricePaise: 12000 },
]

describe('seat states (UI-21, NF-04)', () => {
  const taken = takenMap([
    { seatId: 'D1', status: 'booked' },
    { seatId: 'A2', status: 'held' },
  ])

  it('taken seats win over the selection', () => {
    expect(seatState('D1', taken, [])).toBe('booked')
    expect(seatState('A2', taken, ['A2'])).toBe('held')
    expect(seatState('A3', taken, ['A3'])).toBe('selected')
    expect(seatState('A1', taken, [])).toBe('available')
  })

  it('screen reader label', () => {
    expect(seatLabel(seat('F4', 'first'), 'First class', 'available')).toBe('Seat F4, First class, available')
    expect(seatLabel(seat('A1', 'second', true), 'Second class', 'held')).toBe('Seat A1, Second class, wheelchair space, held by someone')
  })

  it('picking: add / remove, taken seats cannot be picked, at most max (BR-02)', () => {
    expect(toggleSeat([], 'A1', taken, 2)).toEqual({ selected: ['A1'], error: null })
    expect(toggleSeat(['A1'], 'A1', taken, 2)).toEqual({ selected: [], error: null })
    expect(toggleSeat([], 'D1', taken, 2)).toEqual({ selected: [], error: null })
    expect(toggleSeat(['A1', 'A3'], 'C1', taken, 2)).toEqual({ selected: ['A1', 'A3'], error: 'You can pick up to 2 seats in one booking.' })
    expect(dropTaken(['A1', 'A2', 'D1'], taken)).toEqual(['A1'])
  })
})

describe('seat map layout (UI-20)', () => {
  it('rows grouped by class; a walkway stays with the section above', () => {
    const sections = classSections(grid)
    expect(sections.map((s) => [s.seatClass, s.rows.map((r) => r.label)])).toEqual([
      ['balcony', ['E', null]],
      ['first', ['D', 'C']],
      ['second', ['A']],
    ])
  })

  it('empty rows at the very top join the first class', () => {
    const sections = classSections([grid[1], grid[0]])
    expect(sections.map((s) => [s.seatClass, s.rows.length])).toEqual([['balcony', 2]])
  })
})

describe('bottom bar summary (UI-20)', () => {
  const info = seatInfo(grid, prices)

  it('natural seat order', () => {
    expect(sortSeatIds(['C10', 'C2', 'A3', 'C1'])).toEqual(['A3', 'C1', 'C2', 'C10'])
  })

  it('"2 seats: C2, C10" + tickets total', () => {
    expect(selectionSummary([], info)).toEqual({ text: 'No seats picked yet', totalText: '' })
    expect(selectionSummary(['E1'], info)).toEqual({ text: '1 seat: E1', totalText: 'Tickets ₹250' })
    expect(selectionSummary(['C10', 'A1', 'C2'], info)).toEqual({ text: '3 seats: A1, C2, C10', totalText: 'Tickets ₹480' })
  })
})

describe('hold timer (U-12)', () => {
  it('own held seats are not "taken" for me', () => {
    const taken = takenMap([{ seatId: 'A1', status: 'held' }, { seatId: 'A2', status: 'held' }], ['A1'])
    expect([...taken.keys()]).toEqual(['A2'])
  })

  it('counts down from the server answer, never below 0', () => {
    expect(secondsLeft(600, 1000, 1000)).toBe(600)
    expect(secondsLeft(600, 1000, 1000 + 55_500)).toBe(545)
    expect(secondsLeft(10, 0, 60_000)).toBe(0)
  })

  it('clock text', () => {
    expect(formatClock(545)).toBe('9:05')
    expect(formatClock(600)).toBe('10:00')
    expect(formatClock(0)).toBe('0:00')
    expect(clockWords(545)).toBe('9 minutes 5 seconds')
    expect(clockWords(60)).toBe('1 minute')
    expect(clockWords(1)).toBe('1 second')
    expect(clockWords(0)).toBe('0 seconds')
  })
})

describe('live seat updates (U-10, Socket.io seats:update)', () => {
  const taken = [
    { seatId: 'A1', status: 'held' },
    { seatId: 'B2', status: 'booked' },
  ]

  it('adds newly held seats and removes seats that became available', () => {
    const next = applySeatUpdate(taken, [
      { seatId: 'A1', status: 'available' },
      { seatId: 'C3', status: 'held' },
    ])
    expect(next).toEqual([
      { seatId: 'B2', status: 'booked' },
      { seatId: 'C3', status: 'held' },
    ])
    expect(taken).toHaveLength(2) // the old list is not changed
  })

  it('changes the status of a seat that is already taken, without doubles', () => {
    expect(applySeatUpdate(taken, [{ seatId: 'A1', status: 'booked' }])).toEqual([
      { seatId: 'B2', status: 'booked' },
      { seatId: 'A1', status: 'booked' },
    ])
  })

  it('a free seat sent as available stays free; empty input is fine', () => {
    expect(applySeatUpdate(taken, [{ seatId: 'Z9', status: 'available' }])).toEqual(taken)
    expect(applySeatUpdate(undefined, [{ seatId: 'A1', status: 'held' }])).toEqual([{ seatId: 'A1', status: 'held' }])
    expect(applySeatUpdate(taken, [])).toEqual(taken)
  })

  it('a picked seat that somebody holds live drops out of the pick', () => {
    const next = takenMap(applySeatUpdate(taken, [{ seatId: 'C3', status: 'held' }]))
    expect(dropTaken(['C3', 'C4'], next)).toEqual(['C4'])
  })
})
