import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// U-13 GET /api/theatres/:id/food: the canteen menu (in-stock items first) +
// maxQtyPerItem. { theatre: { id, name }, maxQtyPerItem, items }
export function useCanteenMenu(theatreId) {
  return useQuery({ queryKey: ['canteen', theatreId], queryFn: () => apiFetch(`/theatres/${theatreId}/food`), enabled: Boolean(theatreId), staleTime: 60 * 1000 })
}
