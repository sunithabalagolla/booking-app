import { describe, expect, it } from 'vitest'
import * as server from '../../../server/src/config/gstStates.js'
import { GST_STATE_CODES, gstinMatchesState } from './gstStates.js'

describe('GST state codes (O-03)', () => {
  it('are the same on client and server', () => {
    expect(GST_STATE_CODES).toEqual(server.GST_STATE_CODES)
  })

  it('a GSTIN matches only its own state', () => {
    expect(gstinMatchesState('36AABCS1234A1Z5', 'Telangana')).toBe(true)
    expect(gstinMatchesState('33AABCS1234A1Z5', 'Telangana')).toBe(false)
    expect(gstinMatchesState('36AABCS1234A1Z5', 'Atlantis')).toBe(false)
  })
})
