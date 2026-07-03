import { z } from 'zod'

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] as const
export const CONTACT_FIELDS = ['name', 'company', 'email', 'phone', 'source', 'tags'] as const
export const DEAL_FIELDS = ['title', 'stage', 'value', 'probability'] as const

export const QueryPlanSchema = z.object({
  entity: z.enum(['contacts', 'deals']),
  filters: z
    .array(
      z.object({
        field: z.string(),
        op: z.enum(FILTER_OPS),
        value: z.union([z.string(), z.number(), z.boolean()]),
      }),
    )
    .max(10)
    .default([]),
  sort: z
    .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
    .nullable()
    .default(null),
  limit: z.number().int().positive().max(100).default(25),
})

export type QueryPlan = z.infer<typeof QueryPlanSchema>

/** JSON Schema handed to Claude as the emit_query_plan tool input (kept in sync
 *  with QueryPlanSchema). */
export const QUERY_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entity: { type: 'string', enum: ['contacts', 'deals'] },
    filters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          op: { type: 'string', enum: [...FILTER_OPS] },
          value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
        },
        required: ['field', 'op', 'value'],
      },
    },
    sort: {
      type: ['object', 'null'],
      properties: {
        field: { type: 'string' },
        direction: { type: 'string', enum: ['asc', 'desc'] },
      },
    },
    limit: { type: 'integer' },
  },
  required: ['entity'],
} as const

/** Guardrail: reject fields that don't belong to the chosen entity. */
export function validateFields(plan: QueryPlan): string | null {
  const allowed: readonly string[] = plan.entity === 'contacts' ? CONTACT_FIELDS : DEAL_FIELDS
  for (const f of plan.filters) {
    if (!allowed.includes(f.field)) return `Unknown field '${f.field}' for ${plan.entity}.`
  }
  if (plan.sort && !allowed.includes(plan.sort.field)) {
    return `Unknown sort field '${plan.sort.field}' for ${plan.entity}.`
  }
  return null
}
