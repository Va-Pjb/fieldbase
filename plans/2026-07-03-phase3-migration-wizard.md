# Plan: FieldBase Phase 3 — AI Migration Wizard

Date: 2026-07-03
Depends on: Phase 0 (schema, auth), Phase 1 (contacts + data patterns), Phase 2
(MCP server, Anthropic + Supabase infra). Scope from roadmap item 3:
**plan → preview → execute import, never silent.**

## Goal
A user (in the web app) or an MCP client uploads a CSV plus plain-English
instructions; Claude proposes a **mapping plan**; the user reviews it; and only
on explicit approval are contacts written. **Hard rule:** `migration_execute`
requires a `migration_job` id produced by a prior `migration_preview` — there is
no code path that imports straight from a file. Fake data only.

## Hard-rule enforcement (the spine of this phase)
- Preview creates a `migration_jobs` row (`status='previewed'`) holding the
  plan **and** the parsed rows, and returns its id.
- Execute takes **only** a `job_id`. It loads the row, checks it belongs to the
  caller and is `previewed`, flips it to `executing`, writes contacts, then
  `completed`. A missing / non-previewed / already-executed job is rejected.
- Neither the edge function nor the MCP tool exposes a "file → import" path that
  skips preview.

## Already in place
- `migration_jobs` table (id, user_id, status enum, source_filename,
  mapping_plan jsonb, review_notes jsonb, executed_at) with RLS.
- Anthropic key pattern (`claude-sonnet-5`); contacts data layer; MCP server.

## Open decisions — confirm before building (first = my recommendation)
1. **Backend home:** two **Supabase Edge Functions** (`migration-preview`,
   `migration-execute`) as the single implementation — the web calls them with
   the user's JWT, and the MCP tools call the *same* functions with the demo
   user's token (RLS-scoped, Anthropic key stays server-side). vs. duplicating
   logic in the MCP server + a separate web backend.
2. **Import scope (v1):** **contacts only** (plan schema built to extend to
   deals later) vs. contacts + deals now.
3. **File format (v1):** **CSV** vs. also xlsx.
4. **Row storage:** **store parsed rows on the job at preview time** so execute
   needs only the `job_id` (adds a `source_rows jsonb` column) vs. re-upload the
   file at execute (weaker guarantee).
5. **Anthropic key for edge functions:** set as a **Supabase function secret**
   (`ANTHROPIC_API_KEY`) — a one-time setup action on your side, like the
   MCP-server `.env`. I can deploy the functions via MCP but not set the secret.

---

## Tasks

### T1: Migration plan schema + job-row extension
- WHY: the whole flow hinges on one plan shape and a job that stores enough to
  execute from an id alone.
- FILES: `supabase/migrations/0002_migration_source_rows.sql`, `packages/shared-types` (MigrationPlan types)
- DEPENDENCIES: Phase 0 schema; decision #4
- WORK:
  - [ ] Add `source_rows jsonb` to `migration_jobs` (parsed CSV rows captured at preview)
  - [ ] MigrationPlan types in shared-types: `targetEntity: 'contacts'`, `columnMappings` (source header → contact field | ignore, optional transform note), `warnings[]`, `stats` (rows, mapped/unmapped columns)
- TEST: migration applies clean; `list_tables` shows `source_rows`; security advisor clean; types compile
- ROLLBACK: `alter table migration_jobs drop column source_rows`

### T2: Migration core (parse · plan · apply) — edge-shared module
- WHY: one implementation of CSV→plan→contact-rows, imported by both edge functions.
- FILES: `supabase/functions/_shared/migration.ts`
- DEPENDENCIES: T1
- WORK:
  - [ ] Parse CSV → headers + rows (npm:papaparse or a small parser)
  - [ ] `buildPlan(headers, sampleRows, instructions)` → calls `claude-sonnet-5` to produce a MigrationPlan, zod-validated; never invents contact fields outside the allowed set
  - [ ] `applyPlan(plan, rows)` → contact insert payloads (transform per mapping; collect per-row skips/warnings)
- TEST: a scratch invocation with a sample CSV + instructions returns a valid plan; `applyPlan` yields the expected insert payloads (skips invalid-email rows into warnings)
- ROLLBACK: delete `_shared/migration.ts`

### T3: `migration-preview` edge function
- WHY: server-side preview holds the Anthropic key and creates the job.
- FILES: `supabase/functions/migration-preview/index.ts`
- DEPENDENCIES: T2; decision #1, #5
- WORK:
  - [ ] Verify caller JWT (RLS-scoped client); accept `{ filename, csv, instructions }`
  - [ ] Parse + `buildPlan`; insert `migration_jobs` (`status='previewed'`, `mapping_plan`, `source_rows`, `source_filename`); return `{ job_id, plan, stats }`
- TEST: invoke with a sample CSV → returns `job_id` + plan; a `migration_jobs` row exists with `status='previewed'` and stored rows (verify via `execute_sql`)
- ROLLBACK: delete the function (no destructive writes)

### T4: `migration-execute` edge function (never silent)
- WHY: the single guarded write path; enforces the hard rule.
- FILES: `supabase/functions/migration-execute/index.ts`
- DEPENDENCIES: T3
- WORK:
  - [ ] Verify JWT; accept **only** `{ job_id }`
  - [ ] Load job (must be caller's + `status='previewed'`); set `executing`; `applyPlan` → insert contacts; set `completed` + `executed_at`; on error set `failed` + `review_notes`
  - [ ] Reject missing / not-previewed / already-executed jobs with a clear error
- TEST: execute a valid previewed `job_id` → contacts inserted + job `completed`; re-execute → rejected; bogus id → rejected; confirm **no import path exists without a `job_id`**
- ROLLBACK: delete the function

### T5: Web wizard — upload + instructions (step 1)
- WHY: the entry point of the wizard.
- FILES: `apps/web/src/routes/Migration.tsx` (replace placeholder), `apps/web/src/components/migration/UploadStep.tsx`
- DEPENDENCIES: T3
- WORK:
  - [ ] CSV picker (+ client-side row count), instructions textarea, "Preview import" → invokes `migration-preview`; loading/error states; on locked tokens
- TEST: choosing a CSV + instructions + Preview calls the function and advances to the preview step
- ROLLBACK: restore the placeholder page

### T6: Web wizard — review + approve → execute (steps 2–3)
- WHY: the never-silent review gate + the write.
- FILES: `apps/web/src/components/migration/{PreviewStep,ResultStep}.tsx`
- DEPENDENCIES: T4, T5
- WORK:
  - [ ] Render the plan: column mappings, sample transformed rows, warnings, counts
  - [ ] "Approve & import" (explicit) → `migration-execute(job_id)` → result screen (N imported, M skipped) + link to Contacts; Cancel discards the job
- TEST: preview shows mappings + warnings; approve imports; imported contacts appear in Contacts; cancel writes nothing
- ROLLBACK: remove preview/result UI (keep step 1)

### T7: MCP tools `migration_preview` + `migration_execute`
- WHY: expose the same guarded flow to MCP clients; enforce the hard rule at the tool layer.
- FILES: `apps/mcp-server/src/tools/migration.ts`, `server.ts`
- DEPENDENCIES: T3, T4
- WORK:
  - [ ] `migration_preview` `{ filename, csv, instructions }` → calls `migration-preview` with the demo token → returns `job_id` + plan (readOnly)
  - [ ] `migration_execute` `{ job_id }` → calls `migration-execute` (write, `destructiveHint: true`); description states a prior `migration_preview` id is required
- TEST: Inspector: preview → `job_id` + plan; execute(job_id) → imported (verify via `execute_sql`); execute with missing/bad id → clean error
- ROLLBACK: unregister the two tools

### T8: E2E — full wizard + guard (Playwright)
- WHY: prove plan→preview→execute at runtime and that execute can't fire without a preview.
- FILES: `apps/web/e2e/migration.spec.ts`, `apps/web/e2e/fixtures/contacts-sample.csv`
- DEPENDENCIES: T5, T6
- WORK:
  - [ ] Log in (seeded user); Migration → upload sample CSV + instructions → Preview → assert plan renders → Approve → assert imported contacts appear in Contacts
  - [ ] Guard: assert the UI offers no execute without a preview; a direct `migration-execute` call with no/blocked `job_id` is rejected
- TEST: `npx playwright test` passes headless — report actual run
- ROLLBACK: remove the spec + fixture

## Critical path
T1 → T2 → T3 → T4; then web (T5 → T6) and MCP (T7) in parallel; T8 last.

## Parallelizable
After T4: the web wizard (T5–T6) and the MCP tools (T7) are independent tracks.

## Assumptions & risks
- ASSUMPTION: `ANTHROPIC_API_KEY` is set as a Supabase function secret. Detect:
  preview 500s. Mitigation: preview returns a clear "AI unavailable" error.
- RISK: a large CSV blows the token budget in `buildPlan`. Mitigation: send only
  headers + a sample of rows to Claude; apply the plan to all rows locally.
- RISK: partial import on mid-execute failure. Mitigation: mark the job `failed`
  with `review_notes`; report what was written; (stretch) wrap inserts in a txn.
- RISK: malformed CSV / injection in cell values. Mitigation: values are inserted
  as parameters (never SQL); email/format issues become row warnings, not writes.

## Out of scope (Phase 3)
Deals/interactions import (contacts only), xlsx/other formats, dedupe/merge
against existing contacts, undo/rollback of a completed import, background
processing of very large files, automations (Phase 4).
