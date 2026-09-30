import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// The test database is a replica set, so transactions work (base for T-02)
describe('test database transactions', () => {
  beforeAll(connectTestDB)
  afterEach(clearTestDB)
  afterAll(closeTestDB)

  const things = () => mongoose.connection.collection('things')

  it('saves everything when the transaction commits', async () => {
    const session = await mongoose.startSession()
    await session.withTransaction(async () => {
      await things().insertOne({ n: 1 }, { session })
      await things().insertOne({ n: 2 }, { session })
    })
    await session.endSession()

    expect(await things().countDocuments()).toBe(2)
  })

  it('saves nothing when the transaction is aborted', async () => {
    await things().insertOne({ n: 0 }) // make the collection first
    const session = await mongoose.startSession()
    await expect(
      session.withTransaction(async () => {
        await things().insertOne({ n: 1 }, { session })
        throw new Error('something failed half way')
      }),
    ).rejects.toThrow('something failed half way')
    await session.endSession()

    expect(await things().countDocuments()).toBe(1)
  })
})
