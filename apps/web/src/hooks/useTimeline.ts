import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { generateContactSummary, getContactTimeline } from '../lib/api/communication'
import { queryKeys } from '../lib/queryKeys'

/** A contact's merged interaction + appointment timeline. */
export function useTimeline(contactId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeline.byContact(contactId ?? ''),
    queryFn: () => getContactTimeline(contactId as string),
    enabled: Boolean(contactId),
  })
}

/** Generate the AI relationship summary; refreshes the contact so the cache shows. */
export function useGenerateContactSummary(contactId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => generateContactSummary(contactId as string),
    onSuccess: () => {
      if (contactId) {
        void qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(contactId) })
      }
    },
  })
}
