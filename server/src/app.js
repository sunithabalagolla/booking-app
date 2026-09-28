import express from 'express'

// Builds the Express app. It does not start listening here, so tests
// (Supertest) can import the app without opening a port.
const app = express()

app.use(express.json())

// Simple check that the server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Any other /api path: not found
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' })
})

export default app
