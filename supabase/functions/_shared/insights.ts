// Insights core (Phase 6) — dependency-free TS so it runs unchanged in the Deno
// edge runtime AND in a node/tsx unit test. The Claude call lives in the edge
// function (it needs the Anthropic client); this module is the pure,
// deterministic query-plan validation + aggregation + dashboard logic, plus the
// prompt/schema.
//
// This REUSES the crm_query discipline (apps/mcp-server/src/lib/queryPlan.ts):
// a natural-language question becomes a whitelisted, validated plan (never SQL),
// executed by a typed builder. The one capability beyond crm_query is
// aggregation, done as a pure reduction over already-safe, RLS-scoped rows.
//
// Shapes mirror packages/shared-types/src/insights.ts (kept in sync by hand —
// the edge runtime can't import the workspace package).

export const INSIGHT_ENTITIES = ['deals', 'contacts', 'interactions', 'appointments'] as const
export type InsightEntity = (typeof INSIGHT_ENTITIES)[number]

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] as const
export type FilterOp = (typeof FILTER_OPS)[number]

export const AGG_OPS = ['count', 'sum', 'avg', 'min', 'max'] as const
export type AggOp = (typeof AGG_OPS)[number]

export type FilterValue = string | number | boolean

export interface InsightFilter {
  field: string
  op: FilterOp
  value: FilterValue
}
export interface InsightAggregate {
  op: AggOp
  field?: string
  groupBy?: string
}
export interface InsightSort {
  field: string
  direction: 'asc' | 'desc'
}
export interface InsightPlan {
  entity: InsightEntity
  filters: InsightFilter[]
  aggregate: InsightAggregate | null
  sort: InsightSort | null
  limit: number
}
export interface AggregateGroup {
  key: string
  value: number
}
export interface AggregateResult {
  op: AggOp
  field?: string
  groupBy?: string
  groups: AggregateGroup[]
  scalar: number | null
}
export interface StageValue {
  stage: string
  value: number
}
export interface StageCount {
  stage: string
  count: number
}
export interface SourceCount {
  source: string
  count: number
}
export interface MonthCount {
  month: string
  count: number
}
export interface WinRate {
  won: number
  lost: number
  rate: number
}
export interface DashboardResult {
  pipelineByStage: StageValue[]
  dealsByStage: StageCount[]
  openPipelineValue: number
  wonValue: number
  winRate: WinRate
  contactsBySource: SourceCount[]
  interactionsLast30d: number
  monthlyNewContacts: MonthCount[]
  generatedAt: string
  capped?: boolean
}

// ---------------------------------------------------------------------------
// Whitelist: the analytics read model. Only these fields are ever referenced,
// and only deals.value / deals.probability are numeric (aggregatable by
// sum/avg/min/max). Everything else is count-only. This is the injection guard,
// exactly as crm_query's field whitelist is.
// ---------------------------------------------------------------------------
export const ENTITY_FIELDS: Record<InsightEntity, readonly string[]> = {
  deals: ['title', 'stage', 'value', 'probability', 'created_at'],
  contacts: ['name', 'company', 'email', 'phone', 'source', 'tags', 'created_at'],
  interactions: ['type', 'occurred_at'],
  appointments: ['status', 'start_time', 'end_time', 'source'],
}
export const ENTITY_NUMERIC: Record<InsightEntity, readonly string[]> = {
  deals: ['value', 'probability'],
  contacts: [],
  interactions: [],
  appointments: [],
}

export const MAX_SCAN = 5000
export const DEFAULT_LIMIT = 25
export const MAX_LIMIT = 100
export const MAX_FILTERS = 10

/** Stage display order for the dashboard (funnel, closed states last). */
export const FUNNEL_ORDER = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const

// ---------------------------------------------------------------------------
// Prompt + tool schema for the NL query bar (mirrors crm_query's SYSTEM +
// QUERY_PLAN_JSON_SCHEMA, extended with the aggregate block + two more entities).
// ---------------------------------------------------------------------------
export const INSIGHT_SYSTEM = `You translate a natural-language CRM question into a structured query plan by calling the emit_insight_plan tool. Never write SQL.

Pick exactly ONE entity and use only its fields:
- deals: title, stage, value, probability, created_at
- contacts: name, company, email, phone, source, tags, created_at
- interactions: type, occurred_at
- appointments: status, start_time, end_time, source

deals.stage is one of: lead, qualified, proposal, negotiation, won, lost.
deals.value is a plain number in AUD; probability is 0-100.
interactions.type is one of: call, email, note, sms.
appointments.status is one of: requested, scheduled, completed, cancelled, no_show.

Operators: eq, neq, gt, gte, lt, lte, contains. "contains" is a case-insensitive substring match for text fields; for contacts.tags it checks list membership. Date/time fields (created_at, occurred_at, start_time, end_time) are ISO strings — filter them with gte/lte. Add filters to narrow the question; use sort + limit for "top N" or ordering questions.

To ANSWER A NUMBER instead of listing rows, set "aggregate":
- {"op":"count"} counts matching rows. Add "groupBy":"<field>" for a breakdown (e.g. deals grouped by stage, contacts grouped by source).
- {"op":"sum"|"avg"|"min"|"max","field":"<numeric field>"} aggregates a number. Only deals.value and deals.probability are numeric. Add "groupBy" for a per-group breakdown.
Omit "aggregate" entirely to list the matching rows.`

export const INSIGHT_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    entity: { type: 'string', enum: [...INSIGHT_ENTITIES] },
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
    aggregate: {
      type: ['object', 'null'],
      properties: {
        op: { type: 'string', enum: [...AGG_OPS] },
        field: { type: 'string', description: 'numeric field; required for sum/avg/min/max' },
        groupBy: { type: 'string', description: 'optional single field to break the result down by' },
      },
      required: ['op'],
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

export function buildInsightMessage(question: string): string {
  return `${question}\n\nCall emit_insight_plan.`
}

// ---------------------------------------------------------------------------
// validateInsightPlan — the guardrail. Like crm_query's validateFields, but it
// also validates the aggregate block. Returns a normalized plan OR an error
// string (surfaced to the caller as a 422 — never a leaked/broken query).
// ---------------------------------------------------------------------------
export function validateInsightPlan(obj: unknown): { plan: InsightPlan } | { error: string } {
  if (!obj || typeof obj !== 'object') return { error: 'Empty query plan.' }
  const o = obj as Record<string, unknown>

  const entity = o.entity
  if (typeof entity !== 'string' || !(INSIGHT_ENTITIES as readonly string[]).includes(entity)) {
    return { error: `Unknown entity '${String(entity)}'. Choose one of: ${INSIGHT_ENTITIES.join(', ')}.` }
  }
  const e = entity as InsightEntity
  const allowed = ENTITY_FIELDS[e]
  const numeric = ENTITY_NUMERIC[e]

  // Filters
  const rawFilters = Array.isArray(o.filters) ? o.filters : []
  if (rawFilters.length > MAX_FILTERS) return { error: `Too many filters (max ${MAX_FILTERS}).` }
  const filters: InsightFilter[] = []
  for (const rf of rawFilters) {
    if (!rf || typeof rf !== 'object') return { error: 'Malformed filter.' }
    const f = rf as Record<string, unknown>
    if (typeof f.field !== 'string' || !allowed.includes(f.field)) {
      return { error: `Unknown field '${String(f.field)}' for ${e}.` }
    }
    if (typeof f.op !== 'string' || !(FILTER_OPS as readonly string[]).includes(f.op)) {
      return { error: `Unknown operator '${String(f.op)}'.` }
    }
    const v = f.value
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') {
      return { error: `Filter on '${f.field}' needs a string, number, or boolean value.` }
    }
    filters.push({ field: f.field, op: f.op as FilterOp, value: v })
  }

  // Aggregate (optional)
  let aggregate: InsightAggregate | null = null
  if (o.aggregate != null) {
    if (typeof o.aggregate !== 'object') return { error: 'Malformed aggregate.' }
    const a = o.aggregate as Record<string, unknown>
    if (typeof a.op !== 'string' || !(AGG_OPS as readonly string[]).includes(a.op)) {
      return { error: `Unknown aggregate op '${String(a.op)}'.` }
    }
    const op = a.op as AggOp
    const agg: InsightAggregate = { op }
    if (op !== 'count') {
      if (typeof a.field !== 'string' || !numeric.includes(a.field)) {
        const avail = numeric.length ? numeric.join(', ') : 'none available'
        return { error: `'${op}' needs a numeric field for ${e} (${avail}).` }
      }
      agg.field = a.field
    } else if (typeof a.field === 'string' && allowed.includes(a.field)) {
      // count ignores the field, but keep it if it is a valid field (harmless).
      agg.field = a.field
    }
    if (a.groupBy != null) {
      if (typeof a.groupBy !== 'string' || !allowed.includes(a.groupBy) || a.groupBy === 'tags') {
        return { error: `Can't group ${e} by '${String(a.groupBy)}'.` }
      }
      agg.groupBy = a.groupBy
    }
    aggregate = agg
  }

  // Sort (optional)
  let sort: InsightSort | null = null
  if (o.sort != null) {
    if (typeof o.sort !== 'object') return { error: 'Malformed sort.' }
    const s = o.sort as Record<string, unknown>
    if (typeof s.field !== 'string' || !allowed.includes(s.field)) {
      return { error: `Unknown sort field '${String(s.field)}' for ${e}.` }
    }
    sort = { field: s.field, direction: s.direction === 'asc' ? 'asc' : 'desc' }
  }

  // Limit
  const rawLimit = typeof o.limit === 'number' ? o.limit : Number(o.limit)
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.round(rawLimit)))
    : DEFAULT_LIMIT

  return { plan: { entity: e, filters, aggregate, sort, limit } }
}

// ---------------------------------------------------------------------------
// aggregateRows — pure reduction over already-fetched, RLS-scoped rows. No SQL,
// no PostgREST aggregate dependency. This is the one net-new primitive over
// crm_query (which returns rows only).
// ---------------------------------------------------------------------------
export function aggregateRows(
  rows: Record<string, unknown>[],
  aggregate: InsightAggregate,
): AggregateResult {
  const { op, field, groupBy } = aggregate

  const reduce = (subset: Record<string, unknown>[]): number => {
    if (op === 'count') return subset.length
    const nums: number[] = []
    for (const r of subset) {
      const raw = r[field as string]
      // Skip NULL/empty like SQL aggregates do — Number(null) is 0, which would
      // wrongly pull down avg/min, so exclude it rather than coerce.
      if (raw === null || raw === undefined || raw === '') continue
      const n = Number(raw)
      if (Number.isFinite(n)) nums.push(n)
    }
    if (nums.length === 0) return 0
    switch (op) {
      case 'sum':
        return nums.reduce((a, b) => a + b, 0)
      case 'avg':
        return nums.reduce((a, b) => a + b, 0) / nums.length
      case 'min':
        return nums.reduce((a, b) => (b < a ? b : a), nums[0])
      case 'max':
        return nums.reduce((a, b) => (b > a ? b : a), nums[0])
      default:
        return 0
    }
  }

  const result: AggregateResult = { op, groups: [], scalar: null }
  if (field !== undefined) result.field = field
  if (groupBy !== undefined) result.groupBy = groupBy

  if (!groupBy) {
    result.scalar = reduce(rows)
    return result
  }

  const buckets = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const raw = r[groupBy]
    const key = raw == null || raw === '' ? '—' : String(raw)
    const arr = buckets.get(key)
    if (arr) arr.push(r)
    else buckets.set(key, [r])
  }
  result.groups = [...buckets.entries()]
    .map(([key, subset]) => ({ key, value: reduce(subset) }))
    .sort((a, b) => b.value - a.value)
  return result
}

// ---------------------------------------------------------------------------
// buildDashboard — the deterministic (Claude-free) analytics payload, built
// entirely from aggregateRows over rows the edge function has already fetched
// (RLS-scoped). Pure + tsx-testable: `nowMs` is injected.
// ---------------------------------------------------------------------------
function orderStages(groups: AggregateGroup[]): AggregateGroup[] {
  const rank = (k: string): number => {
    const i = (FUNNEL_ORDER as readonly string[]).indexOf(k)
    return i === -1 ? FUNNEL_ORDER.length : i
  }
  return [...groups].sort((a, b) => rank(a.key) - rank(b.key))
}

function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
}

function bucketByMonth(
  rows: Record<string, unknown>[],
  field: string,
  nowMs: number,
  months: number,
): MonthCount[] {
  const now = new Date(nowMs)
  const buckets: MonthCount[] = []
  const index = new Map<string, number>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d.getFullYear(), d.getMonth())
    index.set(key, buckets.length)
    buckets.push({ month: key, count: 0 })
  }
  for (const r of rows) {
    const t = Date.parse(String(r[field]))
    if (!Number.isFinite(t)) continue
    const d = new Date(t)
    const key = monthKey(d.getFullYear(), d.getMonth())
    const idx = index.get(key)
    if (idx !== undefined) buckets[idx].count++
  }
  return buckets
}

export function buildDashboard(
  deals: Record<string, unknown>[],
  contacts: Record<string, unknown>[],
  interactions: Record<string, unknown>[],
  nowMs: number,
): DashboardResult {
  const pipelineByStage = orderStages(
    aggregateRows(deals, { op: 'sum', field: 'value', groupBy: 'stage' }).groups,
  ).map((g) => ({ stage: g.key, value: g.value }))

  const dealsByStage = orderStages(
    aggregateRows(deals, { op: 'count', groupBy: 'stage' }).groups,
  ).map((g) => ({ stage: g.key, count: g.value }))

  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const openPipelineValue = aggregateRows(open, { op: 'sum', field: 'value' }).scalar ?? 0

  const won = deals.filter((d) => d.stage === 'won')
  const lost = deals.filter((d) => d.stage === 'lost')
  const wonValue = aggregateRows(won, { op: 'sum', field: 'value' }).scalar ?? 0
  const closed = won.length + lost.length
  const winRate: WinRate = {
    won: won.length,
    lost: lost.length,
    rate: closed ? won.length / closed : 0,
  }

  const contactsBySource = aggregateRows(contacts, { op: 'count', groupBy: 'source' }).groups.map(
    (g) => ({ source: g.key, count: g.value }),
  )

  const cutoff30 = nowMs - 30 * 86_400_000
  const interactionsLast30d = interactions.filter((i) => {
    const t = Date.parse(String(i.occurred_at))
    return Number.isFinite(t) && t >= cutoff30
  }).length

  const monthlyNewContacts = bucketByMonth(contacts, 'created_at', nowMs, 6)

  return {
    pipelineByStage,
    dealsByStage,
    openPipelineValue,
    wonValue,
    winRate,
    contactsBySource,
    interactionsLast30d,
    monthlyNewContacts,
    generatedAt: new Date(nowMs).toISOString(),
  }
}
