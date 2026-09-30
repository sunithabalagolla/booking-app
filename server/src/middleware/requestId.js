import { randomUUID } from 'node:crypto'

// Gives every request an ID (NF-10). It is sent back in the X-Request-Id header
// and in error answers, and the server logs errors with it.
export function requestId(req, res, next) {
  req.id = randomUUID().slice(0, 8)
  res.set('X-Request-Id', req.id)
  next()
}
