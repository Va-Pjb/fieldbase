import { createClient } from 'npm:@supabase/supabase-js@2'

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The single guarded review-send path. Accepts ONLY a reviewId produced by a
// prior review-request-draft (and approved). "Sending" is simulated: the review
// request is logged as an interactions row (fake data only — no real SMS/email).
// No review id, no send. Mirrors followup-send.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Not authenticated.' }, 401)

    const body = (await req.json().catch(() => ({}))) as { reviewId?: string; review_id?: string }
    const reviewId = body.reviewId ?? body.review_id
    if (!reviewId || typeof reviewId !== 'string' || !UUID_RE.test(reviewId)) {
      return json({ error: 'A valid reviewId from a prior review_request_draft is required.' }, 400)
    }

    // Load the review request. RLS restricts to the caller's own rows.
    const { data: review, error: loadErr } = await supabase
      .from('review_requests')
      .select('id, status, contact_id, channel, body')
      .eq('id', reviewId)
      .maybeSingle()
    if (loadErr) return json({ error: `Failed to load review request: ${loadErr.message}` }, 500)
    if (!review) return json({ error: 'Review request not found (or not yours).' }, 404)
    if (review.status !== 'draft' && review.status !== 'approved') {
      return json(
        { error: `Review request is '${review.status}'; only a draft awaiting approval can be sent.` },
        409,
      )
    }
    if (!review.body || !review.body.trim()) {
      return json({ error: 'This review draft has no message to send.' }, 422)
    }

    // Atomically claim the draft (draft/approved -> sending). Guards double-send.
    const { data: claimed, error: claimErr } = await supabase
      .from('review_requests')
      .update({ status: 'sending' })
      .eq('id', reviewId)
      .in('status', ['draft', 'approved'])
      .select('id')
      .maybeSingle()
    if (claimErr) return json({ error: `Failed to claim review request: ${claimErr.message}` }, 500)
    if (!claimed) {
      return json(
        { error: 'Review request is no longer awaiting approval (already sending or sent).' },
        409,
      )
    }

    // Simulated send: record the outbound review request as an interaction.
    const { data: interaction, error: insErr } = await supabase
      .from('interactions')
      .insert({
        contact_id: review.contact_id,
        type: review.channel, // 'email' | 'sms' — both valid interaction types
        content: review.body,
        ai_summary: 'Review request sent',
      })
      .select('id')
      .single()
    if (insErr) {
      await supabase
        .from('review_requests')
        .update({ status: 'failed', review_notes: { error: insErr.message } })
        .eq('id', reviewId)
      return json({ error: `Send failed: ${insErr.message}` }, 500)
    }

    await supabase
      .from('review_requests')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', reviewId)

    return json(
      { reviewId, contactId: review.contact_id, interactionId: interaction.id, channel: review.channel },
      200,
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
