import { useQuery } from '@tanstack/react-query'
import { listDeals, listDealsByContact } from '../lib/api/deals'
import { queryKeys } from '../lib/queryKeys'

export function useDeals() {
  return useQuery({
    queryKey: queryKeys.deals.list(),
    queryFn: listDeals,
  })
}

export function useDealsByContact(contactId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deals.byContact(contactId ?? ''),
    queryFn: () => listDealsByContact(contactId as string),
    enabled: Boolean(contactId),
  })
}
