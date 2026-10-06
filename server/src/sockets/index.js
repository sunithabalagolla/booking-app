import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { allowedOrigins } from '../config/security.js'

// Real-time (api.md Section 12): Socket.io on the same server and port as the API.
// U-10 live seat map: one room per show, `show:<id>`. The seat page joins it with
// `show:join` and gets `seats:update` after every hold, give up and time over (9.3).
// Seat rooms need no login (api.md); they only carry seat IDs and states.
// Dashboards (`dashboard:join`, O-02, A-01) come with their own tasks.

let io = null

export const showRoom = (showId) => `show:${showId}`

// Only real ObjectIds may become room names (no made-up rooms)
const validShowId = (data) => (typeof data?.showId === 'string' && mongoose.isValidObjectId(data.showId) ? data.showId : null)

export function attachSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins(), credentials: true }, // SEC-08, same allow-list as the API
    serveClient: false,
  })

  io.on('connection', (socket) => {
    // Optional answer (ack): { ok } once the room is joined / left
    const answer = (ack, ok) => typeof ack === 'function' && ack({ ok })
    socket.on('show:join', (data, ack) => {
      const showId = validShowId(data)
      if (showId) socket.join(showRoom(showId))
      answer(ack, Boolean(showId))
    })
    socket.on('show:leave', (data, ack) => {
      const showId = validShowId(data)
      if (showId) socket.leave(showRoom(showId))
      answer(ack, Boolean(showId))
    })
  })
  return io
}

export async function closeSockets() {
  await io?.close()
  io = null
}

// Push seat changes to everybody looking at this show.
// seats: [{ seatId, status }], status 'held' · 'booked' · 'available'.
// Does nothing when Socket.io is not running (most tests, the seed).
export function emitSeatsUpdate(showId, seats) {
  if (!io || seats.length === 0) return
  io.to(showRoom(String(showId))).emit('seats:update', { showId: String(showId), seats })
}
