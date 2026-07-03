import { supabase } from '../supabaseClient'
import type {
  AutomationCreateResult,
  FollowupDraftResult,
  FollowupSendResult,
  Tables,
} from '@fieldbase/shared-types'

export type Automation = Tables<'automations'>

// supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
// message is generic; the real reason is JSON in the underlying Response.
async function edgeError(error: unknown, fallback: string): Promise<Error> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string }
      if (body?.error) return new Error(body.error)
    } catch {
      /* fall through */
    }
  }
  return new Error(error instanceof Error ? error.message : fallback)
}

/** Turn plain English into a validated rule and store it (AI, server-side). */
export async function createAutomation(
  instructions: string,
  name?: string,
): Promise<AutomationCreateResult> {
  const { data, error } = await supabase.functions.invoke('automation-create', {
    body: { instructions, name },
  })
  if (error) throw await edgeError(error, 'Create failed.')
  return data as AutomationCreateResult
}

export async function listAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function setAutomationActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('automations').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

/** Scan for cold leads and draft a follow-up per lead. Writes no messages. */
export async function draftFollowups(input?: {
  automationId?: string
  contactId?: string
}): Promise<FollowupDraftResult> {
  const { data, error } = await supabase.functions.invoke('followup-draft', { body: input ?? {} })
  if (error) throw await edgeError(error, 'Scan failed.')
  return data as FollowupDraftResult
}

/** Send a drafted follow-up by id — the only path that records an outbound message. */
export async function sendFollowup(draftId: string): Promise<FollowupSendResult> {
  const { data, error } = await supabase.functions.invoke('followup-send', { body: { draftId } })
  if (error) throw await edgeError(error, 'Send failed.')
  return data as FollowupSendResult
}
