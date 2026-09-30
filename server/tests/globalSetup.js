import { MongoMemoryReplSet } from 'mongodb-memory-server'

// Same MongoDB version as the Docker database (talkies-mongo)
export const MONGODB_TEST_VERSION = '8.3.11'

let replSet

// Runs once before all tests: an in-memory single-node replica set,
// so transactions work in tests too (database.md Section 2).
// The Docker database is never used by tests.
export async function setup({ provide }) {
  replSet = await MongoMemoryReplSet.create({
    binary: { version: MONGODB_TEST_VERSION },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })
  provide('mongoUri', replSet.getUri('talkies-test'))
}

export async function teardown() {
  await replSet?.stop()
}
