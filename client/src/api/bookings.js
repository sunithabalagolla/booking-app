import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// U-12 seat hold (api.md Section 6). The client sends only the show and seat IDs (SEC-10).
// After each change the seat list is loaded again (it also brings `myHold`).

function useSeatMutation(showId, mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['show-seats', showId] }),
  })
}

// POST /api/bookings/hold → { booking } (pending). 409 SEAT_TAKEN when someone was faster.
export const useHoldSeats = (showId) => useSeatMutation(showId, (seatIds) => apiFetch('/bookings/hold', { method: 'POST', body: { showId, seatIds } }))

// DELETE /api/bookings/:id/hold: "Give up seats", also used when the time is over
export const useGiveUpHold = (showId) => useSeatMutation(showId, (bookingId) => apiFetch(`/bookings/${bookingId}/hold`, { method: 'DELETE' }))
