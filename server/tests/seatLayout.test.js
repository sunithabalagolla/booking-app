import { describe, expect, it } from 'vitest'
import { buildLayout } from '../src/utils/seatLayout.js'

// O-04 row letters, seat IDs and counts
const S = (seatClass = 'second', wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })
const A = { type: 'aisle' }
const X = { type: 'blocked' }
const row = (...cells) => ({ cells })

describe('buildLayout (O-04)', () => {
  it('A = the row nearest the screen (last row); numbers skip aisles and blocked places', () => {
    const { layout } = buildLayout([row(S('balcony'), A, S('balcony'), S('balcony')), row(S('first'), X, S('first'), S('first'))])
    expect(layout.grid.map((r) => r.label)).toEqual(['B', 'A'])
    expect(layout.grid[0].cells.map((c) => c.seatId ?? c.type)).toEqual(['B1', 'aisle', 'B2', 'B3'])
    expect(layout.grid[1].cells.map((c) => c.seatId ?? c.type)).toEqual(['A1', 'blocked', 'A2', 'A3'])
    expect(layout).toMatchObject({ rows: 2, cols: 4 })
  })

  it('rows without seats get no letter and are skipped by the letters', () => {
    const { layout } = buildLayout([row(S(), S()), row(A, A), row(X, X), row(S(), S())])
    expect(layout.grid.map((r) => r.label)).toEqual(['B', null, null, 'A'])
    expect(layout.grid[0].cells[1].seatId).toBe('B2')
  })

  it('counts seats per class; wheelchair-friendly only with a wheelchair space', () => {
    const plain = buildLayout([row(S('balcony'), S('first')), row(S('second'), S('second'))])
    expect(plain.seatCount).toEqual({ balcony: 1, first: 1, second: 2 })
    expect(plain.totalSeats).toBe(4)
    expect(plain.wheelchairFriendly).toBe(false)

    const wheel = buildLayout([row(S('second', true), A)])
    expect(wheel.wheelchairFriendly).toBe(true)
    expect(wheel.layout.grid[0].cells[0]).toEqual({ type: 'seat', seatId: 'A1', seatClass: 'second', wheelchair: true })
  })

  it('26 rows go from A to Z; seat IDs are unique', () => {
    const grid = Array.from({ length: 26 }, () => row(...Array.from({ length: 40 }, () => S())))
    const { layout, totalSeats } = buildLayout(grid)
    expect(layout.grid[0].label).toBe('Z')
    expect(layout.grid[25].label).toBe('A')
    const ids = layout.grid.flatMap((r) => r.cells.map((c) => c.seatId))
    expect(new Set(ids).size).toBe(totalSeats)
    expect(totalSeats).toBe(1040)
  })

  it('ignores labels and seat IDs sent in the input', () => {
    const { layout } = buildLayout([{ label: 'Q', cells: [{ ...S(), seatId: 'Q9' }] }])
    expect(layout.grid[0]).toEqual({ label: 'A', cells: [{ type: 'seat', seatId: 'A1', seatClass: 'second', wheelchair: false }] })
  })
})
