import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-03 owner theatres (api.md Section 8: /api/owner/theatres, /api/owner/cities)

const KEY = ['owner', 'theatres']

// The fixed city list (settings), for the city drop-down
export function useOwnerCities() {
  return useQuery({
    queryKey: ['owner', 'cities'],
    queryFn: async () => (await apiFetch('/owner/cities')).cities,
    staleTime: 60 * 60 * 1000,
  })
}

export function useMyTheatres() {
  return useQuery({ queryKey: KEY, queryFn: async () => (await apiFetch('/owner/theatres')).items })
}

export function useMyTheatre(id) {
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await apiFetch(`/owner/theatres/${id}`)).theatre, enabled: Boolean(id) })
}

function useTheatreMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateTheatre = () => useTheatreMutation((body) => apiFetch('/owner/theatres', { method: 'POST', body }))
export const useUpdateTheatre = (id) => useTheatreMutation((body) => apiFetch(`/owner/theatres/${id}`, { method: 'PATCH', body }))
