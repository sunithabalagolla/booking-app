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

// U-15 PUT /api/bookings/:id/coupon { code } / DELETE: the answer is the booking with the
// new pricing. 400 COUPON_INVALID has details.reason and a message for the user.
function useCouponMutation(bookingId, mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: ({ booking }) => {
      queryClient.setQueryData(['booking', bookingId], booking)
      queryClient.invalidateQueries({ queryKey: ['offers', bookingId] }) // "Applied" moves
    },
  })
}
export const useApplyCoupon = (bookingId) => useCouponMutation(bookingId, (code) => apiFetch(`/bookings/${bookingId}/coupon`, { method: 'PUT', body: { code } }))
export const useRemoveCoupon = (bookingId) => useCouponMutation(bookingId, () => apiFetch(`/bookings/${bookingId}/coupon`, { method: 'DELETE' }))

// U-15 GET /api/bookings/:id/offers: public coupons that work for this hold (empty on deal shows)
export function useOffers(bookingId, { enabled = true } = {}) {
  return useQuery({ queryKey: ['offers', bookingId], queryFn: async () => (await apiFetch(`/bookings/${bookingId}/offers`)).offers, enabled: Boolean(bookingId) && enabled, retry: false })
}

// U-17 PDF downloads (logged-in calls, so not a plain link): the file is saved by the browser.
// GET /api/bookings/:id/ticket.pdf · GET /api/invoices/:id/pdf
export async function downloadPdf(path, fileName) {
  const blob = await apiFetch(path, { blob: true })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
