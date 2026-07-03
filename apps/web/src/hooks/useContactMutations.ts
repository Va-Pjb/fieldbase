import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactInsert,
  type ContactUpdate,
} from '../lib/api/contacts'
import { queryKeys } from '../lib/queryKeys'

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ContactInsert) => createContact(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.contacts.all }),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ContactUpdate }) => updateContact(id, patch),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: queryKeys.contacts.all })
      void qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(data.id) })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.contacts.all }),
  })
}
