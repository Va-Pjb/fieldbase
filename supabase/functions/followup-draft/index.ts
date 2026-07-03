import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  buildDraftMessage,
  type Channel,
  DRAFT_SYSTEM,
  DRAFT_TOOL_SCHEMA,
  selectColdLeads,
} from '../_shared/automation.ts'

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

const MAX_DRAFTS = 10

function numFrom(v: unknown, d: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
function chanFrom(v: unknown, d: Channel): Channel {
  return v === 'email' || v === 'sms' ? v : d
}
function strFrom(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

// Scan for cold leads (or take one explicit contact), have Claude draft a
// follow-up per lead, and persist them as followup_drafts (status='draft').
// NEVER sends — nothing leaves until followup-send is called with a draft id.
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

    const body = (await req.json().catch(() => ({}))) as {
      automationId?: string
      contactId?: string
    }

    // Resolve the follow-up config (window / channel / tone) + the automation to
    // stamp on each draft.
    let withinHours = 24
    let channel: Channel = 'email'
    let tone: string | undefined
    let automationId: string | null = null

    if (body.automationId) {
      const { data: a } = await supabase
        .from('automations')
        .select('id, trigger_config, action_config, action_type')
        .eq('id', body.automationId)
        .maybeSingle()
      if (!a) return json({ error: 'Automation not found (or not yours).' }, 404)
      if (a.action_type !== 'draft_followup') {
        return json({ error: 'That automation does not draft follow-ups.' }, 400)
      }
      automationId = a.id
      const tc = (a.trigger_config ?? {}) as Record<string, unknown>
      const ac = (a.action_config ?? {}) as Record<string, unknown>
      withinHours = numFrom(tc.withinHours, 24)
      channel = chanFrom(ac.channel, 'email')
      tone = strFrom(ac.tone)
    } else {
      const { data: list } = await supabase
        .from('automations')
        .select('id, trigger_config, action_config')
        .eq('action_type', 'draft_followup')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
      const a = list?.[0]
      if (a) {
        automationId = a.id
        const tc = (a.trigger_config ?? {}) as Record<string, unknown>
        const ac = (a.action_config ?? {}) as Record<string, unknown>
        withinHours = numFrom(tc.withinHours, 24)
        channel = chanFrom(ac.channel, 'email')
        tone = strFrom(ac.tone)
      }
    }

    // Assemble the lead list.
    type Lead = { contactId: string; name: string; company: string | null; reason: string }
    let leads: Lead[] = []
    let scanned = 0

    if (body.contactId) {
      const { data: c } = await supabase
        .from('contacts')
        .select('id, name, company')
        .eq('id', body.contactId)
        .maybeSingle()
      if (!c) return json({ error: 'Contact not found (or not yours).' }, 404)
      leads = [{ contactId: c.id, name: c.name, company: c.company, reason: 'Manual follow-up' }]
      scanned = 1
    } else {
      const [{ data: contacts }, { data: deals }, { data: interactions }] = await Promise.all([
        supabase.from('contacts').select('id, name, company, created_at'),
        supabase.from('deals').select('contact_id, stage'),
        supabase.from('interactions').select('contact_id, occurred_at'),
      ])
      const cold = selectColdLeads(
        { contacts: contacts ?? [], deals: deals ?? [], interactions: interactions ?? [] },
        withinHours,
        Date.now(),
      )
      scanned = cold.length
      const companyById = new Map((contacts ?? []).map((c) => [c.id, c.company]))
      leads = cold.slice(0, MAX_DRAFTS).map((l) => ({
        contactId: l.contactId,
        name: l.name,
        company: companyById.get(l.contactId) ?? null,
        reason: l.reason,
      }))
    }

    if (leads.length === 0) return json({ drafts: [], scanned: 0, capped: false }, 200)

    // One Claude call drafts a message per lead (echoing the contactId).
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      system: DRAFT_SYSTEM,
      tools: [
        {
          name: 'emit_followup_drafts',
          description: 'Emit one follow-up message per lead, echoing the contactId.',
          input_schema: DRAFT_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_followup_drafts' },
      messages: [{ role: 'user', content: buildDraftMessage(leads, channel, tone) }],
    })

    const block = msg.content.find((b) => b.type === 'tool_use')
    const emitted =
      block && block.type === 'tool_use'
        ? ((block.input as { drafts?: { contactId?: unknown; body?: unknown }[] }).drafts ?? [])
        : []
    const bodyByContact = new Map<string, string>()
    for (const d of emitted) {
      if (typeof d?.contactId === 'string' && typeof d?.body === 'string' && d.body.trim()) {
        bodyByContact.set(d.contactId, d.body.trim())
      }
    }

    const leadByContact = new Map(leads.map((l) => [l.contactId, l]))
    const rows: {
      contact_id: string
      automation_id: string | null
      channel: Channel
      body: string
      status: string
    }[] = []
    for (const [contactId, text] of bodyByContact) {
      if (!leadByContact.has(contactId)) continue // ignore hallucinated ids
      rows.push({ contact_id: contactId, automation_id: automationId, channel, body: text, status: 'draft' })
    }
    if (rows.length === 0) {
      return json({ error: 'The assistant did not return any usable drafts.' }, 422)
    }

    const { data: inserted, error: insErr } = await supabase
      .from('followup_drafts')
      .insert(rows)
      .select('id, contact_id')
    if (insErr) return json({ error: `Failed to save drafts: ${insErr.message}` }, 500)

    const drafts = (inserted ?? []).map((r) => {
      const lead = leadByContact.get(r.contact_id)
      return {
        draftId: r.id,
        contactId: r.contact_id,
        contactName: lead?.name ?? '',
        channel,
        body: bodyByContact.get(r.contact_id) ?? '',
        reason: lead?.reason ?? '',
      }
    })
    return json({ drafts, scanned, capped: scanned > leads.length }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
