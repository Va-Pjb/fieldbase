import { useQuery } from '@tanstack/react-query'
import { getContact, listContacts } from '../lib/api/contacts'
import { queryKeys } from '../lib/queryKeys'

export function useContacts(search?: string) {
  return useQuery({
    queryKey: queryKeys.contacts.list(search),
    queryFn: () => listContacts(search),
  })
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id ?? ''),
    queryFn: () => getContact(id as string),
    enabled: Boolean(id),
  })
}
