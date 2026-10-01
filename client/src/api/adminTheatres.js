import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// A-04 theatre approvals (api.md Section 10)

const KEY = ['admin', 'theatres']

// status: 'pending' · 'approved' · 'rejected' · '' (all)
export function useAdminTheatres({ status = 'pending', cityCode = '', page = 1 }) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (cityCode) params.set('cityCode', cityCode)
  params.set('page', String(page))
  return useQuery({
    queryKey: [...KEY, 'list', { status, cityCode, page }],
    queryFn: () => apiFetch(`/admin/theatres?${params}`),
    placeholderData: keepPreviousData,
  })
}

// How many theatres wait for a decision (sidebar count)
export function usePendingTheatreCount(enabled) {
  return useQuery({
    queryKey: [...KEY, 'pendingCount'],
    queryFn: async () => (await apiFetch('/admin/theatres?status=pending&limit=1')).total,
    enabled,
  })
}

function useTheatreAction(makeRequest) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: makeRequest, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useApproveTheatre = () => useTheatreAction(({ id }) => apiFetch(`/admin/theatres/${id}/approve`, { method: 'POST' }))
export const useRejectTheatre = () =>
  useTheatreAction(({ id, reason }) => apiFetch(`/admin/theatres/${id}/reject`, { method: 'POST', body: { reason } }))
