import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  aggregateRows,
  buildDashboard,
  buildInsightMessage,
  INSIGHT_SYSTEM,
  INSIGHT_TOOL_SCHEMA,
  MAX_LIMIT,
  MAX_SCAN,
  validateInsightPlan,
  type InsightPlan,
} from '../_shared/insights.ts'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any

/**
 * Execute a VALIDATED plan via the typed Supabase query builder — the exact
 * crm_query discipline (typed table + whitelisted fields/ops + parameterized
 * values = injection-safe). Aggregate plans scan up to MAX_SCAN rows; row
 * queries fetch only plan.limit.
 */
async function executePlan(
  supabase: Client,
  plan: InsightPlan,
): Promise<{ rows: Record<string, unknown>[]; capped: boolean }> {
  let q = supabase.from(plan.entity).select('*')

  for (const f of plan.filters) {
    if (plan.entity === 'contacts' && f.field === 'tags' && f.op === 'contains') {
      q = q.contains('tags', [String(f.value)])
      continue
    }
    switch (f.op) {
      case 'eq':
        q = q.eq(f.field, f.value)
        break
      case 'neq':
        q = q.neq(f.field, f.value)
        break
      case 'gt':
        q = q.gt(f.field, f.value)
        break
      case 'gte':
        q = q.gte(f.field, f.value)
        break
      case 'lt':
        q = q.lt(f.field, f.value)
        break
      case 'lte':
        q = q.lte(f.field, f.value)
        break
      case 'contains':
        q = q.ilike(f.field, `%${f.value}%`)
        break
    }
  }

  if (plan.sort) q = q.order(plan.sort.field, { ascending: plan.sort.direction === 'asc' })
  const scan = plan.aggregate ? MAX_SCAN : plan.limit
  q = q.limit(scan)

  const { data, error } = (await q) as {
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  const rows = data ?? []
  return { rows, capped: !!plan.aggregate && rows.length >= scan }
}

// Read-only Insights endpoint (JWT-verified, RLS-scoped to the caller).
// mode 'ask':      NL question -> Claude -> validated plan -> typed builder
//                  -> rows, plus a pure aggregate step when the plan aggregates.
// mode 'dashboard': no Claude — curated fetch -> pure buildDashboard payload.
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

    const body = (await req.json().catch(() => ({}))) as {
      mode?: string
      question?: string
      limit?: number
    }
    const mode = body.mode === 'dashboard' ? 'dashboard' : 'ask'

    // -------- Dashboard: deterministic, Claude-free --------
    if (mode === 'dashboard') {
      const nowMs = Date.now()
      const cutoff30 = new Date(nowMs - 30 * 86_400_000).toISOString()
      const [dealsRes, contactsRes, interRes] = await Promise.all([
        supabase.from('deals').select('stage,value').limit(MAX_SCAN),
        supabase.from('contacts').select('source,created_at').limit(MAX_SCAN),
        supabase.from('interactions').select('occurred_at').gte('occurred_at', cutoff30).limit(MAX_SCAN),
      ])
      const firstErr = dealsRes.error || contactsRes.error || interRes.error
      if (firstErr) return json({ error: `Failed to load analytics: ${firstErr.message}` }, 500)

      const deals = (dealsRes.data ?? []) as Record<string, unknown>[]
      const contacts = (contactsRes.data ?? []) as Record<string, unknown>[]
      const interactions = (interRes.data ?? []) as Record<string, unknown>[]

      const dash = buildDashboard(deals, contacts, interactions, nowMs)
      if (deals.length >= MAX_SCAN || contacts.length >= MAX_SCAN || interactions.length >= MAX_SCAN) {
        dash.capped = true
      }
      return json(dash, 200)
    }

    // -------- Ask: NL -> validated plan -> execute --------
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ error: 'AI unavailable: ANTHROPIC_API_KEY is not configured.' }, 503)
    }
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) return json({ error: 'A question is required.' }, 400)

    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: INSIGHT_SYSTEM,
      tools: [
        {
          name: 'emit_insight_plan',
          description: 'Emit the structured, whitelisted query plan for the question.',
          input_schema: INSIGHT_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_insight_plan' },
      messages: [{ role: 'user', content: buildInsightMessage(question) }],
    })

    const toolBlock = msg.content.find((b) => b.type === 'tool_use')
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return json(
        { error: "Couldn't interpret that as a contacts, deals, interactions, or appointments question." },
        422,
      )
    }
    const validated = validateInsightPlan(toolBlock.input)
    if ('error' in validated) return json({ error: validated.error }, 422)
    const plan = validated.plan
    if (typeof body.limit === 'number' && Number.isFinite(body.limit)) {
      plan.limit = Math.min(MAX_LIMIT, Math.max(1, Math.round(body.limit)))
    }

    const { rows, capped } = await executePlan(supabase, plan)

    if (plan.aggregate) {
      return json(
        { question, plan, count: rows.length, aggregate: aggregateRows(rows, plan.aggregate), capped },
        200,
      )
    }
    return json({ question, plan, count: rows.length, results: rows.slice(0, plan.limit) }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
