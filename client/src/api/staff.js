import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// Gate Staff (api.md Section 9: /api/staff)

// My theatres (scanner + canteen counter header). `enabled: false` for owners (O-11 shared page).
export function useStaffTheatres({ enabled = true } = {}) {
  return useQuery({ queryKey: ['staff', 'theatres'], queryFn: async () => (await apiFetch('/staff/theatres')).items, staleTime: 5 * 60 * 1000, enabled })
}

// S-02 … S-05: { qrToken } or { bookingNumber } → { result: 'entered', booking, usedAt } or
// { result: 'rejected', reason, … } (always 200)
export const useCheckIn = () => useMutation({ mutationFn: (body) => apiFetch('/staff/checkins', { method: 'POST', body }) })
