import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { findCity, useCityStore } from '../store/cityStore.js'
import { apiFetch } from './client.js'

// U-04 (api.md: GET /api/cities): cities with at least one approved theatre

export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: async () => (await apiFetch('/cities')).cities, staleTime: 5 * 60 * 1000 })
}

// The chosen city { code, name } (null = not chosen yet) + the list.
// A saved city that is not in the list any more is forgotten, so the user picks again.
export function useCurrentCity() {
  const cities = useCities()
  const cityCode = useCityStore((s) => s.cityCode)
  const setCity = useCityStore((s) => s.setCity)
  const city = cities.data ? findCity(cityCode, cities.data) : null

  useEffect(() => {
    if (cities.data && cityCode && !findCity(cityCode, cities.data)) setCity(null)
  }, [cities.data, cityCode, setCity])

  return { city, cities, setCity }
}
