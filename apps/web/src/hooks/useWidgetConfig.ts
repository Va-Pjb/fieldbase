import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TablesUpdate } from '@fieldbase/shared-types'
import { getOrCreateWidgetConfig, updateWidgetConfig } from '../lib/api/widgetConfig'
import { queryKeys } from '../lib/queryKeys'

export function useWidgetConfig() {
  return useQuery({
    queryKey: queryKeys.widgetConfig.self(),
    queryFn: getOrCreateWidgetConfig,
  })
}

export function useUpdateWidgetConfig(id: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: TablesUpdate<'widget_config'>) => updateWidgetConfig(id as string, patch),
    onSuccess: (row) => {
      qc.setQueryData(queryKeys.widgetConfig.self(), row)
    },
  })
}
