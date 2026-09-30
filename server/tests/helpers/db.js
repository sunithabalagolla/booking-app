import mongoose from 'mongoose'
import { inject } from 'vitest'
import { connectDB, disconnectDB } from '../../src/config/db.js'

// Connects to the in-memory test replica set started in globalSetup.js
export async function connectTestDB() {
  await connectDB(inject('mongoUri'))
}

// Empties every collection, so each test starts with a clean database
export async function clearTestDB() {
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
}

export async function closeTestDB() {
  await disconnectDB()
}
