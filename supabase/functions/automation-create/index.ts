import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'
import {
  buildRuleMessage,
  RULE_SYSTEM,
  RULE_TOOL_SCHEMA,
  ruleToAutomationRow,
  validateRule,
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

// Turn a plain-English request into ONE validated, whitelisted automation rule
// (crm_query discipline) and store it. Never emits or runs free-form logic.
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

    const body = (await req.json().catch(() => ({}))) as { instructions?: string; name?: string }
    if (!body.instructions || typeof body.instructions !== 'string') {
      return json({ error: 'instructions are required.' }, 400)
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey })
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 512,
      thinking: { type: 'disabled' },
      system: RULE_SYSTEM,
      tools: [
        {
          name: 'emit_automation_rule',
          description: 'Emit the structured automation rule for the request.',
          input_schema: RULE_TOOL_SCHEMA as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_automation_rule' },
      messages: [{ role: 'user', content: buildRuleMessage(body.instructions) }],
    })

    const toolBlock = msg.content.find((b) => b.type === 'tool_use')
    const rule = toolBlock && toolBlock.type === 'tool_use' ? validateRule(toolBlock.input) : null
    if (!rule) {
      return json(
        {
          error:
            "Couldn't turn that into a supported automation. v1 supports a missed-lead follow-up (e.g. \"follow up with leads we haven't contacted in a day\").",
        },
        422,
      )
    }
    if (typeof body.name === 'string' && body.name.trim()) rule.name = body.name.trim()

    const { data: created, error: insErr } = await supabase
      .from('automations')
      .insert(ruleToAutomationRow(rule, body.instructions))
      .select('id')
      .single()
    if (insErr) return json({ error: `Failed to save automation: ${insErr.message}` }, 500)

    return json({ automationId: created.id, rule }, 200)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
