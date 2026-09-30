import app from './app.js'
import { connectDB } from './config/db.js'

const PORT = process.env.PORT || 5000

// Connect to the database first, then start the server.
// If the database cannot be reached, stop with a clear message.
try {
  await connectDB(process.env.MONGODB_URI)
} catch (error) {
  console.error(`Could not connect to MongoDB: ${error.message}`)
  process.exit(1)
}

app.listen(PORT, () => {
  console.log(`Talkies server running on http://localhost:${PORT}`)
})
