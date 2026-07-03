import type { Tables, TablesUpdate } from '@fieldbase/shared-types'
import { getSupabase } from '../lib/supabase.js'

export type Deal = Tables<'deals'>

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

export function isDealStage(value: string): value is DealStage {
  return (DEAL_STAGES as readonly string[]).includes(value)
}

export async function listDeals(): Promise<Deal[]> {
  const { data, error } = await getSupabase()
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listDealsByContact(contactId: string): Promise<Deal[]> {
  const { data, error } = await getSupabase()
    .from('deals')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getDeal(id: string): Promise<Deal | null> {
  const { data, error } = await getSupabase().from('deals').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export interface PipelineStage {
  stage: DealStage
  label: string
  count: number
  totalValue: number
  deals: Deal[]
}

export interface Pipeline {
  stages: PipelineStage[]
  openTotal: number
  wonTotal: number
}

export async function getPipeline(): Promise<Pipeline> {
  const deals = await listDeals()
  const stages: PipelineStage[] = DEAL_STAGES.map((stage) => {
    const forStage = deals.filter((d) => d.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: forStage.length,
      totalValue: forStage.reduce((sum, d) => sum + (d.value ?? 0), 0),
      deals: forStage,
    }
  })
  const openTotal = deals
    .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    .reduce((sum, d) => sum + (d.value ?? 0), 0)
  const wonTotal = deals
    .filter((d) => d.stage === 'won')
    .reduce((sum, d) => sum + (d.value ?? 0), 0)
  return { stages, openTotal, wonTotal }
}

export async function moveDealStage(id: string, stage: DealStage): Promise<Deal> {
  const patch: TablesUpdate<'deals'> = { stage }
  const { data, error } = await getSupabase()
    .from('deals')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
