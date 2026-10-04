import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// Public movie lists (api.md: GET /api/movies): city + status (U-05) and the
// search + filters (U-06, SF-08) as `filters` (already in API form, see pages/public/search.js).
// The city and filters are part of the key, so a change loads the list again (U-04).
// While new results load, the old ones stay on screen (no jumping while typing).
export function useMovies({ city, status, limit, filters = {}, enabled = true }) {
  return useQuery({
    queryKey: ['movies', { city, status, limit, ...filters }],
    queryFn: () => apiFetch(`/movies?${new URLSearchParams({ city, status, limit: String(limit), ...filters })}`),
    enabled: Boolean(city) && enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
