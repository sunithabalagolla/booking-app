import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-11 canteen counter (api.md Section 9: /api/food-pickup). Owner or Gate Staff.
// { qrToken } or { bookingNumber } → { result: 'found' | 'collected', order } or
// { result: 'rejected', reason, … } (always 200)

export const useFoodLookup = () => useMutation({ mutationFn: (body) => apiFetch('/food-pickup/lookup', { method: 'POST', body }) })
export const useFoodCollect = () => useMutation({ mutationFn: (body) => apiFetch('/food-pickup/collect', { method: 'POST', body }) })
