import cookieParser from 'cookie-parser'
import express from 'express'
import mongoose from 'mongoose'
import { errorHandler, notFound } from './middleware/errors.js'
import { requestId } from './middleware/requestId.js'
import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import meRoutes from './routes/me.js'
import ownerRoutes from './routes/owner.js'
import staffRoutes from './routes/staff.js'

// Builds the Express app. It does not start listening here, so tests
// (Supertest) can import the app without opening a port.
const app = express()

app.use(requestId)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser()) // reads the refresh token cookie (U-02)

// Check that the server is running and the database is connected.
// 503 when MongoDB is not connected, so a monitor can see the problem.
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1 // 1 = connected
  if (!connected) return res.status(503).json({ status: 'error', db: 'disconnected' })
  res.json({ status: 'ok', db: 'connected' })
})

app.use('/api/auth', authRoutes)
app.use('/api/me', meRoutes)
// Role groups: each checks login + role once for all its paths (ROLE-01)
app.use('/api/owner', ownerRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/admin', adminRoutes)

// Any other /api path: not found. Then all errors in one shape (api.md 1.5).
app.use('/api', notFound)
app.use(errorHandler)

export default app
