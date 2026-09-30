import cookieParser from 'cookie-parser'
import express from 'express'
import { errorHandler, notFound } from './middleware/errors.js'
import { requestId } from './middleware/requestId.js'
import authRoutes from './routes/auth.js'
import meRoutes from './routes/me.js'

// Builds the Express app. It does not start listening here, so tests
// (Supertest) can import the app without opening a port.
const app = express()

app.use(requestId)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser()) // reads the refresh token cookie (U-02)

// Simple check that the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/me', meRoutes)

// Any other /api path: not found. Then all errors in one shape (api.md 1.5).
app.use('/api', notFound)
app.use(errorHandler)

export default app
