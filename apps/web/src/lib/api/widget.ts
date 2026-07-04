import { supabase } from '../supabaseClient'
import type { WidgetAskResult, WidgetBookingInput, WidgetBookingResult } from '@fieldbase/shared-types'

// Public widget calls. These hit the widget-public edge function (verify_jwt=
// false); the token in the body identifies the owner. No login required — the
// anon client's apikey is enough for the gateway.
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

/** Ask the widget an FAQ question (answered only from the owner's profile). */
export async function askWidget(token: string, question: string): Promise<WidgetAskResult> {
  const { data, error } = await supabase.functions.invoke('widget-public', {
    body: { token, mode: 'ask', question },
  })
  if (error) throw await edgeError(error, 'The assistant is unavailable right now.')
  return data as WidgetAskResult
}

/** Submit a booking request (creates a pending, owner-confirmed appointment). */
export async function bookWidget(
  token: string,
  booking: WidgetBookingInput,
): Promise<WidgetBookingResult> {
  const { data, error } = await supabase.functions.invoke('widget-public', {
    body: { token, mode: 'book', booking },
  })
  if (error) throw await edgeError(error, 'Could not submit your request.')
  return data as WidgetBookingResult
}
