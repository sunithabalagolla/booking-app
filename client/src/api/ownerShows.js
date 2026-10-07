import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-05 owner shows (api.md Section 8: /api/owner/shows, /api/owner/movies)

const KEY = ['owner', 'shows']

// Movies an owner can pick (Now showing + Coming soon)
export function useOwnerMovies() {
  return useQuery({ queryKey: ['owner', 'movies'], queryFn: async () => (await apiFetch('/owner/movies')).items, staleTime: 5 * 60 * 1000 })
}

// { items, page, limit, total, from, to }. Empty filters are left out.
export function useMyShows(filters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined))
  return useQuery({ queryKey: [...KEY, 'list', filters], queryFn: () => apiFetch(`/owner/shows?${params}`), placeholderData: keepPreviousData })
}

export function useMyShow(id) {
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await apiFetch(`/owner/shows/${id}`)).show, enabled: Boolean(id) })
}

function useShowMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateShows = () => useShowMutation((body) => apiFetch('/owner/shows', { method: 'POST', body }))
export const useUpdateShow = (id) => useShowMutation((body) => apiFetch(`/owner/shows/${id}`, { method: 'PATCH', body }))

// O-06 cancel show: { bookings, refundPaise } before saying yes (fetched when the panel opens)
export function useShowCancelPreview(id) {
  return useQuery({ queryKey: [...KEY, id, 'cancel-preview'], queryFn: () => apiFetch(`/owner/shows/${id}/cancel-preview`), staleTime: 0 })
}

// { reason } → { show, bookings, refundPaise }
export const useCancelShow = (id) => useShowMutation((body) => apiFetch(`/owner/shows/${id}/cancel`, { method: 'POST', body }))
