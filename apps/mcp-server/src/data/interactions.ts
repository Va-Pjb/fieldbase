import type { Tables, TablesInsert } from '@fieldbase/shared-types'
import { getSupabase } from '../lib/supabase.js'

export type Interaction = Tables<'interactions'>
export type InteractionInsert = TablesInsert<'interactions'>

export const INTERACTION_TYPES = ['call', 'email', 'note', 'sms'] as const
export type InteractionType = (typeof INTERACTION_TYPES)[number]

export function isInteractionType(value: string): value is InteractionType {
  return (INTERACTION_TYPES as readonly string[]).includes(value)
}

export async function logInteraction(input: {
  contactId: string
  type: InteractionType
  content?: string
  occurredAt?: string
}): Promise<Interaction> {
  const row: InteractionInsert = {
    contact_id: input.contactId,
    type: input.type,
    content: input.content ?? null,
  }
  if (input.occurredAt) row.occurred_at = input.occurredAt

  const { data, error } = await getSupabase().from('interactions').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function listInteractionsByContact(
  contactId: string,
  limit = 20,
): Promise<Interaction[]> {
  const { data, error } = await getSupabase()
    .from('interactions')
    .select('*')
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
