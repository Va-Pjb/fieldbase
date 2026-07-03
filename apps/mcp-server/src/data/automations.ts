import type { Tables } from '@fieldbase/shared-types'
import { getSupabase } from '../lib/supabase.js'

export type Automation = Tables<'automations'>

/** List the caller's automations, newest first (RLS-scoped). */
export async function listAutomations(): Promise<Automation[]> {
  const { data, error } = await getSupabase()
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
