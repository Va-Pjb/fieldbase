# Plan: FieldBase Phase 6 — Insights

Date: 2026-07-03
Depends on: Phase 0 (schema for `contacts`/`deals`/`interactions`/`appointments`,
auth, design tokens), Phase 1 (React-Query patterns, `queryKeys`, the seeded
sample data + Settings reset), Phase 2 (**`crm_query`: the NL → validated-plan →
typed-builder, read-only, never-raw-SQL discipline** — the thing this phase reuses),
Phase 3/4/5 (the edge-function conventions: `_shared/*.ts` dependency-free core,
`Deno.serve` + CORS + `json()` + RLS-via-caller-JWT + forced-tool Claude call).
Scope from roadmap item 6: **natural-language query bar + analytics dashboard.**

## Goal
Two demoable Insights surfaces, both read-only, both built on the **same one**
query engine:
1. **Analytics dashboard** — the `Dashboard` route (today a placeholder) becomes a
   real overview: pipeline value by stage (the signature chart), deals by stage,
   open pipeline value, win rate, contacts by source, recent-activity volume, and a
   new-contacts trend. Deterministic — **no Claude, no raw SQL** — a fixed set of
   curated query-plans run through the shared executor.
2. **Natural-language query bar** — an ask box on the Dashboard where the owner types
   a question (*"won deals over $3000"*, *"total won revenue"*, *"how many contacts
   per source"*). It reuses `crm_query`'s discipline exactly — Claude emits a
   **validated, whitelisted plan** (never SQL), the same typed builder fetches
   RLS-scoped rows, and an aggregate step answers count/sum/avg questions. The
   interpreted plan is shown back for transparency, mirroring `crm_query`'s result.

**Reuse, don't reinvent (user instruction + CLAUDE.md):** the query bar does **not**
invent a new query mechanism. It extends `crm_query`'s exact shape — Claude forced
into an `emit_*_plan` tool, the emitted object parsed and **field-whitelisted against
the chosen entity**, then executed by a typed Supabase query builder with
parameterized values. The one net-new capability over `crm_query` is **aggregation**
(count / sum / avg / min / max + optional single group-by), which `crm_query` can't
express (it returns rows only). Aggregation is done as a **pure TS reduction over the
already-safe, RLS-scoped, capped rows** — so it adds zero new SQL surface and depends
on no PostgREST aggregate setting.

## The reuse spine (what maps to what)
| `crm_query` (Phase 2, MCP, `apps/mcp-server`) | Phase 6 (web, edge + `_shared`) |
|---|---|
| `QueryPlanSchema` (zod) + `QUERY_PLAN_JSON_SCHEMA` | `InsightPlan` type + `INSIGHT_TOOL_SCHEMA` (hand-rolled, edge-style — no zod, like `_shared/automation.ts`) |
| `validateFields(plan)` field whitelist | `validateInsightPlan(obj)` — same whitelist idea, extended to validate the aggregate block |
| `execute(plan)` typed builder (eq/neq/gt/…/contains, sort, limit) | `executeInsightPlan` — the **same** builder, ported to Deno, over 4 read-model entities |
| returns `{ question, plan, count, results }` | `ask` returns the same shape, plus `aggregate` when the plan aggregates |
| entities: `contacts`, `deals` | entities: `deals`, `contacts`, `interactions`, `appointments` (analytics read model) |
| — (no aggregation) | `aggregateRows(rows, aggregate)` — the one new primitive; also powers the dashboard |

`crm_query` itself is **left untouched** (see decision #1). Phase 6 is web + edge only,
exactly as the Phase 5 booking widget was web-only and outside the locked MCP tool list.

## Already in place
- **`crm_query`** (`apps/mcp-server/src/tools/query.ts` + `lib/queryPlan.ts`): the
  discipline this phase mirrors — `QueryPlanSchema`, `QUERY_PLAN_JSON_SCHEMA`,
  `validateFields`, and the injection-safe typed builder (typed table + whitelisted
  fields/ops + parameterized values; `.ilike('%v%')` for `contains`; `.contains('tags',
  [v])` for the tags array; `.order` + `.limit(<=100)`). Read-only, `openWorldHint:false`.
- **Edge conventions** (P4 `automation-create/index.ts`, which comments *"(crm_query
  discipline)"*): `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {global:{headers:
  {Authorization: authHeader}}})` for RLS-as-caller; `supabase.auth.getUser()` gate
  (401 without a JWT); `Anthropic` from `npm:@anthropic-ai/sdk`, `model:'claude-sonnet-5'`,
  `thinking:{type:'disabled'}`, `tool_choice:{type:'tool',name:...}`; the shared `CORS`
  block + `json(obj,status)` helper; `ANTHROPIC_API_KEY` as a function secret (503 if
  missing); pure logic in `_shared/*.ts` (dependency-free, `tsx`-verifiable — see
  `_shared/automation.ts`: `validateRule`, `selectColdLeads`, `*_SYSTEM`, `*_TOOL_SCHEMA`,
  `build*Message`).
- **Web conventions**: `lib/api/*.ts` with `edgeError(error, fallback)` unwrap +
  `supabase.functions.invoke(name,{body})` (`api/automations.ts:13`); plain reads via
  `supabase.from().select()`; centralized `queryKeys.ts`; TanStack Query hooks;
  `lucide-react` icons; locked tokens (`ink`/`paper`/`brand`/`signal`, Archivo / Public
  Sans / JetBrains Mono, `.ticket`, `.u-marker`, `.field-grid`); seed/reset in
  `lib/sampleData.ts` + `routes/Settings.tsx`; React Router v7 routes in `App.tsx`, nav
  in `AppShell.tsx` `NAV`.
- **`routes/Dashboard.tsx`** is a `Placeholder` whose copy already says *"This becomes
  the home screen in a later phase."* — Phase 6 is that phase. It is already routed and
  in `NAV`, so no new route/nav entry is needed for the dashboard.
- **Data model is sufficient — no migration required.** The fields analytics needs all
  exist: `deals(stage, value, probability, created_at)` with stages
  `lead/qualified/proposal/negotiation/won/lost`; `contacts(source, tags, created_at)`;
  `interactions(type, occurred_at)`; `appointments(status, start_time, source)`
  (`source` added in P5). Everything is read-only over these.
- **Gaps to build:** no aggregation anywhere; no web NL query surface; no edge function
  the web can call for queries (crm_query is MCP/Node-only); no chart primitives (no
  chart library is installed — see decision #5); `Dashboard.tsx` renders nothing real.

## Open decisions — confirm before building (first = my recommendation)
1. **MCP surface:** **leave `crm_query` and the locked tool list unchanged; Phase 6 is
   web + edge only.** `crm_query` already gives MCP clients NL row-queries; the analytics
   dashboard is a web surface (mirrors the P5 widget being web-only). *Alternative (if you
   want the hero feature to also gain aggregation): add a task to extend `crm_query`/its
   `queryPlan.ts` onto the same aggregate plan, or add a `crm_insights` tool (→ 17 tools).*
   Recommend **defer** to protect the working P2 tool and the locked list; noted in
   Out-of-scope as the obvious follow-up.
2. **Aggregation mechanism:** **pure TS reduction over RLS-scoped, whitelisted-filtered,
   capped rows** (fetch via the existing typed builder, then `aggregateRows` in the edge
   fn). Injection-safe, deterministic, `tsx`-unit-testable, and independent of the
   PostgREST "aggregate functions in select" setting (which Supabase disables by default).
   *vs.* PostgREST aggregate select (`select('stage, value.sum()')`) — rejected: depends
   on a project-level setting and is harder to keep whitelist-safe. *vs.* SQL RPCs —
   rejected: new SQL surface, less reuse of the crm_query discipline.
3. **Insights entity set:** **`deals`, `contacts`, `interactions`, `appointments`** —
   the analytics read model. `crm_query` today whitelists only `contacts`+`deals`; adding
   `interactions`+`appointments` is a bounded widening that lets both the dashboard and the
   query bar answer activity/booking questions through one executor. Each entity gets its
   own field whitelist; only `deals.value`/`deals.probability` are numeric (sum/avg/min/max);
   everything else is count-only. *vs.* keep just contacts+deals (dashboard can't count
   interactions/appointments through the shared engine).
4. **Where the surfaces live:** **fill the existing `Dashboard` route** with the analytics
   cards and put the NL query bar at the top of it — no new nav entry (the placeholder
   already promises this). *vs.* a separate `/insights` route (extra nav item; the
   architecture "UI modules" list has Dashboard as home, not a separate Insights page).
5. **Charts:** **bespoke inline-SVG derived from the locked tokens** (bars/sparkline), no
   charting dependency. Matches the design rules ("don't produce generic AI-looking
   frontend"; "spend visual boldness in ONE signature place"). Build-time: use the
   `dataviz` + `frontend-design` skills. *vs.* add Recharts/Chart.js — rejected: templated
   look, heavier bundle, fights the token system.
6. **Saved queries / scheduled reports / CSV export:** **out of scope for Phase 6.** The
   query bar is ephemeral ask-and-answer. Revisit in a later phase if wanted.

---

## Tasks

### T1: Insights query core (`_shared/insights.ts` + shared-types) — plan, whitelist, aggregator, curated metrics
- WHY: one dependency-free module holding the reused `crm_query` discipline plus the one
  net-new primitive (aggregation) and the curated dashboard plan-set — imported by the
  edge function and `tsx`-verifiable in node (mirrors `_shared/automation.ts`).
- FILES: `supabase/functions/_shared/insights.ts`;
  `packages/shared-types/src/insights.ts` (+ export from `packages/shared-types/src/index.ts`).
  Types are hand-synced between the two (the edge runtime can't import the workspace
  package — same convention as `automation.ts` ↔ `_shared/automation.ts`).
- DEPENDENCIES: none (no schema change); decisions #2, #3
- WORK:
  - [ ] `INSIGHT_ENTITIES`: for each of `deals`/`contacts`/`interactions`/`appointments`,
    a `{ fields: readonly string[]; numeric: readonly string[] }` whitelist. `deals`:
    fields `title,stage,value,probability,created_at`, numeric `value,probability`.
    `contacts`: fields `name,company,email,phone,source,tags,created_at`, numeric `[]`.
    `interactions`: fields `type,occurred_at`, numeric `[]`. `appointments`: fields
    `status,start_time,end_time,source`, numeric `[]`.
  - [ ] `FILTER_OPS = ['eq','neq','gt','gte','lt','lte','contains']` and `AGG_OPS =
    ['count','sum','avg','min','max']` (copied from `crm_query`, plus the agg ops).
  - [ ] `InsightPlan` type: `{ entity: InsightEntity; filters: {field,op,value}[];
    aggregate: { op: AggOp; field?: string; groupBy?: string } | null; sort:
    {field,direction} | null; limit: number }`. Mirror it in `shared-types/src/insights.ts`
    together with `AggregateResult` (`{ op, field?, groupBy?, groups: {key,value}[];
    scalar: number | null }`), `InsightAskResult` (`{ question, plan, count, results?,
    aggregate?, capped?: boolean }`), and `DashboardResult` (see below; also carries
    `capped?: boolean`). `capped` is set by T2 when a fetch hits `MAX_SCAN`.
  - [ ] `INSIGHT_TOOL_SCHEMA` (JSON schema for a forced `emit_insight_plan` tool — same
    hand-written style as `RULE_TOOL_SCHEMA`) + `INSIGHT_SYSTEM` prompt: extends
    `crm_query`'s system text — lists the four entities and their fields, the operators,
    and the aggregate block ("omit `aggregate` to list rows; set it to count/sum/avg over
    the whole result, optionally grouped by one field; sum/avg/min/max require a numeric
    field"). Never write SQL; pick exactly one entity; only that entity's fields.
  - [ ] `validateInsightPlan(obj): { plan: InsightPlan } | { error: string }` — the
    guardrail (the crm_query `validateFields` idea, extended): entity ∈ `INSIGHT_ENTITIES`;
    every `filter.field`, `sort.field`, and `aggregate.groupBy` ∈ that entity's `fields`
    (reject `tags` as a `groupBy`); `aggregate.op` ∈ `AGG_OPS`; if op ∈
    `sum/avg/min/max` then `aggregate.field` must be in that entity's `numeric` set
    (else error); clamp `limit` to `1..100` (default 25 for rows, but aggregate plans
    fetch up to `MAX_SCAN = 5000`).
  - [ ] `aggregateRows(rows, aggregate): AggregateResult` — **pure**: `count` ignores
    field; `sum/avg/min/max` reduce over `Number(row[field])` skipping non-finite; with
    `groupBy`, bucket by `String(row[groupBy] ?? '—')` and emit one `{key,value}` per
    bucket sorted by value desc; without `groupBy`, emit `scalar`.
  - [ ] `buildDashboard(deals, contacts, interactions, nowMs): DashboardResult` —
    **pure**, built from `aggregateRows` calls: `pipelineByStage` (sum `value` group `stage`),
    `dealsByStage` (count group `stage`), `openPipelineValue` (sum `value` where stage
    ∉ {won,lost}), `wonValue` (sum `value` where stage=won), `winRate` (`{won,lost,rate}`
    from counts, `rate=won/(won+lost)` or 0), `contactsBySource` (count group `source`),
    `interactionsLast30d` (count `occurred_at >= nowMs-30d`), `monthlyNewContacts`
    (bucket `contacts.created_at` into the last 6 calendar months, `{month,count}[]`),
    `generatedAt`. `DashboardResult` types all of these.
  - [ ] `buildInsightMessage(question): string` (mirror of `buildRuleMessage`).
- TEST: `tsx` scratch (like the P3/P4 runs) — `validateInsightPlan` accepts a good
  deals-sum-by-stage plan, rejects an unknown field (`"Unknown field 'foo' for deals."`),
  rejects `sum` on a non-numeric field (`contacts.name`), rejects `tags` as `groupBy`;
  `aggregateRows` on a fixture returns correct grouped sums and a correct scalar avg;
  `buildDashboard` on a fixture of deals/contacts/interactions returns the expected
  `pipelineByStage` totals, `winRate`, and a 6-bucket `monthlyNewContacts`; every prompt
  builder returns a non-empty string. `packages/shared-types` typechecks.
- ROLLBACK: delete `_shared/insights.ts` + `shared-types/src/insights.ts` and revert the
  index export.

### T2: `insights-query` edge function (NL ask + deterministic dashboard, one executor)
- WHY: the single read-only endpoint the web calls — `mode:'ask'` runs the reused
  crm_query pipeline (Claude → validate → typed builder → optional aggregate);
  `mode:'dashboard'` runs the curated metrics with **no Claude**. Both share one builder.
- FILES: `supabase/functions/insights-query/index.ts` (JWT-verified — this is authed CRM
  data, unlike the P5 public widget; no `config.toml` change).
- DEPENDENCIES: T1
- WORK:
  - [ ] Standard header: OPTIONS→CORS; require `Authorization` (401); RLS-scoped
    `createClient(URL, ANON_KEY, {global headers Authorization})`; `auth.getUser()` gate.
    Accept `{ mode?: 'ask'|'dashboard', question?, limit? }` (default `mode:'ask'`).
  - [ ] `executeInsightPlan(supabase, plan)` — port `crm_query`'s `execute()` to Deno over
    `plan.entity`: apply each whitelisted filter (`eq/neq/gt/gte/lt/lte`; `contains` →
    `.ilike('field','%'+v+'%')`, except `tags` → `.contains('tags',[v])`); `.order` if
    `sort`; `.limit(plan.aggregate ? MAX_SCAN : plan.limit)`. Returns rows. (Same
    injection-safe shape as P2: typed table, whitelisted identifiers, parameterized values.)
  - [ ] `mode:'ask'`: require `ANTHROPIC_API_KEY` (503 if unset). One Claude call with the
    forced `emit_insight_plan` tool (`INSIGHT_SYSTEM`, `INSIGHT_TOOL_SCHEMA`,
    `buildInsightMessage(question)`). `validateInsightPlan` the tool input → **422** with
    the validator's error (or `"Couldn't interpret that as a contacts/deals/interactions/
    appointments question."` when no tool block). Run `executeInsightPlan`; if
    `plan.aggregate`, compute `aggregateRows` and return `{ question, plan, count,
    aggregate }`, else return `{ question, plan, count, results }` (cap `results` to
    `plan.limit`).
  - [ ] `mode:'dashboard'`: **no Claude.** Fetch `deals`, `contacts`, and last-90-day
    `interactions` (three RLS reads, each `.limit(MAX_SCAN)`), then
    `buildDashboard(deals, contacts, interactions, Date.now())` (server time is fine in the
    edge runtime) → return `DashboardResult`.
  - [ ] Generic 500 on unexpected errors; never leak internals (match automation-create).
- TEST: (via `execute_sql` to seed/verify against the isolated project)
  - `mode:'dashboard'` → `pipelineByStage[stage='won'].value` equals `SELECT sum(value)
    FROM deals WHERE stage='won'` for the caller; `winRate.won/lost` match row counts.
  - `mode:'ask'` `"total value of won deals"` → `aggregate.scalar` equals the same sum;
    `"how many contacts per source"` → `aggregate.groups` matches `SELECT source,count(*)
    ... GROUP BY source`; `"deals over $3000"` → `results` are the matching rows + the
    interpreted `plan`.
  - Guardrail: a crafted question that would need a non-whitelisted field returns **422**,
    not a leaked/errored query; RLS holds (a second user's rows are never counted).
- ROLLBACK: delete the function (read-only; no writes to roll back).

### T3: Web insights data layer + hooks
- WHY: the typed client surface for both Dashboard and the query bar, consistent with the
  `api/*.ts` + `edgeError` + `queryKeys` conventions.
- FILES: `apps/web/src/lib/api/insights.ts`, `apps/web/src/lib/queryKeys.ts` (add an
  `insights` key group), `apps/web/src/hooks/useDashboard.ts`,
  `apps/web/src/hooks/useInsightQuery.ts`.
- DEPENDENCIES: T2, T1 (imports `DashboardResult`/`InsightAskResult` from shared-types)
- WORK:
  - [ ] `api/insights.ts`: `getDashboard(): Promise<DashboardResult>` →
    `supabase.functions.invoke('insights-query',{body:{mode:'dashboard'}})` with the
    `edgeError` unwrap; `askInsight(question: string): Promise<InsightAskResult>` →
    `invoke('insights-query',{body:{mode:'ask',question}})`.
  - [ ] `queryKeys.insights = { dashboard: () => ['insights','dashboard'] as const,
    query: (q: string) => ['insights','query', q] as const }`.
  - [ ] `useDashboard()` = `useQuery({ queryKey: queryKeys.insights.dashboard(), queryFn:
    getDashboard })`. `useInsightQuery()` = a `useMutation({ mutationFn: askInsight })`
    (ask is user-triggered, not a standing query).
- TEST: `apps/web` typechecks; a temporary component (or the T4/T5 wiring) calls
  `useDashboard()` and receives a typed `DashboardResult` without `any`.
- ROLLBACK: delete `api/insights.ts` + the two hooks; revert the `queryKeys` addition.

### T4: Web — analytics dashboard (fill the `Dashboard` route)
- WHY: the phase's most-visible surface; turns the placeholder into the real home screen.
- FILES: `apps/web/src/routes/Dashboard.tsx` (replace the placeholder),
  `apps/web/src/components/insights/{StatTile,PipelineByStage,SourceBreakdown,TrendSparkline}.tsx`.
- DEPENDENCIES: T3. **Build-time: invoke the `dataviz` and `frontend-design` skills before
  writing chart code** (per CLAUDE.md design rules).
- WORK:
  - [ ] `Dashboard.tsx`: `useDashboard()`; loading skeleton + a quiet empty state when all
    metrics are zero (fresh/reset account); an error state using the `edgeError` message.
  - [ ] A `.field-grid` of `StatTile`s (open pipeline value, won value, win rate,
    interactions last 30d) — quiet, mono figures, JetBrains Mono, derived from tokens.
  - [ ] `PipelineByStage` — the **one signature visual** (the `.u-marker` moment): a
    bespoke inline-SVG horizontal bar of `pipelineByStage`, stages in funnel order
    (`lead→…→won`), value labels; `signal` accent only on the leading bar, `ink`/`paper`
    elsewhere. No chart library. `SourceBreakdown` (contacts by source) and
    `TrendSparkline` (`monthlyNewContacts`) are small, quiet SVGs from the same tokens.
  - [ ] Quality floor: responsive (grid collapses to one column on mobile; the bar chart
    scrolls or reflows, never overflows), visible keyboard focus on any interactive
    element, `prefers-reduced-motion` respected (no entrance animation when set).
- TEST: with seeded sample data the dashboard renders real figures — the pipeline bar’s
  `won` segment matches the seeded won total; tiles show non-zero values; after a Settings
  data reset the empty state shows (no crash, no `NaN`); mobile viewport shows a single
  readable column; tabbing reveals focus rings; reduced-motion disables animation.
- ROLLBACK: restore the `Placeholder` `Dashboard.tsx`; delete the `insights/` components.

### T5: Web — natural-language query bar (on the Dashboard)
- WHY: the AI-native moment of the phase — ask the CRM a question in English, see the
  interpreted plan + the answer. The visible reuse of the `crm_query` discipline.
- FILES: `apps/web/src/components/insights/{QueryBar,QueryResult,PlanChips}.tsx`, wired
  into `apps/web/src/routes/Dashboard.tsx` (above the analytics cards).
- DEPENDENCIES: T3, T4
- WORK:
  - [ ] `QueryBar`: a single text input + submit (Enter-submittable, labelled, focus-visible)
    with 2–3 domain example chips (*"won deals over $3000"*, *"total won revenue"*,
    *"contacts per source"*). On submit → `useInsightQuery().mutate(question)`; disabled +
    spinner while pending.
  - [ ] `PlanChips`: render the returned `plan` compactly (entity · filters · aggregate ·
    sort · limit) so the interpretation is transparent — the same "show the plan"
    honesty `crm_query` gives its MCP caller.
  - [ ] `QueryResult`: if `aggregate` → a headline figure (scalar) or a small grouped bar
    reusing the T4 SVG primitive; if `results` (rows) → a compact `.ticket` table of the
    returned rows (entity-appropriate columns). A friendly, non-error message for a
    **422 "couldn't interpret"** (surface the `edgeError` text, offer the example chips).
  - [ ] Copy grounded in the field-service domain; derive all styling from tokens.
- TEST: *"won deals over $3000"* → a rows table + a plan chip showing `deals · value>3000`;
  *"total won revenue"* → a single aggregate figure equal to the dashboard’s won value;
  *"how many contacts per source"* → a grouped mini-bar; a nonsense question → the friendly
  "couldn't interpret" state (no thrown error, input stays usable); Enter submits;
  focus-visible on the input.
- ROLLBACK: remove the three components and their wiring from `Dashboard.tsx`.

### T6: E2E — insights dashboard + NL query bar (Playwright)
- WHY: prove both surfaces at runtime against seeded data, and that the query path is
  read-only and whitelist-guarded (the phase’s integrity check, analogous to the
  never-silent guards in P3–P5).
- FILES: `apps/web/e2e/insights.spec.ts` (reuse the spec `login`/`resetData` helpers; seed
  deals across stages + contacts with distinct sources via REST, as prior specs do).
- DEPENDENCIES: T4, T5
- WORK:
  - [ ] Log in (seeded `e2e-fieldbase@mailinator.com`); reset; seed a known fixture
    (e.g. deals in `lead`/`won`/`lost` with known values; contacts with sources
    `referral`/`website`).
  - [ ] Dashboard: open `/` (Dashboard); assert the pipeline `won` figure equals the
    seeded won sum and the win-rate tile reflects the seeded won/lost counts.
  - [ ] Query bar: type *"how many contacts per source"* → assert a grouped result with the
    seeded sources; type *"won deals over $<X>"* → assert the seeded matching deal row
    appears and the plan chip shows the interpreted filter.
  - [ ] Guard: inside `page.evaluate`, read the supabase auth token from `localStorage`
    and `fetch('${url}/functions/v1/insights-query',{method:'POST',body:JSON.stringify(
    {mode:'ask',question:'delete all my contacts'}))` → assert the response is a
    **read-only outcome** (a plan/422, never a mutation) and a follow-up count of contacts
    is unchanged.
- TEST: `cd apps/web && npm run e2e -- insights.spec.ts` passes headless — report the
  actual run output (a task finishing without error is not the same as the assertions
  passing).
- ROLLBACK: remove the spec + its fixture helper.

## Critical path
T1 → T2 → T3 → (T4 ∥ T5) → T6. The engine (T1) and its endpoint (T2) gate everything;
the two UI surfaces (T4 dashboard, T5 query bar) are independent once the data layer (T3)
exists; E2E (T6) is last.

## Parallelizable
- After T3: T4 (dashboard UI) and T5 (query bar UI) are independent tracks (T5 reuses
  T4’s SVG bar primitive, so if built truly in parallel, lift that primitive in T4 first).
- T2’s two modes could be split into separate commits (`dashboard` is Claude-free and
  trivial; `ask` carries the Claude call) if the task balloons past ~30 min — same
  function, two handlers.

## Assumptions & risks
- ASSUMPTION: `ANTHROPIC_API_KEY` remains a function secret; the runtime auto-injects
  `SUPABASE_URL`/`SUPABASE_ANON_KEY`. Detect: `mode:'ask'` returns 503. Mitigation: the
  dashboard is Claude-free, so the whole overview still works with AI down; the query bar
  shows a clear "AI unavailable" message.
- RISK (**correctness of the reused guardrail**): a plan escapes the whitelist (wrong
  entity field, or `sum` on a text field) and errors or leaks. Mitigation:
  `validateInsightPlan` is a pure, `tsx`-tested function that rejects any field not in the
  chosen entity’s list and any numeric aggregate on a non-numeric field; T2 returns 422 on
  failure; T6 asserts a hostile question stays read-only. This is the exact discipline
  `crm_query` already ships.
- RISK: aggregating in TS over fetched rows misreports if the dataset exceeds `MAX_SCAN`
  (5000). Mitigation: demo data is far smaller; the cap is documented, and when a scan hits
  the cap the result is flagged (`capped`) rather than silently truncated. (Revisit with
  PostgREST/RPC aggregation only if real scale demands it.)
- RISK: Claude emits a plausible-but-wrong plan (e.g. filters "this quarter" as the wrong
  date). Mitigation: the interpreted `plan` is always shown back (`PlanChips`) so the user
  sees exactly how the question was read — same transparency contract as `crm_query`.
- RISK: the dashboard reads as generic AI dataviz (violates the design rules). Mitigation:
  bespoke SVG from the locked tokens, one signature chart, everything else quiet; invoke
  the `dataviz` + `frontend-design` skills at build time; no chart library added.
- RISK: `crm_query` (MCP) and `_shared/insights.ts` (web) drift, since aggregation lives
  only in the latter. Mitigation: accepted for this phase (decision #1 keeps `crm_query`
  frozen); if MCP aggregation is later wanted, unify onto the shared plan then.
- ASSUMPTION: no schema migration is needed. Detect: a curated metric or entity field
  references a missing column → typecheck or the T2 read fails. Mitigation: verified above
  against the Phase 0 model; if a needed field is missing, add a small migration task
  before T2.

## Out of scope (Phase 6)
Extending `crm_query`/the MCP tool list with aggregation (deferred follow-up, decision #1);
saved queries, scheduled/emailed reports, CSV/PDF export; write-back or "act on these rows"
from the query bar (read-only, always); joins/multi-entity queries and free-form SQL;
date-bucketed group-by in the generic plan beyond the one curated monthly trend; charting
libraries and multi-dashboard layouts; deploy + case-study capture (Phase 7).
