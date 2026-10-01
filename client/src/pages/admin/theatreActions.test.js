import { describe, expect, it } from 'vitest'
import { theatreActions } from './theatreActions.js'

const theatre = (status, ownerStatus = 'active') => ({ status, owner: { status: ownerStatus } })

describe('theatreActions (A-04 buttons)', () => {
  it('pending: approve or reject', () => {
    expect(theatreActions(theatre('pending'))).toEqual(['approve', 'reject'])
  })

  it('rejected: approve only; approved: nothing', () => {
    expect(theatreActions(theatre('rejected'))).toEqual(['approve'])
    expect(theatreActions(theatre('approved'))).toEqual([])
  })

  it('owner blocked: no buttons at all', () => {
    expect(theatreActions(theatre('pending', 'blocked'))).toEqual([])
    expect(theatreActions(theatre('rejected', 'blocked'))).toEqual([])
  })
})
