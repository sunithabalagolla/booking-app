import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-09 Gate Staff accounts (api.md Section 8: /api/owner/staff)

const KEY = ['owner', 'staff']

// [{ id, name, email, status, theatres: [{ id, name }], createdAt }]
export function useMyStaff() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await apiFetch('/owner/staff')).items })
}

function useStaffMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateStaff = () => useStaffMutation((body) => apiFetch('/owner/staff', { method: 'POST', body }))
// Takes { id, body }, so one hook works for every row of the list (block / unblock)
export const useUpdateStaff = () => useStaffMutation(({ id, body }) => apiFetch(`/owner/staff/${id}`, { method: 'PATCH', body }))
