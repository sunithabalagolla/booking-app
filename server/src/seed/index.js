// Seed script (15.5): fills the database with SAMPLE test data.
//
// Run from the project root:
//   npm run seed                 add sample data
//   npm run seed -- --reset      clear all collections first, then add sample data
//
// Safety: if MONGODB_URI is not on this laptop (e.g. Atlas in Phase 12),
// the script stops unless you add --yes:  npm run seed -- --yes

import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../config/db.js'
import { steps } from './steps/index.js'
import { isLocalUri } from './isLocalUri.js'

const args = process.argv.slice(2)
const reset = args.includes('--reset')
const confirmed = args.includes('--yes')

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and set it.')
  }

  if (!isLocalUri(uri) && !confirmed) {
    throw new Error(
      'MONGODB_URI is not on this laptop. If you really want to seed this database, run: npm run seed -- --yes',
    )
  }

  await connectDB(uri)

  if (reset) {
    // Drop every collection in the Talkies database (indexes are made again by the models)
    const collections = await mongoose.connection.db.listCollections().toArray()
    for (const { name } of collections) {
      await mongoose.connection.db.dropCollection(name)
    }
    console.log(`Reset: dropped ${collections.length} collection(s)`)
  }

  // Each step adds one area of sample data and returns lines for the summary
  const summary = []
  for (const step of steps) {
    console.log(`Seeding: ${step.name}`)
    const lines = (await step.run()) || []
    summary.push(...lines)
  }

  console.log('\nSeed done.')
  if (steps.length === 0) {
    console.log('No seed steps yet. They are added phase by phase (see server/src/seed/steps/index.js).')
  }
  for (const line of summary) console.log(`  ${line}`)
}

try {
  await run()
} catch (error) {
  console.error(`Seed failed: ${error.message}`)
  process.exitCode = 1
} finally {
  await disconnectDB()
}
