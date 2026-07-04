import { supabase } from '../supabaseClient'
import type { ReviewDraftResult, ReviewSendResult } from '@fieldbase/shared-types'

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

/** Scan won deals for jobs needing a review request and draft one each. Sends nothing. */
export async function draftReviews(dealId?: string): Promise<ReviewDraftResult> {
  const { data, error } = await supabase.functions.invoke('review-request-draft', {
    body: dealId ? { dealId } : {},
  })
  if (error) throw await edgeError(error, 'Could not find jobs to review.')
  return data as ReviewDraftResult
}

/** Send a drafted review request by id — the only path that records an outbound review. */
export async function sendReview(reviewId: string): Promise<ReviewSendResult> {
  const { data, error } = await supabase.functions.invoke('review-request-send', {
    body: { reviewId },
  })
  if (error) throw await edgeError(error, 'Send failed.')
  return data as ReviewSendResult
}
