import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// U-12 seat hold, U-13 food (api.md Section 6). The client sends only IDs and counts (SEC-10).
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

// GET /api/bookings/:id (own): the hold with seats, food, pricing, remainingSeconds
export function useBooking(id) {
  return useQuery({ queryKey: ['booking', id], queryFn: async () => (await apiFetch(`/bookings/${id}`)).booking, enabled: Boolean(id), retry: false })
}

// U-13 PUT /api/bookings/:id/food { items: [{ foodItemId, qty }], pickup }: replaces the
// food list (empty = no food). The answer is the saved booking.
export function useSetFood(bookingId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiFetch(`/bookings/${bookingId}/food`, { method: 'PUT', body }),
    onSuccess: ({ booking }) => queryClient.setQueryData(['booking', bookingId], booking),
  })
}
