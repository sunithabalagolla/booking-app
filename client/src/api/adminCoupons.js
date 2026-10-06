import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// A-06 admin coupons (api.md Section 10: /api/admin/coupons). No delete: "End now".

const KEY = ['admin', 'coupons']

// Register list: search by the start of the code, status filter, pages
export function useAdminCoupons({ q = '', status = '', page = 1 }) {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (status) params.set('status', status)
  params.set('page', String(page))
  return useQuery({
    queryKey: [...KEY, 'list', { q: q.trim(), status, page }],
    queryFn: () => apiFetch(`/admin/coupons?${params}`),
    placeholderData: keepPreviousData,
  })
}

export function useAdminCoupon(id) {
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await apiFetch(`/admin/coupons/${id}`)).coupon, enabled: Boolean(id) })
}

// Approved theatres for the "Only these theatres" choice (the most a page allows)
export function useApprovedTheatres() {
  return useQuery({ queryKey: ['admin', 'theatres', 'approvedAll'], queryFn: async () => (await apiFetch('/admin/theatres?status=approved&limit=100')).items, staleTime: 60 * 1000 })
}

// After any change: the lists and that coupon load again
function useCouponMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateCoupon = () => useCouponMutation((body) => apiFetch('/admin/coupons', { method: 'POST', body }))
export const useUpdateCoupon = (id) => useCouponMutation((body) => apiFetch(`/admin/coupons/${id}`, { method: 'PATCH', body }))
export const useEndCoupon = (id) => useCouponMutation(() => apiFetch(`/admin/coupons/${id}/end`, { method: 'POST' }))
