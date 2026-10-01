import { describe, expect, it } from 'vitest'
import * as server from '../../../server/src/config/movieOptions.js'
import * as client from './movieOptions.js'

// The client form and the server rules must use the same fixed lists (A-02, U-06)
describe('movie option lists', () => {
  it.each(['LANGUAGES', 'GENRES', 'CERTIFICATES', 'MOVIE_STATUSES'])('%s is the same on client and server', (name) => {
    expect(client[name]).toEqual(server[name])
  })

  it('has a label and a stamp colour for every status', () => {
    for (const status of client.MOVIE_STATUSES) {
      expect(client.STATUS_LABELS[status]).toBeTruthy()
      expect(client.STATUS_TONES[status]).toBeTruthy()
    }
  })
})
