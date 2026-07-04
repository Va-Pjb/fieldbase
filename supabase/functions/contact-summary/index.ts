import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { buildSummaryMessage, buildTimeline, SUMMARY_SYSTEM } from '../_shared/communication.ts'

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

// Generate a Claude relationship summary over a contact's unified timeline
// (interactions + appointments) and cache it on the contact. Read-ish: the only
// write is the cached summary on the contact's own row.
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

    const body = (await req.json().catch(() => ({}))) as { contactId?: string }
    const contactId = body.contactId
    if (!contactId || typeof contactId !== 'string' || !UUID_RE.test(contactId)) {
      return json({ error: 'A valid contactId is required.' }, 400)
    }

    // Load the contact + its timeline sources (RLS restricts to the caller's own).
    const { data: contact, error: cErr } = await supabase
      .from('contacts')
      .select('id, name, company')
      .eq('id', contactId)
      .maybeSingle()
    if (cErr) return json({ error: `Failed to load contact: ${cErr.message}` }, 500)
    if (!contact) return json({ error: 'Contact not found (or not yours).' }, 404)

    const [{ data: interactions }, { data: appointments }] = await Promise.all([
      supabase
        .from('interactions')
        .select('id, type, content, ai_summary, occurred_at')
        .eq('contact_id', contactId),
      supabase
        .from('appointments')
        .select('id, status, start_time, end_time, notes')
        .eq('contact_id', contactId),
    ])

    const events = buildTimeline(interactions ?? [], appointments ?? [])

    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      thinking: { type: 'disabled' },
      system: SUMMARY_SYSTEM,
      messages: [
        { role: 'user', content: buildSummaryMessage({ name: contact.name, company: contact.company }, events) },
      ],
    })
    const summary = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim()
    if (!summary) return json({ error: 'The assistant did not return a summary.' }, 422)

    const updatedAt = new Date().toISOString()
    const { error: upErr } = await supabase
      .from('contacts')
      .update({ ai_summary: summary, summary_updated_at: updatedAt })
      .eq('id', contactId)
    if (upErr) return json({ error: `Failed to save summary: ${upErr.message}` }, 500)

    return json({ summary, updatedAt }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
