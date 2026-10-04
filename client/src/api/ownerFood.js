import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// O-07 owner canteen items (api.md Section 8: /api/owner/theatres/:id/food, /api/owner/food/:id)

const KEY = ['owner', 'food']

// { theatre: { id, name, status }, items }
export function useTheatreFood(theatreId) {
  return useQuery({ queryKey: [...KEY, theatreId], queryFn: () => apiFetch(`/owner/theatres/${theatreId}/food`), enabled: Boolean(theatreId) })
}

function useFoodMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateFood = (theatreId) => useFoodMutation((body) => apiFetch(`/owner/theatres/${theatreId}/food`, { method: 'POST', body }))
// Takes { id, body }, so one hook works for every row of the list (stock switch)
export const useUpdateFood = () => useFoodMutation(({ id, body }) => apiFetch(`/owner/food/${id}`, { method: 'PATCH', body }))
export const useDeleteFood = () => useFoodMutation((id) => apiFetch(`/owner/food/${id}`, { method: 'DELETE' }))
