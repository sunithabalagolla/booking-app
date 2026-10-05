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

// UI-20 seat page: one show with its layout and prices (cancelled / started → 404 NOT_FOUND)
export function useShow(id) {
  return useQuery({ queryKey: ['show', id], queryFn: async () => (await apiFetch(`/shows/${id}`)).show, enabled: Boolean(id), retry: false })
}

// U-10: the seats taken right now (held / booked). Live updates by Socket.io come in Step 3.
export function useShowSeats(id, { enabled = true } = {}) {
  return useQuery({ queryKey: ['show-seats', id], queryFn: async () => (await apiFetch(`/shows/${id}/seats`)).taken, enabled: Boolean(id) && enabled })
}
