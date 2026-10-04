import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// Public movie lists (api.md: GET /api/movies). U-05: city + status; U-06 adds search + filters.
// The city is part of the key, so changing the city loads the lists again (U-04).
export function useMovies({ city, status, limit }) {
  return useQuery({
    queryKey: ['movies', { city, status, limit }],
    queryFn: () => apiFetch(`/movies?${new URLSearchParams({ city, status, limit: String(limit) })}`),
    enabled: Boolean(city),
    staleTime: 60 * 1000,
  })
}
