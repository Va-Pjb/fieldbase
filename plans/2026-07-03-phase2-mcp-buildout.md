# Plan: FieldBase Phase 2 — MCP Server Buildout (remaining CRM tools)

Date: 2026-07-03
Depends on: Phase 0 (MCP skeleton, streamable HTTP), Phase 1 (schema + data
patterns + generated DB types). Scope from roadmap item 2: the **8 `crm_*`
tools**, verified in MCP Inspector.

## Goal
The standalone MCP server exposes the full CRM read/write surface over
streamable HTTP so any MCP client (Claude Desktop/Code, Inspector) can query and
operate FieldBase — list/get/create/update contacts, log interactions, read the
pipeline, move deal stages, and run a natural-language query. Every operation
hits the real `fieldbase` Supabase DB, RLS-scoped, fake data only.

## Tools in scope (from the 15-tool architecture list)
`crm_list_contacts` (readOnly, replaces the Phase 0 stub), `crm_get_contact`
(readOnly), `crm_create_contact` (write), `crm_update_contact` (write),
`crm_log_interaction` (write), `crm_get_pipeline` (readOnly),
`crm_move_deal_stage` (write, idempotent), `crm_query` (readOnly, NL→structured).

Out of scope (later phases): `migration_*`, `automation_*`, `followup_*`,
`review_request_send`.

## Already in place
- `apps/mcp-server`: `@modelcontextprotocol/sdk` McpServer + streamable HTTP
  transport with session management + one stub `crm_list_contacts`.
- `shared-types` (Contact zod schema); DB types generated in Phase 1
  (`apps/web/src/lib/database.types.ts`).

## Open decisions — confirm before building (first option = my recommendation)
1. **MCP ↔ Supabase auth:** server signs in as a **dedicated demo user** with
   creds from env (RLS-scoped, `user_id` default works, no service-role sprawl)
   — vs service-role key + a fixed `DEMO_USER_ID` — vs per-request user JWT.
2. **DB types source:** **move the generated `Database` types into
   `packages/shared-types`** so web and server share one source — vs regenerate
   a separate copy in `mcp-server`.
3. **`crm_query`:** Claude (`claude-sonnet-5`) translates NL → a **validated
   structured query plan** (entity / filters / sort / limit) executed via the
   typed query builder — **never raw SQL**, read-only. Confirm this approach.
4. **Data-access code:** **implement server-side in `mcp-server`** now — vs
   extract a shared core package used by both web and server (defer).

---

## Tasks

### T1: Server config + Supabase & Anthropic clients
- WHY: every tool needs a configured, authenticated DB client; `crm_query` needs
  Claude. Centralize env + client setup and fail fast on misconfig.
- FILES: `apps/mcp-server/src/config.ts`, `src/lib/supabase.ts`, `src/lib/anthropic.ts`, `apps/mcp-server/.env.example`, `package.json`
- DEPENDENCIES: Phase 0 T6; decision #1
- WORK:
  - [ ] Add deps: `@supabase/supabase-js`, `@anthropic-ai/sdk`, `dotenv`
  - [ ] `config.ts`: load + zod-validate env (SUPABASE_URL, SUPABASE_ANON_KEY, demo-user creds or service key per decision, ANTHROPIC_API_KEY, PORT); fail fast if missing
  - [ ] `supabase.ts`: typed client; establish the chosen auth (sign in demo user); expose an authenticated client accessor
  - [ ] `anthropic.ts`: Anthropic client pinned to `claude-sonnet-5`
- TEST: server boots and logs the authenticated demo user; a startup DB check (`select count from contacts`) succeeds
- ROLLBACK: revert to the Phase 0 stub server

### T2: Server-side CRM data-access layer
- WHY: tools should call small, typed functions — not inline Supabase calls — so
  behavior stays consistent and testable.
- FILES: `apps/mcp-server/src/data/{contacts,deals,interactions}.ts`
- DEPENDENCIES: T1; decision #2
- WORK:
  - [ ] Use the shared `Database` types (Row/Insert/Update)
  - [ ] contacts: `list(filter)`, `get(id)`, `create(input)`, `update(id, patch)`
  - [ ] deals: `getPipeline()` (grouped by stage with counts + value totals), `moveStage(id, stage)`
  - [ ] interactions: `log(contactId, type, content, occurredAt?)`
  - [ ] Ownership handled by the demo session (`user_id` default = `auth.uid()`)
- TEST: a scratch `tsx` script calls each function against `fieldbase` and returns the expected shapes; typecheck clean
- ROLLBACK: delete `src/data/`

### T3: Contact read tools — `crm_list_contacts` (real) + `crm_get_contact`
- WHY: replace the hardcoded stub with live data; getters are the safest first
  real tools.
- FILES: `apps/mcp-server/src/tools/contacts.ts`, `src/server.ts`
- DEPENDENCIES: T2
- WORK:
  - [ ] `crm_list_contacts`: input `{ search?, limit? }`; returns real contacts (replaces stub)
  - [ ] `crm_get_contact`: input `{ id }`; returns the contact + its recent interactions + deals
  - [ ] `readOnly` annotations; structured JSON content; `isError` for not-found
- TEST: Inspector CLI `tools/call` both; results match a Supabase `execute_sql` count/row
- ROLLBACK: re-register the Phase 0 stub list tool

### T4: Contact write tools — `crm_create_contact` + `crm_update_contact`
- WHY: the core write surface for operating the CRM from a client.
- FILES: `src/tools/contacts.ts`, `src/server.ts`
- DEPENDENCIES: T2, T3
- WORK:
  - [ ] `crm_create_contact`: `{ name, phone?, email?, company?, source?, tags? }` → created row
  - [ ] `crm_update_contact`: `{ id, ...patch }` → updated row
  - [ ] write annotations; validation failures returned as clean tool errors, never crashes
- TEST: Inspector create → new row visible via `execute_sql`; update → field changed; invalid input → clean error
- ROLLBACK: unregister the two write tools

### T5: `crm_log_interaction` (write) + `crm_get_pipeline` (readOnly)
- WHY: logging touchpoints and reading the pipeline are the next core operations.
- FILES: `src/tools/{interactions,pipeline}.ts`, `src/server.ts`
- DEPENDENCIES: T2
- WORK:
  - [ ] `crm_log_interaction`: `{ contact_id, type(call|email|note|sms), content, occurred_at? }`
  - [ ] `crm_get_pipeline`: deals grouped by stage with counts + value totals
- TEST: Inspector log → interaction row exists; `get_pipeline` totals match a `sum()` query
- ROLLBACK: unregister both

### T6: `crm_move_deal_stage` (write, idempotent)
- WHY: the signature pipeline operation, mirrored from the UI; must be idempotent.
- FILES: `src/tools/pipeline.ts`, `src/server.ts`
- DEPENDENCIES: T2, T5
- WORK:
  - [ ] `{ deal_id, stage }` validated against the stage set; update; return the updated deal
  - [ ] idempotent: moving to the current stage is a no-op success (`idempotentHint`)
- TEST: Inspector move → stage changes in DB; repeat same move → still success; invalid stage → clean error
- ROLLBACK: unregister

### T7: `crm_query` — natural language → structured results (Claude)
- WHY: the AI-native query surface — ask in English, get structured CRM results.
- FILES: `src/tools/query.ts`, `src/lib/queryPlan.ts`, `src/server.ts`
- DEPENDENCIES: T1, T2
- WORK:
  - [ ] Constrained query-plan schema (entity: contacts|deals; filters; sort; limit)
  - [ ] `claude-sonnet-5` translates NL → query plan (structured output), zod-validated; NEVER raw SQL
  - [ ] Execute the validated plan via the typed data layer (read-only); return rows + the interpreted plan
  - [ ] Guardrails: clamp `limit`, reject unknown fields/entities
- TEST: Inspector "won deals over $3000" → correct rows + echoed plan; a nonsense query → safe "couldn't interpret" message (no crash, no SQL path)
- ROLLBACK: unregister `crm_query` (rest of server unaffected)

### T8: Inspector verification sweep + client connection docs
- WHY: prove the whole 8-tool surface end-to-end and make it connectable by a
  real client — the hero demo.
- FILES: `apps/mcp-server/README.md`, root `README.md` update
- DEPENDENCIES: T3–T7
- WORK:
  - [ ] Inspector CLI: `tools/list` shows all 8; call each with representative args
  - [ ] Document connect config for Claude Desktop/Code (streamable HTTP URL + env)
  - [ ] Clean up any test rows created during the sweep
- TEST: `tools/list` returns 8 tools; each call succeeds; the documented client config connects and lists tools
- ROLLBACK: docs only

## Critical path
T1 → T2 → (T3 → T4) and (T5 → T6) and T7 → T8.

## Parallelizable
After T2: contact tools (T3/T4), interaction+pipeline (T5/T6), and `crm_query`
(T7) are independent tracks; T8 runs last.

## Assumptions & risks
- ASSUMPTION: the demo-user session stays valid on a long-running server.
  Detect: 401s after idle. Mitigation: supabase-js auto-refresh; re-auth on failure.
- ASSUMPTION: an Anthropic API key is available for `crm_query`. Detect:
  `crm_query` errors on first call. Mitigation: it degrades to an explicit
  "AI query unavailable" error; the other 7 tools are unaffected.
- RISK: `crm_query` could produce an invalid/over-broad plan. Mitigation: strict
  zod schema, `limit` clamp, read-only, typed builder (no raw SQL).
- RISK: test tool-calls pollute demo data. Mitigation: clearly-tagged test rows
  + cleanup in T8; fake data only.

## Out of scope (Phase 2)
Migration, automation, follow-up/review tools (Phases 3–5); hosting/deploy of the
MCP server (Phase 7); multi-user auth beyond the single demo user; surfacing the
MCP endpoint in the web UI (Phase 5 Settings).
