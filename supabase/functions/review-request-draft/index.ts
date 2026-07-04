import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  buildReviewMessage,
  MAX_REVIEW_DRAFTS,
  REVIEW_SYSTEM,
  REVIEW_TOOL_SCHEMA,
  selectReviewEligibleDeals,
} from '../_shared/communication.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const REVIEW_CHANNEL = 'email' // reviews are simulated; the channel labels the logged interaction

// Scan for completed jobs (won deals) that have not yet had a review asked (or
// take one explicit dealId), have Claude draft a review request per job, and
// persist them as review_requests (status='draft'). NEVER sends — nothing goes
// out until review-request-send is called with a reviewId.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ error: 'AI unavailable: ANTHROPIC_API_KEY is not configured.' }, 503)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Not authenticated.' }, 401)

    const body = (await req.json().catch(() => ({}))) as { dealId?: string }

    // Configured review link (optional) — included in the drafted body when set.
    const { data: cfg } = await supabase
      .from('widget_config')
      .select('review_link')
      .maybeSingle()
    const reviewLink = cfg?.review_link ?? undefined

    // Assemble the eligible jobs (deal + its contact).
    type Job = { dealId: string; contactId: string; name: string; company: string | null; dealTitle: string }
    let jobs: Job[] = []
    let scanned = 0

    const [{ data: deals }, { data: reviewRequests }, { data: contacts }] = await Promise.all([
      supabase.from('deals').select('id, contact_id, title, stage, updated_at'),
      supabase.from('review_requests').select('job_id, status'),
      supabase.from('contacts').select('id, name, company'),
    ])
    const contactById = new Map((contacts ?? []).map((c) => [c.id, c]))
    const eligible = selectReviewEligibleDeals({
      deals: deals ?? [],
      reviewRequests: reviewRequests ?? [],
    })

    if (body.dealId) {
      const one = eligible.find((e) => e.dealId === body.dealId)
      if (!one) {
        return json(
          { error: 'That job is not eligible for a review request (must be a won deal with no existing request).' },
          400,
        )
      }
      scanned = 1
      const c = contactById.get(one.contactId)
      jobs = [{ dealId: one.dealId, contactId: one.contactId, name: c?.name ?? '', company: c?.company ?? null, dealTitle: one.dealTitle }]
    } else {
      scanned = eligible.length
      jobs = eligible.slice(0, MAX_REVIEW_DRAFTS).map((e) => {
        const c = contactById.get(e.contactId)
        return { dealId: e.dealId, contactId: e.contactId, name: c?.name ?? '', company: c?.company ?? null, dealTitle: e.dealTitle }
      })
    }

    if (jobs.length === 0) return json({ drafts: [], scanned: 0, capped: false }, 200)

    // One Claude call drafts a review request per job (echoing the dealId).
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      system: REVIEW_SYSTEM,
      tools: [
        {
          name: 'emit_review_requests',
          description: 'Emit one review-request message per completed job, echoing the dealId.',
          input_schema: REVIEW_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_review_requests' },
      messages: [{ role: 'user', content: buildReviewMessage(jobs, reviewLink) }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    const emitted =
      block && block.type === 'tool_use'
        ? ((block.input as { drafts?: { dealId?: unknown; body?: unknown }[] }).drafts ?? [])
        : []
    const bodyByDeal = new Map<string, string>()
    for (const d of emitted) {
      if (typeof d?.dealId === 'string' && typeof d?.body === 'string' && d.body.trim()) {
        bodyByDeal.set(d.dealId, d.body.trim())
      }
    }

    const jobByDeal = new Map(jobs.map((j) => [j.dealId, j]))
    const rows: { contact_id: string; job_id: string; channel: string; body: string; status: string }[] = []
    for (const [dealId, text] of bodyByDeal) {
      if (!jobByDeal.has(dealId)) continue // ignore hallucinated ids
      rows.push({
        contact_id: jobByDeal.get(dealId)!.contactId,
        job_id: dealId,
        channel: REVIEW_CHANNEL,
        body: text,
        status: 'draft',
      })
    }
    if (rows.length === 0) {
      return json({ error: 'The assistant did not return any usable drafts.' }, 422)
    }

    const { data: inserted, error: insErr } = await supabase
      .from('review_requests')
      .insert(rows)
      .select('id, contact_id, job_id')
    if (insErr) return json({ error: `Failed to save review drafts: ${insErr.message}` }, 500)

    const drafts = (inserted ?? []).map((r) => {
      const job = r.job_id ? jobByDeal.get(r.job_id) : undefined
      return {
        reviewId: r.id,
        contactId: r.contact_id,
        contactName: job?.name ?? '',
        dealTitle: job?.dealTitle ?? '',
        channel: REVIEW_CHANNEL,
        body: r.job_id ? (bodyByDeal.get(r.job_id) ?? '') : '',
      }
    })
    return json({ drafts, scanned, capped: scanned > jobs.length }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
