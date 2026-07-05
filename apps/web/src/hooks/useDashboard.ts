import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../lib/api/insights'
import { queryKeys } from '../lib/queryKeys'

/** The deterministic analytics dashboard payload (no AI). */
export function useDashboard() {
  return useQuery({ queryKey: queryKeys.insights.dashboard(), queryFn: getDashboard })
}
