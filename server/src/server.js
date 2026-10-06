import http from 'node:http'
import app from './app.js'
import { startJobs } from './jobs/index.js'
import { attachSockets } from './sockets/index.js'
import { getAccessSecret } from './config/auth.js'
import { getPaymentSecret } from './services/payment/index.js'
import { connectDB } from './config/db.js'
import { assertUploadConfig } from './services/upload/index.js'

const PORT = process.env.PORT || 5000

// Stop at once if the login token secret or the payment signing key is missing or
// too short (SEC-07, PAY-01)
// Production also needs the Cloudinary keys (no local upload folder there)
try {
  getAccessSecret()
  getPaymentSecret() // PAY-01 mock gateway signing key
  assertUploadConfig()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

// Connect to the database first, then start the server.
// If the database cannot be reached, stop with a clear message.
try {
  await connectDB(process.env.MONGODB_URI)
} catch (error) {
  console.error(`Could not connect to MongoDB: ${error.message}`)
  process.exit(1)
}

// One HTTP server for the API and Socket.io (same port, api.md Section 12)
const httpServer = http.createServer(app)
attachSockets(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Talkies server running on http://localhost:${PORT}`)
  startJobs() // JOB-01 … (node-cron)
})
