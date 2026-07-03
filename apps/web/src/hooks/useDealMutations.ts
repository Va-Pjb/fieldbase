import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDeal,
  deleteDeal,
  moveDealStage,
  updateDeal,
  type Deal,
  type DealInsert,
  type DealStage,
  type DealUpdate,
} from '../lib/api/deals'
import { queryKeys } from '../lib/queryKeys'

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DealInsert) => createDeal(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.deals.all }),
  })
}

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DealUpdate }) => updateDeal(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.deals.all }),
  })
}

/** Optimistic stage move: update the cached board immediately, roll back on error. */
export function useMoveDealStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) => moveDealStage(id, stage),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: queryKeys.deals.all })
      const key = queryKeys.deals.list()
      const prev = qc.getQueryData<Deal[]>(key)
      if (prev) {
        qc.setQueryData<Deal[]>(
          key,
          prev.map((d) => (d.id === id ? { ...d, stage } : d)),
        )
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.deals.list(), ctx.prev)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.deals.all }),
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDeal(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.deals.all }),
  })
}
