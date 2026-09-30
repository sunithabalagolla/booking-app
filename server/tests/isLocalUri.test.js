import { describe, expect, it } from 'vitest'
import { isLocalUri } from '../src/seed/isLocalUri.js'

// Seed safety: only a database on this laptop may be seeded without --yes
describe('isLocalUri', () => {
  it.each([
    'mongodb://127.0.0.1:27017/talkies?replicaSet=rs0',
    'mongodb://localhost:27017/talkies',
    'mongodb://localhost/talkies',
  ])('local: %s', (uri) => {
    expect(isLocalUri(uri)).toBe(true)
  })

  it.each([
    'mongodb+srv://user:pass@cluster0.example.mongodb.net/talkies',
    'mongodb://10.0.0.5:27017/talkies',
    'mongodb://127.0.0.1:27017,db.example.com:27017/talkies',
    'not a link',
    '',
  ])('not local: %s', (uri) => {
    expect(isLocalUri(uri)).toBe(false)
  })
})
