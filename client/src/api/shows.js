import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// U-09 (api.md: GET /api/movies/:id/shows?city=&date=): the shows of one movie in a
// city on one IST day, grouped by theatre. Used by the Home banner chips and the show
// list on the movie details page (with the SF-08 filters, already as API values).
export function useMovieShows({ movieId, city, date, filters = {}, enabled = true }) {
  return useQuery({
    queryKey: ['movie-shows', { movieId, city, date, filters }],
    queryFn: () => apiFetch(`/movies/${movieId}/shows?${new URLSearchParams({ city, date, ...filters })}`),
    enabled: Boolean(movieId && city && date) && enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData, // the old list stays while a new day / filter loads
  })
}
