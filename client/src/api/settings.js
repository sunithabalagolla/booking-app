import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// A-05 settings (api.md: GET /api/settings/public, GET / PATCH /api/admin/settings)

// Values the screens need (hold time, max seats, fee, upload size…). Rarely change.
export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async () => (await apiFetch('/settings/public')).settings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await apiFetch('/admin/settings')).settings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiFetch('/admin/settings', { method: 'PATCH', body }),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin', 'settings'], data.settings)
      queryClient.invalidateQueries({ queryKey: ['settings', 'public'] })
    },
  })
}
