import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from '../theme/motion.js'
import { atLeast, gatewayBody } from '../pages/user/payment.js'
import { apiFetch } from './client.js'

// U-16 mock payment (flow 9.4, api.md Section 6). One click runs the three steps:
//   1. POST /api/bookings/:id/payments  → order (amount from the server)
//   2. POST /api/mock-gateway/pay       → the fake Razorpay: paymentId + signature
//   3. POST /api/payments/verify        → the confirmed booking
// Any step can fail with the server's error (PAYMENT_FAILED, HOLD_EXPIRED, COUPON_INVALID …).
// "Processing…" stays at least paymentMinimum (PAY-02: 2–3 s).
export function usePayBooking(bookingId, showId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ method, form }) =>
      atLeast(
        (async () => {
          const { orderId } = await apiFetch(`/bookings/${bookingId}/payments`, { method: 'POST' })
          const paid = await apiFetch('/mock-gateway/pay', { method: 'POST', body: gatewayBody(orderId, method, form) })
          return apiFetch('/payments/verify', { method: 'POST', body: { orderId, ...paid } })
        })(),
        motion.paymentMinimum,
      ),
    onSuccess: ({ booking }) => queryClient.setQueryData(['booking', bookingId], booking),
    // A changed total (coupon removed …) or an ended hold: load the booking and seats again
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['show-seats', showId] })
    },
  })
}
