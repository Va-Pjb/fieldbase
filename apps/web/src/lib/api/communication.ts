import { supabase } from '../supabaseClient'
import { buildTimeline, type ContactSummaryResult, type TimelineEvent } from '@fieldbase/shared-types'

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

/**
 * Fetch a contact's interactions + appointments and merge into one timeline
 * (most-recent first). Reviews are not fetched here: a sent review is already
 * an interactions row, so it shows via that.
 */
export async function getContactTimeline(contactId: string): Promise<TimelineEvent[]> {
  const [interactions, appointments] = await Promise.all([
    supabase
      .from('interactions')
      .select('id, type, content, ai_summary, occurred_at')
      .eq('contact_id', contactId),
    supabase
      .from('appointments')
      .select('id, status, start_time, end_time, notes')
      .eq('contact_id', contactId),
  ])
  if (interactions.error) throw interactions.error
  if (appointments.error) throw appointments.error
  return buildTimeline(interactions.data ?? [], appointments.data ?? [])
}

/** Generate (or refresh) the AI relationship summary; caches it on the contact. */
export async function generateContactSummary(contactId: string): Promise<ContactSummaryResult> {
  const { data, error } = await supabase.functions.invoke('contact-summary', {
    body: { contactId },
  })
  if (error) throw await edgeError(error, 'Could not generate a summary.')
  return data as ContactSummaryResult
}
