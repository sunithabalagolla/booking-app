import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { applySeatUpdate } from '../pages/user/seats.js'

// Socket.io (api.md Section 12): one connection for the whole app, to the same address
// as the page (Vite sends /socket.io to the Express server in development).
// It connects only when a page needs it (the seat page) and reconnects by itself.
let socket = null
function getSocket() {
  socket ??= io({ autoConnect: false })
  return socket
}

// U-10 live seat map: join the room of this show and change the seat list
// (['show-seats', id], from useShowSeats) at once when somebody holds or frees a seat.
// After every (re)connect the room is joined again and the seat list is loaded fresh,
// so changes missed while offline are not lost.
export function useLiveSeats(showId, { enabled = true } = {}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!showId || !enabled) return
    const s = getSocket()
    const queryKey = ['show-seats', showId]

    const join = () => s.emit('show:join', { showId }, () => queryClient.invalidateQueries({ queryKey }))
    const onUpdate = (data) => {
      if (data?.showId !== showId) return
      queryClient.setQueryData(queryKey, (old) => old && { ...old, taken: applySeatUpdate(old.taken, data.seats) })
    }

    s.on('seats:update', onUpdate)
    s.on('connect', join)
    if (s.connected) join()
    else s.connect()

    return () => {
      s.off('seats:update', onUpdate)
      s.off('connect', join)
      if (s.connected) s.emit('show:leave', { showId })
    }
  }, [showId, enabled, queryClient])
}
