import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getAnthropic, isAnthropicConfigured, MODEL } from '../lib/anthropic.js'
import { getSupabase } from '../lib/supabase.js'
import {
  QUERY_PLAN_JSON_SCHEMA,
  QueryPlanSchema,
  validateFields,
  type QueryPlan,
} from '../lib/queryPlan.js'
import { fail, msg, ok } from './result.js'

const SYSTEM = `You translate a natural-language CRM question into a structured query plan by calling the emit_query_plan tool. Never write SQL.

Entities and their fields:
- contacts: name, company, email, phone, source, tags
- deals: title, stage, value, probability

deals.stage is one of: lead, qualified, proposal, negotiation, won, lost.
Money (deals.value) is a plain number in AUD. Probability is 0-100.

Operators: eq, neq, gt, gte, lt, lte, contains. "contains" is a case-insensitive
substring match for text fields; for contacts.tags it checks list membership.

Pick exactly one entity. Add filters to narrow the question. Use sort + limit when
the question implies ordering or a top-N. Only use the fields listed for the chosen
entity.`

async function translate(question: string): Promise<QueryPlan | null> {
  const res = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' },
    system: SYSTEM,
    tools: [
      {
        name: 'emit_query_plan',
        description: 'Emit the structured query plan for the question.',
        input_schema: QUERY_PLAN_JSON_SCHEMA as never,
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_query_plan' },
    messages: [{ role: 'user', content: question }],
  })

  const block = res.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') return null
  const parsed = QueryPlanSchema.safeParse(block.input)
  if (!parsed.success) return null
  if (validateFields(parsed.data)) return null
  return parsed.data
}

async function execute(plan: QueryPlan): Promise<unknown[]> {
  // Typed table + whitelisted fields/ops + parameterized values = injection-safe.
  // The builder is `any` here only because the columns are dynamic (already
  // validated against the entity's field whitelist above).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = getSupabase().from(plan.entity).select('*')

  for (const f of plan.filters) {
    if (f.field === 'tags' && f.op === 'contains') {
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
  q = q.limit(plan.limit)

  const { data, error } = (await q) as { data: unknown[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data ?? []
}

export function registerQueryTool(server: McpServer) {
  server.registerTool(
    'crm_query',
    {
      title: 'Natural-language CRM query',
      description:
        'Answer a natural-language question about contacts or deals. Translates the question into a safe, structured query (never raw SQL) and returns matching rows plus the interpreted plan.',
      inputSchema: {
        question: z
          .string()
          .min(1)
          .describe('e.g. "won deals over $3000" or "contacts tagged clinic".'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ question }) => {
      if (!isAnthropicConfigured()) {
        return fail('crm_query is unavailable: ANTHROPIC_API_KEY is not configured on the server.')
      }
      try {
        const plan = await translate(question)
        if (!plan) {
          return fail(`Couldn't interpret "${question}" as a contacts or deals query.`)
        }
        const results = await execute(plan)
        return ok({ question, plan, count: results.length, results })
      } catch (e) {
        return fail(`crm_query failed: ${msg(e)}`)
      }
    },
  )
}
