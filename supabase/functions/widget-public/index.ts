import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  buildWidgetMessage,
  normalizeQuestion,
  validateBookingInput,
  WIDGET_SYSTEM,
} from '../_shared/communication.ts'

// PUBLIC endpoint — the ONLY function deployed with verify_jwt=false. There is
// no caller JWT; a visitor is authenticated only by a per-owner public_token.
// It uses the SERVICE ROLE key, so RLS is bypassed: every query below is
// therefore EXPLICITLY scoped to the token's owner (owner = config.user_id),
// and any client-supplied user_id is ignored. The 'ask' path performs zero CRM
// reads/writes; bookings are only ever written as status='requested'. Errors
// return a generic message to the visitor; details are logged server-side.
//
// Abuse hardening: fixed-window rate limits (per token+IP, and per-owner daily
// caps on AI calls + bookings) via widget_rate_bump; per-call cost bounded by
// low max_tokens + field caps. Still deferred to Phase 7: a captcha/bot
// challenge and global per-IP limits.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!url || !serviceKey) {
      console.error('widget-public: missing SUPABASE_URL / SERVICE_ROLE_KEY')
      return json({ error: 'The widget is temporarily unavailable.' }, 503)
    }

    // Service-role client: RLS is bypassed, so EVERY query is scoped to `owner`
    // (resolved from the token) and never trusts client-supplied ownership.
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    // Cheap first-line guard against memory-amplification (field caps bound row
    // size, not the raw payload). Content-Length can be absent/spoofed, so it is
    // defense-in-depth, not the only limit.
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > 16_384) {
      return json({ error: 'Request is too large.' }, 413)
    }

    const body = (await req.json().catch(() => ({}))) as {
      token?: unknown
      mode?: unknown
      question?: unknown
      booking?: unknown
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token || token.length > 128) {
      return json({ error: 'A valid widget token is required.' }, 400)
    }

    // --- Rate limiting (H1): fixed-window counters via the service role. ------
    // Fail-open on a limiter fault so an infra hiccup can't take the widget down.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
    const nowMs = Date.now()
    const minuteWindow = new Date(Math.floor(nowMs / 60_000) * 60_000).toISOString()
    const dayWindow = new Date(Math.floor(nowMs / 86_400_000) * 86_400_000).toISOString()
    const withinLimit = async (bucket: string, windowStart: string, limit: number): Promise<boolean> => {
      const { data, error } = await admin.rpc('widget_rate_bump', {
        p_bucket: bucket,
        p_window_start: windowStart,
        p_limit: limit,
      })
      if (error) {
        console.error('widget-public: rate-limit check failed:', error.message)
        return true
      }
      return data === true
    }

    // Per-token + IP short-window cap covers both ask and book.
    if (!(await withinLimit(`req:${token}:${ip}`, minuteWindow, 20))) {
      return json({ error: 'Too many requests. Please slow down and try again shortly.' }, 429)
    }

    const { data: config, error: cfgErr } = await admin
      .from('widget_config')
      .select('user_id, business_name, services, hours, faq, is_enabled')
      .eq('public_token', token)
      .maybeSingle()
    if (cfgErr) {
      console.error('widget-public: config lookup failed:', cfgErr.message)
      return json({ error: 'The widget is temporarily unavailable.' }, 503)
    }
    if (!config || !config.is_enabled) {
      return json({ error: 'This booking widget is not available.' }, 404)
    }
    const owner = config.user_id as string

    const mode = body.mode === 'book' ? 'book' : 'ask'

    // --- FAQ: answer only from the owner's profile. No CRM read/write. --------
    if (mode === 'ask') {
      const question = normalizeQuestion(body.question)
      if (!question) return json({ error: 'Please enter a question.' }, 400)

      // Per-owner daily cap on assistant calls (bounds Anthropic cost).
      if (!(await withinLimit(`ai:${owner}`, dayWindow, 200))) {
        return json(
          { error: 'The assistant has reached its limit for today. Please request a booking instead.' },
          429,
        )
      }

      const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
      if (!anthropicKey) return json({ error: 'The assistant is temporarily unavailable.' }, 503)

      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 512,
        thinking: { type: 'disabled' },
        system: WIDGET_SYSTEM,
        messages: [{ role: 'user', content: buildWidgetMessage(config, question) }],
      })
      const answer = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('\n')
        .trim()
      return json(
        {
          answer:
            answer ||
            "Sorry, I'm not sure about that — please request a booking and we'll follow up.",
        },
        200,
      )
    }

    // --- Booking: create a contact + a status='requested' appointment. --------
    // Per-owner daily cap on bookings (bounds a flood of fake requests).
    if (!(await withinLimit(`book:${owner}`, dayWindow, 100))) {
      return json(
        { error: 'We have received too many booking requests today. Please contact us directly.' },
        429,
      )
    }

    const valid = validateBookingInput(body.booking, nowMs)
    if (!valid.ok) return json({ error: valid.error }, 400)
    const b = valid.value

    // Always create a fresh lead contact (M2): never merge onto an existing
    // contact by unverified email — that would let a visitor graft a booking
    // onto someone else's record. The owner reviews/merges source='widget' leads.
    const { data: created, error: cErr } = await admin
      .from('contacts')
      .insert({
        user_id: owner,
        name: b.name,
        email: b.email ?? null,
        phone: b.phone ?? null,
        source: 'widget',
      })
      .select('id')
      .single()
    if (cErr) {
      console.error('widget-public: contact insert failed:', cErr.message)
      return json({ error: 'We could not save your request. Please try again.' }, 500)
    }
    const contactId = created.id

    const { data: appt, error: aErr } = await admin
      .from('appointments')
      .insert({
        user_id: owner,
        contact_id: contactId,
        start_time: b.startTime,
        end_time: b.endTime,
        status: 'requested', // never auto-confirmed; the owner confirms in-app
        notes: b.notes ?? null,
        source: 'widget',
      })
      .select('id')
      .single()
    if (aErr) {
      console.error('widget-public: appointment insert failed:', aErr.message)
      return json({ error: 'We could not save your request. Please try again.' }, 500)
    }

    return json({ status: 'requested', appointmentId: appt.id }, 200)
  } catch (e) {
    console.error('widget-public: unhandled error:', e instanceof Error ? e.message : String(e))
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
