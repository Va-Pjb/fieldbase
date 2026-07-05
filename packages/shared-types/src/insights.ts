/**
 * Insights types (Phase 6). Shared by the web UI (and available to the MCP
 * server). The Supabase edge function holds the equivalent ENGINE (validate +
 * aggregate + dashboard) in supabase/functions/_shared/insights.ts, kept in
 * sync BY HAND — the Deno edge runtime can't import this workspace package.
 *
 * The natural-language query bar reuses the crm_query discipline (Phase 2): a
 * question becomes a whitelisted, validated PLAN (never SQL), executed by a
 * typed builder. The one capability beyond crm_query is aggregation
 * (count / sum / avg / min / max, optionally grouped by one field).
 */

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
  /** Required for sum/avg/min/max (a numeric field); omitted for count. */
  field?: string
  /** Optional single group-by field. */
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

/** One bucket of an aggregate result. `key` is the group value (or 'all' when ungrouped). */
export interface AggregateGroup {
  key: string
  value: number
}

export interface AggregateResult {
  op: AggOp
  field?: string
  groupBy?: string
  /** One entry per group; empty when there is no groupBy. */
  groups: AggregateGroup[]
  /** The single value when there is no groupBy; null when grouped. */
  scalar: number | null
}

export interface InsightAskResult {
  question: string
  plan: InsightPlan
  count: number
  /** Present for row queries (no aggregate); capped to plan.limit. */
  results?: Record<string, unknown>[]
  /** Present when the plan aggregates. */
  aggregate?: AggregateResult
  /** True when a fetch hit MAX_SCAN and figures may undercount. */
  capped?: boolean
}

// ---------------------------------------------------------------------------
// Dashboard — the deterministic (Claude-free) analytics payload.
// ---------------------------------------------------------------------------
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
  /** 'YYYY-MM'. */
  month: string
  count: number
}
export interface WinRate {
  won: number
  lost: number
  /** won / (won + lost); 0 when there are no closed deals. */
  rate: number
}

export interface DashboardResult {
  /** Sum of deal value per stage, in funnel order (lead → … → won → lost). */
  pipelineByStage: StageValue[]
  /** Deal count per stage, in funnel order. */
  dealsByStage: StageCount[]
  /** Sum of value for deals not yet won/lost. */
  openPipelineValue: number
  /** Sum of value for won deals. */
  wonValue: number
  winRate: WinRate
  contactsBySource: SourceCount[]
  interactionsLast30d: number
  /** New-contact count for each of the last 6 calendar months (oldest first). */
  monthlyNewContacts: MonthCount[]
  /** ISO timestamp the payload was built. */
  generatedAt: string
  /** True when any source fetch hit MAX_SCAN and figures may undercount. */
  capped?: boolean
}
