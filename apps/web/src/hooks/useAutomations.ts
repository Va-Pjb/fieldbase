import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAutomation, listAutomations, setAutomationActive } from '../lib/api/automations'
import { queryKeys } from '../lib/queryKeys'

export function useAutomations() {
  return useQuery({ queryKey: queryKeys.automations.list(), queryFn: listAutomations })
}

export function useCreateAutomation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ instructions, name }: { instructions: string; name?: string }) =>
      createAutomation(instructions, name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.automations.all }),
  })
}

export function useSetAutomationActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setAutomationActive(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.automations.all }),
  })
}
