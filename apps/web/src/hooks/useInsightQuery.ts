import { useMutation } from '@tanstack/react-query'
import type { InsightAskResult } from '@fieldbase/shared-types'
import { askInsight } from '../lib/api/insights'

/** Ask a natural-language question (user-triggered, so a mutation not a query). */
export function useInsightQuery() {
  return useMutation<InsightAskResult, Error, string>({ mutationFn: askInsight })
}
