import mongoose from 'mongoose'

// Connects to MongoDB. The link comes from MONGODB_URI in .env:
// Docker on the laptop now, MongoDB Atlas later (Phase 12). Same code for both.
export async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Copy .env.example to .env and set it.')
  }

  // Give up after 5 seconds instead of waiting a long time when MongoDB is not running
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })

  // Log only host and database name, never the full link (an Atlas link has a password)
  const { host, name } = mongoose.connection
  console.log(`MongoDB connected: ${host}/${name}`)
}

// Used by tests and when the server stops
export async function disconnectDB() {
  await mongoose.disconnect()
}
