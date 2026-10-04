import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-04 owner screens (api.md Section 8: /api/owner/theatres/:id/screens, /api/owner/screens/:id)

const KEY = ['owner', 'screens']

// { theatre: { id, name, status }, items: [screen without grid] }
export function useTheatreScreens(theatreId) {
  return useQuery({ queryKey: [...KEY, 'theatre', theatreId], queryFn: () => apiFetch(`/owner/theatres/${theatreId}/screens`), enabled: Boolean(theatreId) })
}

// { screen, theatre }
export function useMyScreen(id) {
  return useQuery({ queryKey: [...KEY, id], queryFn: () => apiFetch(`/owner/screens/${id}`), enabled: Boolean(id) })
}

function useScreenMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateScreen = (theatreId) => useScreenMutation((body) => apiFetch(`/owner/theatres/${theatreId}/screens`, { method: 'POST', body }))
export const useUpdateScreen = (id) => useScreenMutation((body) => apiFetch(`/owner/screens/${id}`, { method: 'PATCH', body }))
