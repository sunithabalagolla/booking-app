import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'
import { anyGateOpen } from '../pages/owner/checkinReport.js'

// O-10 check-in report (api.md Section 8: /api/owner/checkin-report)

const AUTO_REFRESH_MS = 30 * 1000

// { date, items, totals }. Reloads every 30 s only while a gate of that day is open (decided 2026-10-13).
export function useCheckinReport(filters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined))
  return useQuery({
    queryKey: ['owner', 'checkin-report', filters],
    queryFn: () => apiFetch(`/owner/checkin-report?${params}`),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (anyGateOpen(query.state.data?.items) ? AUTO_REFRESH_MS : false),
  })
}
