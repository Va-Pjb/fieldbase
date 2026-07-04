import { supabase } from '../supabaseClient'
import type { Tables, TablesUpdate } from '@fieldbase/shared-types'

export type WidgetConfigRow = Tables<'widget_config'>

/**
 * The current user's widget config, creating a default row on first access.
 * RLS scopes reads/writes to the owner; user_id is unique (one config per user).
 */
export async function getOrCreateWidgetConfig(): Promise<WidgetConfigRow> {
  const { data, error } = await supabase.from('widget_config').select('*').maybeSingle()
  if (error) throw error
  if (data) return data
  // user_id + public_token default in the DB; RLS enforces ownership.
  const { data: created, error: insErr } = await supabase
    .from('widget_config')
    .insert({})
    .select('*')
    .single()
  if (insErr) throw insErr
  return created
}

export async function updateWidgetConfig(
  id: string,
  patch: TablesUpdate<'widget_config'>,
): Promise<WidgetConfigRow> {
  const { data, error } = await supabase
    .from('widget_config')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
