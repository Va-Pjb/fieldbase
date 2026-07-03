# Plan: FieldBase Phase 4 — AI Automation Layer

Date: 2026-07-03
Depends on: Phase 0 (schema incl. `automations` + `interactions`, auth), Phase 1
(contacts + deals + data patterns), Phase 2 (MCP server, data-access layer),
Phase 3 (edge-function pattern: AI + guarded write as one impl called by web
with the user JWT and by MCP with the demo token; the never-silent
preview→execute spine). Scope from roadmap item 4: **plain-English automation
builder + missed-lead follow-up**, both AI-native, both never-silent.

## Goal
Two demoable AI-native automations:
1. **Plain-English automation builder** — a user (web) or MCP client describes an
   automation in plain English; Claude turns it into a **validated, whitelisted
   rule** stored in `automations`, listed and toggleable. No free-form code.
2. **Missed-lead follow-up** — on demand, scan for leads that have gone cold,
   have Claude **draft** a follow-up per lead, let the user **review** each, and
   only send on explicit approval. "Send" is **simulated** (logged as an
   `interactions` row) — no real SMS/email (out of scope). The missed-lead
   follow-up *is* an automation instance (trigger `lead_no_contact`, action
   `draft_followup`), so the builder authors it and the scan runs it.

**Hard rule (CLAUDE.md):** `followup_send` requires a `followup_draft` id
produced by a prior `followup_draft` call and explicitly approved — there is no
code path that sends a message straight from a rule or a contact. No silent
auto-sends, ever.

## Hard-rule enforcement (the spine of this phase)
- `followup_draft` creates one `followup_drafts` row per lead (`status='draft'`)
  holding the target contact, channel, and the generated body; it **never
  sends**.
- `followup_send` takes **only** a `draftId`. It loads the row, checks it
  belongs to the caller and is `draft`/`approved`, atomically flips it to
  `sending`, logs the outbound message as an `interactions` row, then sets
  `sent` + `sent_at`. A missing / foreign / already-sent draft is rejected.
- No scheduled/background runner sends anything in v1. The only path from a rule
  to an outbound message is scan → draft → **human approve** → send.
- Neither the edge functions nor the MCP tools expose a "contact → send" or
  "rule → send" path that skips the draft.

## Already in place
- `automations` table (id, user_id, name, trigger_type, trigger_config jsonb,
  action_type, action_config jsonb, natural_language_source, is_active,
  timestamps) with RLS. **No rows/logic yet.**
- `interactions` table (type call/email/note/sms, content, ai_summary,
  occurred_at) — reused to both *detect* cold leads (absence of interactions)
  and *record* a simulated send.
- Edge-function pattern + `_shared` module + `functions.invoke` (user JWT / demo
  token); Anthropic key as a Supabase function secret (verified set); the
  contacts React-Query invalidation convention; the Playwright E2E user
  `e2e-fieldbase@mailinator.com`.

## Open decisions — confirm before building (first = my recommendation)
1. **Send channel:** **simulated** — `followup_send` writes an `interactions`
   row (type from the draft's channel) and marks the draft sent; no real
   provider. vs. wire a real email/SMS provider (out of scope, needs secrets +
   a paid service).
2. **Trigger execution:** **on-demand scan** — the user clicks "Find leads to
   follow up" (or an MCP client calls `followup_draft`) to run active
   `draft_followup` automations and produce drafts. vs. a scheduled
   pg_cron/edge runner (risks silent behavior, harder to demo; deferred).
3. **Draft persistence:** **new `followup_drafts` table** (mirrors
   `migration_jobs`; send takes only an id) vs. reuse `interactions` with a
   status (muddier — conflates planned vs. actual).
4. **"Cold / missed lead" predicate:** **a contact with an open `lead`-stage
   deal (or a contact created in the window with zero interactions) that has had
   no `interactions` row in the last N hours** (default 24h, from the
   automation's `trigger_config.within_hours`). Confirm the exact predicate.
5. **Builder vocabulary (v1):** **whitelisted** — `trigger_type ∈
   {lead_no_contact}`, `action_type ∈ {draft_followup}`; Claude maps NL onto
   this small, validated set (extensible later, like `crm_query`'s plan). vs.
   open-ended rules (unbounded, unsafe to execute).
6. **Backend home:** **edge functions** (`automation-create`, `followup-draft`,
   `followup-send`) as the single implementation for web + MCP — mirrors
   Phase 3. `automation_list` is a plain RLS read (no AI, no edge function).

---

## Tasks

### T1: `followup_drafts` schema + shared automation types
- WHY: the never-silent flow hinges on a persisted draft with an id + status;
  the builder + tools need one shared rule/draft shape.
- FILES: `supabase/migrations/0003_followup_drafts.sql`,
  `packages/shared-types/src/automation.ts` (+ export from `src/index.ts`)
- DEPENDENCIES: Phase 0 schema; decisions #3, #5
- WORK:
  - [ ] `followup_drafts` (id, user_id default auth.uid(), contact_id fk,
    automation_id fk null, channel text check in (email,sms), body text,
    status text check in (draft,approved,sending,sent,failed) default draft,
    review_notes jsonb, created_at, sent_at) + RLS owner-all + indexes
  - [ ] Types: `AutomationRule` (trigger_type/trigger_config/action_type/
    action_config union, whitelisted), `AutomationTriggerType`/`ActionType`
    consts, `FollowupDraft`, `FollowupDraftResult`, `FollowupSendResult`,
    `AutomationCreateResult`
- TEST: migration applies clean; `list_tables` shows `followup_drafts` with the
  status check; `get_advisors` (security) clean (RLS present); types compile
- ROLLBACK: `drop table public.followup_drafts;`

### T2: Automation + follow-up core (edge-shared module)
- WHY: one dependency-free implementation of rule-parse/validate, cold-lead
  detection, and draft-prompt building — imported by the edge functions and
  unit-testable in node.
- FILES: `supabase/functions/_shared/automation.ts`
- DEPENDENCIES: T1
- WORK:
  - [ ] `validateRule(obj)` → whitelisted `AutomationRule | null` (reject
    unknown trigger/action types or out-of-range `within_hours`)
  - [ ] `RULE_SYSTEM` + `RULE_TOOL_SCHEMA` + `buildRuleMessage(nl)` for the
    Claude NL→rule call (forced-tool, like migration's `emit_migration_plan`)
  - [ ] `coldLeadPredicate` as a documented SQL/filter spec + a pure
    `selectColdLeads(contacts, deals, interactions, withinHours, now)` helper
    (deterministic, unit-testable)
  - [ ] `DRAFT_SYSTEM` + `buildDraftMessage(contact, context)` for the
    per-lead follow-up draft; channel defaulting
- TEST: node/tsx scratch — `validateRule` accepts a good rule + rejects a bad
  one; `selectColdLeads` on a fixture returns exactly the cold leads for a given
  window; prompts build without throwing
- ROLLBACK: delete `_shared/automation.ts`

### T3: `automation-create` edge function
- WHY: server-side NL→rule holds the Anthropic key and writes the rule.
- FILES: `supabase/functions/automation-create/index.ts`
- DEPENDENCIES: T2; decision #6
- WORK:
  - [ ] Verify caller JWT (RLS-scoped client); accept `{ instructions, name? }`
  - [ ] Claude forced-tool → `validateRule`; on invalid → 422 clear error
  - [ ] Insert `automations` (rule fields + `natural_language_source`,
    `is_active=true`); return `{ automationId, rule }`
- TEST: invoke with "follow up with new leads we haven't contacted in a day" →
  returns a `lead_no_contact` / `draft_followup` rule; an `automations` row
  exists (verify via `execute_sql`); gibberish → 422
- ROLLBACK: delete the function (no destructive writes beyond an authored rule)

### T4: `followup-draft` edge function (scan → draft, never sends)
- WHY: produce reviewable drafts for cold leads without sending anything.
- FILES: `supabase/functions/followup-draft/index.ts`
- DEPENDENCIES: T2, T1
- WORK:
  - [ ] Verify JWT; accept `{ automationId? , contactId? }` (automation-driven
    scan, or a single explicit contact)
  - [ ] Resolve window from the automation's `trigger_config` (default 24h);
    `selectColdLeads`; cap the batch (e.g. ≤25) and report if capped
  - [ ] For each lead, Claude drafts a body; insert `followup_drafts`
    (`status='draft'`); return `{ drafts: [{draftId, contactId, name, channel,
    body}], scanned, capped }`
- TEST: seed a cold lead → invoke → returns ≥1 draft + a `followup_drafts` row
  `status='draft'`; a contact contacted within the window is **not** drafted;
  **no** `interactions` row is created by drafting
- ROLLBACK: delete the function

### T5: `followup-send` edge function (never silent)
- WHY: the single guarded send path; enforces the hard rule.
- FILES: `supabase/functions/followup-send/index.ts`
- DEPENDENCIES: T4
- WORK:
  - [ ] Verify JWT; accept **only** `{ draftId }`
  - [ ] Load the caller's draft; require `status in (draft, approved)`;
    atomically flip `→ sending` (guard double-send)
  - [ ] Log an `interactions` row (type = channel, content = body,
    `ai_summary` = "AI follow-up sent"); set draft `sent` + `sent_at`; on error
    `failed` + `review_notes`
  - [ ] Reject missing / foreign / already-sent draft with a clear error
- TEST: send a valid draft → `interactions` row created + draft `sent`
  (verify via `execute_sql`); re-send → rejected; bogus/foreign id → rejected;
  confirm **no send path exists without a `draftId`**
- ROLLBACK: delete the function

### T6: MCP tools — automation + follow-up
- WHY: expose the same guarded flow to MCP clients; enforce the hard rule at the
  tool layer.
- FILES: `apps/mcp-server/src/tools/automation.ts`,
  `apps/mcp-server/src/data/automations.ts`, `server.ts`
- DEPENDENCIES: T3, T4, T5
- WORK:
  - [ ] `automation_create { instructions, name? }` → `automation-create`
    (write); `automation_list` → RLS read of `automations` (readOnly)
  - [ ] `followup_draft { automationId?, contactId? }` → `followup-draft`
    (readOnly — drafts only); returns draft ids + bodies
  - [ ] `followup_send { draftId }` → `followup-send` (write,
    `destructiveHint: true`); description states an approved `followup_draft`
    id is required. Unwrap edge JSON errors (as in Phase 3)
- TEST: Inspector/tsx harness: create → rule + row; draft(cold lead) → draftId;
  send(draftId) → interaction logged (verify via `execute_sql`); send with
  missing/bad id → clean error; typecheck passes
- ROLLBACK: unregister the tools

### T7: Web — plain-English automation builder (Automations module)
- WHY: the authoring entry point; replaces the placeholder.
- FILES: `apps/web/src/routes/Automations.tsx` (replace placeholder),
  `apps/web/src/components/automations/{RuleBuilder,RuleCard}.tsx`,
  `apps/web/src/lib/api/automations.ts`, hooks as needed
- DEPENDENCIES: T3
- WORK:
  - [ ] NL textarea + "Create automation" → `automation-create`; render the
    parsed rule (trigger/action as human-readable chips), loading/error states
  - [ ] List active/inactive automations with a toggle (`is_active`); derive all
    UI from locked tokens (one signature moment: the parsed-rule "spec" card)
- TEST: typing an English rule + Create shows the parsed rule and it appears in
  the list; toggling active persists (reload)
- ROLLBACK: restore the placeholder page

### T8: Web — missed-lead follow-up review queue (never-silent gate)
- WHY: the review-then-approve UI — the visible half of the hard rule.
- FILES: `apps/web/src/components/automations/{FollowupQueue,DraftCard}.tsx`
  (surfaced from Automations or a `/automations/followups` view)
- DEPENDENCIES: T4, T5, T7
- WORK:
  - [ ] "Find leads to follow up" → `followup-draft`; render each draft (contact,
    channel, editable-optional body, why-flagged)
  - [ ] Per draft: **"Approve & send"** (explicit) → `followup-send(draftId)` →
    sent state; "Dismiss" discards. Invalidate the contact's interactions/
    timeline query on send (matches the mutation convention)
- TEST: scan lists a cold lead's draft; Approve & send logs an interaction and
  marks it sent; dismiss sends nothing; no bulk/auto "send all without review"
- ROLLBACK: remove the queue UI (keep the builder)

### T9: E2E — builder + follow-up + guard (Playwright)
- WHY: prove NL→rule and scan→draft→approve→send at runtime, and that send can't
  fire without an approved draft.
- FILES: `apps/web/e2e/automation.spec.ts` (+ fixture/seed helper)
- DEPENDENCIES: T7, T8
- WORK:
  - [ ] Log in (seeded user); reset; create an automation from English → assert
    the parsed rule renders + lists
  - [ ] Seed a cold lead; run the scan → assert a draft renders → Approve & send
    → assert the interaction appears on the contact timeline
  - [ ] Guard: the UI offers no send without a preview draft; a direct
    `followup-send` call with no/blocked `draftId` is rejected (as the Phase 3
    guard test does for `migration-execute`)
- TEST: `npx playwright test automation.spec.ts` passes headless — report the
  actual run
- ROLLBACK: remove the spec + fixture

## Critical path
T1 → T2 → T3; T2 → T4 → T5. Then web (T7 → T8) and MCP (T6) in parallel; T9 last.

## Parallelizable
- `automation-create` (T3) and the follow-up chain (T4 → T5) are independent
  after T2.
- After T5: the web builder+queue (T7 → T8) and the MCP tools (T6) are
  independent tracks.

## Assumptions & risks
- ASSUMPTION: `ANTHROPIC_API_KEY` remains set as a Supabase function secret
  (verified in Phase 3). Detect: create/draft 500/503. Mitigation: clear
  "AI unavailable" error.
- RISK: the cold-lead predicate over-/under-selects. Mitigation: `selectColdLeads`
  is a pure, unit-tested function; the window is configurable; drafting is
  capped and reported.
- RISK: Claude drafts an off-tone or unsafe message. Mitigation: nothing sends
  without human review; the body is shown in full (and optionally editable)
  before "Approve & send".
- RISK: double-send race. Mitigation: atomic `draft → sending` claim (as
  migration-execute's `previewed → executing`); re-send rejected.
- RISK: builder NL maps to an unsupported rule. Mitigation: whitelisted
  `validateRule`; unknown → 422 with a clear message, nothing stored.

## Out of scope (Phase 4)
Real SMS/email/telephony (sends are simulated as interactions); scheduled/
background automation execution (v1 is on-demand); arbitrary/open-ended rule
types beyond the missed-lead follow-up whitelist; review requests + booking
(Phase 5); analytics/NL query bar (Phase 6); multi-step or branching workflows.
