import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import {
  cellLabel,
  emptyScreenForm,
  formToBody,
  layoutPreview,
  newGrid,
  paintAt,
  paintCell,
  paintColumn,
  paintRow,
  resizeGrid,
  screenFormSchema,
  screenToForm,
} from './screens.js'

// O-04 seat layout editor helpers
const S = (seatClass = 'second', wheelchair = false) => ({ type: 'seat', seatClass, wheelchair })
const A = { type: 'aisle' }
const X = { type: 'blocked' }

describe('layoutPreview (same rules as the server)', () => {
  it('A = the row nearest the screen; rows without seats get no letter; numbers skip gaps', () => {
    const { labels, seatIds } = layoutPreview([
      [S('balcony'), A, S('balcony')],
      [A, A, A],
      [S(), X, S()],
    ])
    expect(labels).toEqual(['B', null, 'A'])
    expect(seatIds[0]).toEqual(['B1', null, 'B2'])
    expect(seatIds[2]).toEqual(['A1', null, 'A2'])
  })

  it('live seat summary per class + wheelchair-friendly', () => {
    const preview = layoutPreview([
      [S('balcony'), S('first')],
      [S('second', true), A],
    ])
    expect(preview).toMatchObject({ seatCount: { balcony: 1, first: 1, second: 1 }, totalSeats: 3, wheelchairSpaces: 1, wheelchairFriendly: true })
  })
})

describe('painting', () => {
  it('a class brush keeps the wheelchair mark; aisle / blocked drop the seat', () => {
    expect(paintCell(S('second', true), 'balcony')).toEqual(S('balcony', true))
    expect(paintCell(A, 'first')).toEqual(S('first'))
    expect(paintCell(S(), 'aisle')).toEqual(A)
    expect(paintCell(S(), 'blocked')).toEqual(X)
  })

  it('wheelchair brush: one place switches on / off; a gap becomes a Second class wheelchair space', () => {
    expect(paintCell(S('first'), 'wheelchair')).toEqual(S('first', true))
    expect(paintCell(S('first', true), 'wheelchair')).toEqual(S('first'))
    expect(paintCell(A, 'wheelchair')).toEqual(S('second', true))
  })

  it('row and column buttons paint every place; wheelchair only switches on there', () => {
    const grid = [
      [S(), S('second', true)],
      [S(), S()],
    ]
    expect(paintRow(grid, 0, 'wheelchair')[0]).toEqual([S('second', true), S('second', true)])
    expect(paintColumn(grid, 1, 'aisle').map((row) => row[1])).toEqual([A, A])
    const one = paintAt(grid, 1, 0, 'balcony')
    expect(one[1][0]).toEqual(S('balcony'))
    expect(one[0]).toBe(grid[0]) // other rows unchanged
  })
})

describe('grid size', () => {
  it('newGrid is all Second class seats', () => {
    const grid = newGrid(2, 3)
    expect(grid).toHaveLength(2)
    expect(grid.flat().every((c) => c.type === 'seat' && c.seatClass === 'second')).toBe(true)
  })

  it('resizeGrid keeps what fits; new places are Second class seats', () => {
    const grid = [[S('balcony'), A]]
    const bigger = resizeGrid(grid, 2, 3)
    expect(bigger[0]).toEqual([S('balcony'), A, S()])
    expect(bigger[1]).toEqual([S(), S(), S()])
    expect(resizeGrid(bigger, 1, 1)).toEqual([[S('balcony')]])
  })
})

describe('screen form', () => {
  it('a new form is valid once it has a name; empty cleaning break = platform default (not sent)', () => {
    const form = { ...emptyScreenForm(), name: ' Screen 1 ' }
    const body = formToBody(screenFormSchema.parse(form))
    expect(body).toMatchObject({ name: 'Screen 1', format: '2D', layout: { rows: 8, cols: 12 } })
    expect('cleaningBreakMinutes' in body).toBe(false)
    expect(body.layout.grid[0].cells[0]).toEqual(S())
  })

  it('gives a message for each broken field', () => {
    const form = { name: '', format: 'IMAX', cleaningBreakMinutes: '121', grid: [[A, X]] }
    expect(Object.keys(fieldErrors(screenFormSchema.safeParse(form).error)).sort()).toEqual(['cleaningBreakMinutes', 'format', 'grid', 'name'])
    expect(fieldErrors(screenFormSchema.safeParse({ ...form, cleaningBreakMinutes: '1.5' }).error).cleaningBreakMinutes).toMatch(/whole minutes/)
  })

  it('a screen from the API → form → body (seat IDs and labels are not sent)', () => {
    const screen = {
      name: 'Screen 2',
      format: '3D',
      cleaningBreakMinutes: 20,
      layout: { rows: 1, cols: 2, grid: [{ label: 'A', cells: [{ type: 'seat', seatId: 'A1', seatClass: 'first', wheelchair: true }, A] }] },
    }
    const body = formToBody(screenFormSchema.parse(screenToForm(screen)))
    expect(body).toEqual({ name: 'Screen 2', format: '3D', cleaningBreakMinutes: 20, layout: { rows: 1, cols: 2, grid: [{ cells: [S('first', true), A] }] } })
  })

  it('screen reader labels', () => {
    expect(cellLabel(S('balcony', true), 'B3', 0, 2)).toBe('Seat B3, Balcony, wheelchair space')
    expect(cellLabel(A, null, 1, 4)).toBe('Row 2 place 5, aisle')
  })
})
