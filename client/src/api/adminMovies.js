import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// A-02 admin movies (api.md Section 10: /api/admin/movies)

const KEY = ['admin', 'movies']

// List with search, status filter and pages. Empty values are left out.
export function useAdminMovies({ q = '', status = '', page = 1 }) {
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (status) params.set('status', status)
  params.set('page', String(page))
  return useQuery({
    queryKey: [...KEY, 'list', { q: q.trim(), status, page }],
    queryFn: () => apiFetch(`/admin/movies?${params}`),
    placeholderData: keepPreviousData, // keep the old page while the next one loads
  })
}

export function useAdminMovie(id) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch(`/admin/movies/${id}`),
    enabled: Boolean(id),
  })
}

// After any change: the lists and that movie load again
function useMovieMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export const useCreateMovie = () => useMovieMutation((body) => apiFetch('/admin/movies', { method: 'POST', body }))
export const useUpdateMovie = (id) => useMovieMutation((body) => apiFetch(`/admin/movies/${id}`, { method: 'PATCH', body }))
export const useDeleteMovie = (id) => useMovieMutation(() => apiFetch(`/admin/movies/${id}`, { method: 'DELETE' }))
