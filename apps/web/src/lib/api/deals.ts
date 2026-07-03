import { supabase } from '../supabaseClient'
import type { Tables, TablesInsert, TablesUpdate } from '@fieldbase/shared-types'

export type Deal = Tables<'deals'>
export type DealInsert = TablesInsert<'deals'>
export type DealUpdate = TablesUpdate<'deals'>

// Pipeline stages (mirror the CHECK constraint on deals.stage).
export const DEAL_STAGES = [
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

export async function listDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listDealsByContact(contactId: string): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createDeal(input: DealInsert): Promise<Deal> {
  const { data, error } = await supabase.from('deals').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function updateDeal(id: string, patch: DealUpdate): Promise<Deal> {
  const { data, error } = await supabase
    .from('deals')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function moveDealStage(id: string, stage: DealStage): Promise<Deal> {
  return updateDeal(id, { stage })
}

export async function deleteDeal(id: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw error
}
