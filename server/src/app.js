import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import mongoose from 'mongoose'
import { generalLimiter } from './config/rateLimits.js'
import { corsOptions } from './config/security.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { requestId } from './middleware/requestId.js'
import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import bookingRoutes from './routes/bookings.js'
import cityRoutes from './routes/cities.js'
import meRoutes from './routes/me.js'
import movieRoutes from './routes/movies.js'
import ownerRoutes from './routes/owner.js'
import settingsRoutes from './routes/settings.js'
import showRoutes from './routes/shows.js'
import staffRoutes from './routes/staff.js'
import theatreRoutes from './routes/theatres.js'
import uploadRoutes from './routes/uploads.js'

// Builds the Express app. It does not start listening here, so tests
// (Supertest) can import the app without opening a port.
const app = express()

app.use(requestId)
app.use(helmet()) // SEC-08 security headers (also removes X-Powered-By)
app.use(cors(corsOptions)) // SEC-08 allow-list from CLIENT_URL
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser()) // reads the refresh token cookie (U-02)

// Check that the server is running and the database is connected.
// 503 when MongoDB is not connected, so a monitor can see the problem.
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1 // 1 = connected
  if (!connected) return res.status(503).json({ status: 'error', db: 'disconnected' })
  res.json({ status: 'ok', db: 'connected' })
})

// SEC-03 "everything else" limit. After /api/health, so a monitor is never locked out.
app.use('/api', generalLimiter)

app.use('/api/auth', authRoutes)
app.use('/api/me', meRoutes)
app.use('/api/settings', settingsRoutes) // A-05 public values
app.use('/api/cities', cityRoutes) // U-04 city picker
app.use('/api/movies', movieRoutes) // U-05 movie lists
app.use('/api/shows', showRoutes) // U-10 seat page
app.use('/api/theatres', theatreRoutes) // U-13 canteen menu
app.use('/api/bookings', bookingRoutes) // U-12 seat hold
// Role groups: each checks login + role once for all its paths (ROLE-01)
app.use('/api/owner', ownerRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/uploads', uploadRoutes) // SEC-11, NF-08

// Any other /api path: not found. Then all errors in one shape (api.md 1.5).
app.use('/api', notFound)
app.use(errorHandler)

export default app
