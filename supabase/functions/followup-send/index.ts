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

// The single guarded send path. Accepts ONLY a draftId produced by a prior
// followup-draft. "Sending" is simulated: the message is logged as an
// interactions row (fake data only — no real SMS/email). No draft id, no send.
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

    const body = (await req.json().catch(() => ({}))) as { draftId?: string; draft_id?: string }
    const draftId = body.draftId ?? body.draft_id
    if (!draftId || typeof draftId !== 'string' || !UUID_RE.test(draftId)) {
      return json({ error: 'A valid draftId from a prior followup_draft is required.' }, 400)
    }

    // Load the draft. RLS restricts to the caller's own drafts.
    const { data: draft, error: loadErr } = await supabase
      .from('followup_drafts')
      .select('id, status, contact_id, channel, body')
      .eq('id', draftId)
      .maybeSingle()
    if (loadErr) return json({ error: `Failed to load draft: ${loadErr.message}` }, 500)
    if (!draft) return json({ error: 'Draft not found (or not yours).' }, 404)
    if (draft.status !== 'draft' && draft.status !== 'approved') {
      return json(
        { error: `Draft is '${draft.status}'; only a draft awaiting approval can be sent.` },
        409,
      )
    }

    // Atomically claim the draft (draft/approved -> sending). Guards double-send.
    const { data: claimed, error: claimErr } = await supabase
      .from('followup_drafts')
      .update({ status: 'sending' })
      .eq('id', draftId)
      .in('status', ['draft', 'approved'])
      .select('id')
      .maybeSingle()
    if (claimErr) return json({ error: `Failed to claim draft: ${claimErr.message}` }, 500)
    if (!claimed) {
      return json({ error: 'Draft is no longer awaiting approval (already sending or sent).' }, 409)
    }

    // Simulated send: record the outbound message as an interaction.
    const { data: interaction, error: insErr } = await supabase
      .from('interactions')
      .insert({
        contact_id: draft.contact_id,
        type: draft.channel, // 'email' | 'sms' — both valid interaction types
        content: draft.body,
        ai_summary: 'AI follow-up sent',
      })
      .select('id')
      .single()
    if (insErr) {
      await supabase
        .from('followup_drafts')
        .update({ status: 'failed', review_notes: { error: insErr.message } })
        .eq('id', draftId)
      return json({ error: `Send failed: ${insErr.message}` }, 500)
    }

    await supabase
      .from('followup_drafts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', draftId)

    return json(
      { draftId, contactId: draft.contact_id, interactionId: interaction.id, channel: draft.channel },
      200,
    )
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
