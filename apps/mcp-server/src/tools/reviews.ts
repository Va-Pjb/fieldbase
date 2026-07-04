import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../lib/supabase.js'
import { fail, msg, ok } from './result.js'

// The review-request flow lives in Supabase Edge Functions (never-silent guard
// in one place). These tools invoke them as the demo user — functions.invoke
// attaches the RLS session JWT. Mirrors the follow-up draft/send spine.

// supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
// message is generic; the real reason is JSON in the underlying Response.
async function invokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string }
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // fall through to the generic message
    }
  }
  return msg(error)
}

export function registerReviewTools(server: McpServer) {
  server.registerTool(
    'review_request_draft',
    {
      title: 'Draft review requests for completed jobs',
      description:
        'Scan for completed jobs (won deals) that have not yet had a review asked and draft a review-request message for each (or draft for one dealId). Creates review drafts only — nothing is sent. Returns review ids to review, then send with review_request_send.',
      inputSchema: {
        dealId: z
          .string()
          .uuid()
          .optional()
          .describe('Draft a review request for one specific won deal instead of scanning all eligible jobs.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ dealId }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('review-request-draft', {
          body: { dealId },
        })
        if (error) return fail(`review_request_draft failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`review_request_draft failed: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'review_request_send',
    {
      title: 'Send a drafted review request',
      description:
        'Send a review request that was drafted by review_request_draft. Requires the reviewId it returned — there is no way to send one without first drafting and reviewing it. Records the outbound message on the contact timeline. A review request can only be sent once.',
      inputSchema: {
        reviewId: z
          .string()
          .uuid()
          .describe('The reviewId returned by review_request_draft. Required — nothing sends without it.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ reviewId }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('review-request-send', {
          body: { reviewId },
        })
        if (error) return fail(`review_request_send failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`review_request_send failed: ${msg(e)}`)
      }
    },
  )
}
