import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// U-09 (api.md: GET /api/movies/:id/shows?city=&date=): the shows of one movie in a
// city on one IST day, grouped by theatre. First used by the Home banner chips.
export function useMovieShows({ movieId, city, date, enabled = true }) {
  return useQuery({
    queryKey: ['movie-shows', { movieId, city, date }],
    queryFn: () => apiFetch(`/movies/${movieId}/shows?${new URLSearchParams({ city, date })}`),
    enabled: Boolean(movieId && city && date) && enabled,
    staleTime: 60 * 1000,
  })
}
