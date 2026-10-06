import { describe, expect, it } from 'vitest'
import * as server from '../../../server/src/config/payment.js'
import { BANKS, TEST_VALUES } from './payment.js'

// The client copy of the mock payment lists must match the server (PAY-02, PAY-03)
describe('mock payment lists', () => {
  it('match the server', () => {
    expect(BANKS).toEqual(server.BANKS)
    expect(TEST_VALUES).toEqual(server.TEST_VALUES)
  })
})
