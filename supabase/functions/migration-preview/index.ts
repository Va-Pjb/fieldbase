import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  applyPlan,
  buildPlanUserMessage,
  parseCsv,
  PLAN_SYSTEM,
  PLAN_TOOL_SCHEMA,
  validatePlan,
} from '../_shared/migration.ts'

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
      filename?: string
      csv?: string
      instructions?: string
    }
    if (!body.csv || typeof body.csv !== 'string') return json({ error: 'csv is required.' }, 400)

    const { headers, rows } = parseCsv(body.csv)
    if (headers.length === 0 || rows.length === 0) {
      return json({ error: 'CSV has no header + data rows.' }, 400)
    }

    // Claude translates headers + sample rows + instructions into a mapping plan.
    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: PLAN_SYSTEM,
      tools: [
        {
          name: 'emit_migration_plan',
          description: 'Emit the CSV → contacts mapping plan.',
          input_schema: PLAN_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_migration_plan' },
      messages: [
        { role: 'user', content: buildPlanUserMessage(headers, rows, body.instructions ?? '') },
      ],
    })

    const toolBlock = msg.content.find((b) => b.type === 'tool_use')
    const plan = toolBlock && toolBlock.type === 'tool_use' ? validatePlan(toolBlock.input, rows.length) : null
    if (!plan) return json({ error: 'Could not produce a valid mapping plan for that CSV.' }, 422)

    const sample = applyPlan(plan, rows.slice(0, 5)).contacts

    // Persist the job in 'previewed' state with the plan AND the parsed rows,
    // so migration-execute can run from the job id alone.
    const { data: job, error: insErr } = await supabase
      .from('migration_jobs')
      .insert({
        status: 'previewed',
        source_filename: body.filename ?? null,
        mapping_plan: plan,
        source_rows: rows,
      })
      .select('id')
      .single()
    if (insErr) return json({ error: `Failed to save job: ${insErr.message}` }, 500)

    return json({ jobId: job.id, plan, sample }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
