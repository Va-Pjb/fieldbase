import { supabase } from '../supabaseClient'
import type { DashboardResult, InsightAskResult } from '@fieldbase/shared-types'

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

/** Deterministic analytics payload for the dashboard (read-only, no AI). */
export async function getDashboard(): Promise<DashboardResult> {
  const { data, error } = await supabase.functions.invoke('insights-query', {
    body: { mode: 'dashboard' },
  })
  if (error) throw await edgeError(error, 'Failed to load analytics.')
  return data as DashboardResult
}

/**
 * Turn a natural-language question into a validated, whitelisted plan and run
 * it (AI, read-only — never SQL, never a write). Returns the interpreted plan
 * plus rows or an aggregate.
 */
export async function askInsight(question: string): Promise<InsightAskResult> {
  const { data, error } = await supabase.functions.invoke('insights-query', {
    body: { mode: 'ask', question },
  })
  if (error) throw await edgeError(error, "Couldn't run that query.")
  return data as InsightAskResult
}
