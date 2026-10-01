import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// A-03 owner approvals + owner block / unblock (api.md Section 10)

const KEY = ['admin', 'owners']

// status: 'pending' · 'approved' · 'rejected' · '' (all)
export function useAdminOwners({ status = 'pending', q = '', page = 1 }) {
  const params = new URLSearchParams()
  if (status) params.set('approvalStatus', status)
  if (q.trim()) params.set('q', q.trim())
  params.set('page', String(page))
  return useQuery({
    queryKey: [...KEY, 'list', { status, q: q.trim(), page }],
    queryFn: () => apiFetch(`/admin/owners?${params}`),
    placeholderData: keepPreviousData,
  })
}

// How many owners wait for a decision (sidebar count)
export function usePendingOwnerCount(enabled) {
  return useQuery({
    queryKey: [...KEY, 'pendingCount'],
    queryFn: async () => (await apiFetch('/admin/owners?approvalStatus=pending&limit=1')).total,
    enabled,
  })
}

// Every action answers with the changed owner; the lists and the count load again
function useOwnerAction(makeRequest) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: makeRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export const useApproveOwner = () => useOwnerAction(({ id }) => apiFetch(`/admin/owners/${id}/approve`, { method: 'POST' }))
export const useRejectOwner = () => useOwnerAction(({ id, reason }) => apiFetch(`/admin/owners/${id}/reject`, { method: 'POST', body: { reason } }))
export const useBlockOwner = () =>
  useOwnerAction(({ id, reason }) => apiFetch(`/admin/users/${id}/block`, { method: 'POST', body: reason ? { reason } : {} }))
export const useUnblockOwner = () => useOwnerAction(({ id }) => apiFetch(`/admin/users/${id}/unblock`, { method: 'POST', body: {} }))
