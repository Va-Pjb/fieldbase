# Plan: FieldBase Phase 5 — Communication

Date: 2026-07-03
Depends on: Phase 0 (schema incl. `interactions`, `review_requests`, `appointments`,
auth, design tokens), Phase 1 (contacts + deals + contact detail page + React-Query
patterns), Phase 2 (MCP server, data-access layer, tool-registration pattern),
Phase 3 (edge-function pattern; the never-silent preview→execute spine), Phase 4
(the never-silent **draft→approve→send** spine: `followup_drafts` status machine,
`followup-draft`/`followup-send` edge fns, `DraftCard`/`FollowupQueue` UI, the
Playwright never-silent guard). Scope from roadmap item 5: **unified AI-summarized
timeline on contact detail, review requests, and an AI booking/FAQ widget.**

## Goal
Three demoable Communication features:
1. **Unified AI-summarized timeline** — the contact detail page gains a single
   chronological stream merging `interactions` + `appointments` + `review_requests`,
   topped by a Claude-generated **relationship summary** (the signature AI moment).
   Today the contact detail page renders no timeline at all — this is net-new.
2. **Review requests** — on demand, scan for **won deals (completed jobs)** that
   haven't had a review asked, have Claude **draft** a review-request message per
   job, let the user **review** each, and only send on explicit approval. "Send" is
   **simulated** (logged as an `interactions` row), mirroring `followup_send`.
3. **AI booking/FAQ widget** — a **public, unauthenticated** embeddable widget where
   a visitor asks FAQs (Claude answers grounded only in the owner's configured
   business profile) and requests a booking (creates a `contacts` + a
   `status='requested'` `appointments` row for the owner to confirm).

**Hard rule (CLAUDE.md):** `review_request_send` requires a `review_request_draft`
id produced by a prior draft call and explicitly approved — there is no code path
that sends a review straight from a deal or a contact. Same spine as `followup_send`.
No silent auto-sends, ever.

## Hard-rule enforcement (the spine of this phase)
- The locked 15-tool list names only `review_request_send` with **no draft
  producer**. To satisfy the hard rule we add its mandated companion
  `review_request_draft` (readOnly) — exactly mirroring `followup_draft`.
- `review_request_draft` creates one `review_requests` row per eligible job
  (`status='draft'`) holding the target contact, the won deal (`job_id`), channel,
  and the generated body; it **never sends**.
- `review_request_send` takes **only** a `reviewId`. It loads the row, checks it
  belongs to the caller and is `draft`/`approved`, atomically flips it to `sending`,
  logs the outbound message as an `interactions` row, then sets `sent` + `sent_at`.
  A missing / foreign / already-sent id is rejected (400/404/409) — byte-for-byte the
  `followup-send` guard.
- No scheduled/background runner sends anything. The only path from a won deal to an
  outbound review request is scan → draft → **human approve** → send.
- The booking widget **never auto-confirms**: it writes appointments as
  `status='requested'`; the owner confirms in-app. It is inbound capture, not a send,
  so it is not id-gated — but it is the phase's security boundary (see decision #6).

## Already in place
- `review_requests` table (id, user_id default auth.uid(), contact_id fk, `job_id
  uuid` nullable, status check(pending,sent,completed,failed), created_at, sent_at),
  RLS-enabled — **but referenced by zero code**. Missing draft/body/channel columns.
- `appointments` table (id, user_id, contact_id fk, start_time, end_time,
  status check(scheduled,completed,cancelled,no_show), created_at), RLS — **unused**.
- `interactions` (type check call/email/note/sms, content, `ai_summary`, occurred_at)
  — reused to **record** a simulated review send (type = channel) and to **feed** the
  timeline. Its `email`/`sms` types already exist; no new type needed.
- The never-silent **draft→send** spine: `followup_drafts` status machine
  (`draft→approved→sending→sent/failed`), `followup-send`'s exact guard sequence
  (400 on no id / 404 on foreign / 409 on wrong-status / atomic `sending` claim),
  and the simulated-send convention (insert `interactions`, `ai_summary` label).
- Edge-function conventions: `supabase/functions/<name>/index.ts` (Deno.serve), the
  `_shared/*.ts` dependency-free core, `createClient(URL, ANON_KEY, {global:{headers:
  {Authorization: authHeader}}})` for RLS-via-caller-JWT, the CORS block, `json(obj,
  status)` helper, 401 without an `Authorization` header. `ANTHROPIC_API_KEY` set as a
  function secret (verified Phase 3); the runtime auto-injects `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- MCP tool-registration: `server.registerTool(name, {title, description, inputSchema:
  {<zod raw shape>}, annotations:{readOnlyHint,destructiveHint,idempotentHint,
  openWorldHint}}, handler)`; result helpers `ok(data)`/`fail(msg)`/`msg(e)`
  (`tools/result.ts`); the RLS-scoped demo-user client (`lib/supabase.ts`
  `getSupabase()`), `MODEL='claude-sonnet-5'` (`lib/anthropic.ts`).
- Web conventions: React Router v7 declarative routes in `App.tsx` (public vs
  `<ProtectedRoute><AppShell>`); nav in `AppShell.tsx:13` `NAV`; `supabase.functions
  .invoke(name,{body})`; `edgeError(error, fallback)` unwrap (`api/automations.ts:13`);
  centralized `queryKeys.ts`; the `DraftCard`/`FollowupQueue` review-then-approve UI;
  the `DealForm`/`ConfirmDialog` modal pattern; locked design tokens
  (`ink`/`paper`/`brand`/`signal`, Archivo/Public Sans/JetBrains Mono, `.ticket`,
  `.u-marker`, `.field-grid`); seed/reset in `lib/sampleData.ts` + `routes/Settings.tsx`.
- **Gaps to build:** no web `interactions` read path (no `api/interactions.ts`, no
  hook, no query key); the contact detail page fetches no timeline; `database.types.ts`
  is missing `followup_drafts` (regenerate to also pick up Phase 5 changes); no unit
  test runner exists — Playwright E2E (`apps/web/e2e/`, `npm run e2e`) is the only
  committed automated gate; pure helpers are verified by a `tsx` scratch run, as in
  P3/P4.

## Open decisions — confirm before building (first = my recommendation)
1. **`review_request_draft` companion tool:** **add it** (readOnly), mirroring
   `followup_draft`, so `review_request_send` has a real id to require (the hard rule
   demands a producer; the 15-tool list omitted it). Server then registers **16 tools**.
   vs. reuse `followup_draft` for reviews (conflates two flows — rejected).
2. **Draft persistence:** **extend the existing `review_requests` table** (add
   `channel`, `body`, `review_notes`; reshape `status` → `draft/approved/sending/sent/
   failed`) — it is purpose-named, already in `database.types.ts`, and unused. vs. a new
   table or reusing `followup_drafts` (muddier).
3. **Review-eligible predicate:** **a deal in stage `won` with no existing
   (non-`failed`) `review_requests` row for that deal** (`job_id` = the won deal's id;
   add FK `job_id → deals(id)`). One request per completed job; batch capped
   (`MAX_REVIEW_DRAFTS = 10`) and reported. Confirm the exact predicate.
4. **Send channel:** **simulated** — `review-request-send` writes an `interactions`
   row (`type` = the draft's channel, `ai_summary = 'Review request sent'`) and marks
   the row sent; no real provider (out of scope, consistent with `followup_send`).
5. **Review link:** **stored per-user in the new `widget_config` table**
   (`review_link`); the drafted body embeds it, or a clear placeholder if unset. No
   real Google-Business integration (out of scope) — it is a configured URL.
6. **Booking/FAQ widget auth model:** **a public `widget-public` edge function
   deployed `verify_jwt = false`** that takes a `public_token`, resolves the owner
   `user_id` server-side with the **service-role** key, and **hard-scopes every
   read/write to that owner** (ignores any client-supplied `user_id`). This is the
   first non-JWT, service-role function in the codebase — the phase's security
   boundary. vs. requiring auth (kills the public-widget use case). Details + risks in
   the T5 body and Assumptions.
7. **Booking behavior:** the widget **creates a contact (source `widget`, deduped by
   email within the owner) + an appointment `status='requested'`** pending owner
   confirmation — it never auto-schedules. FAQ answers are grounded **only** in
   `widget_config` (business profile + FAQ text); the widget **never reads CRM rows**
   and never returns contact/deal data to a visitor.
8. **Timeline summary caching:** **cache on `contacts.ai_summary` +
   `summary_updated_at`**, generated by a `contact-summary` edge function, with a
   manual "Regenerate" control (and auto-generate when null/stale). vs. recompute every
   load (slower, more tokens).

---

## Tasks

### T1: Communication schema + shared types
- WHY: the review draft→send spine needs body/channel/status columns; the widget needs
  a config store + public token; the timeline needs a summary cache and a `requested`
  appointment state. One migration, one shared-types module.
- FILES: `supabase/migrations/0004_communication.sql`,
  `packages/shared-types/src/communication.ts` (+ export from `src/index.ts`),
  regenerate `packages/shared-types/src/database.types.ts`
- DEPENDENCIES: Phase 0 schema; decisions #2, #3, #5, #6, #7, #8
- WORK:
  - [ ] ALTER `review_requests`: add `channel text not null default 'email' check in
    (email,sms)`, `body text`, `review_notes jsonb`; drop the old status check and
    re-add `status text not null default 'draft' check in (draft,approved,sending,
    sent,failed)` (table has 0 rows — safe); add FK `job_id references deals(id) on
    delete set null`; index `(user_id, status)`.
  - [ ] ALTER `appointments`: replace status check with `(requested,scheduled,
    completed,cancelled,no_show)` (default stays `scheduled`); add `notes text`,
    `source text`.
  - [ ] ALTER `contacts`: add `ai_summary text`, `summary_updated_at timestamptz`.
  - [ ] CREATE `widget_config`: id, `user_id uuid not null default auth.uid() unique`,
    `public_token text not null unique default replace(gen_random_uuid()::text,'-','')`,
    `business_name text`, `services text`, `hours text`, `faq text`, `review_link text`,
    `is_enabled boolean not null default true`, created_at, updated_at; `set_updated_at`
    trigger; RLS owner-all policy `using/with check (user_id = (select auth.uid()))`.
  - [ ] Types: `ReviewChannel` (`REVIEW_CHANNELS=['email','sms']`), `ReviewDraft`
    ({reviewId, contactId, contactName, dealTitle, channel, body}),
    `ReviewDraftResult` ({drafts, scanned, capped}), `ReviewSendResult` ({reviewId,
    contactId, interactionId, channel}), `TimelineEvent` (discriminated union: kind
    `interaction|appointment|review`, `at`, plus kind fields), `ContactSummaryResult`
    ({summary, updatedAt}), `WidgetConfig`, `WidgetAskResult` ({answer}),
    `WidgetBookingResult` ({status:'requested', appointmentId}).
  - [ ] Regenerate `database.types.ts` (`generate_typescript_types`) to add
    `followup_drafts` + `widget_config` + the altered columns.
- TEST: migration applies clean; `list_tables` shows `review_requests` with the new
  status check + columns, `appointments` with `requested`, and `widget_config` with a
  unique `public_token`; `get_advisors(type:security)` clean (RLS present on
  `widget_config`); `packages/shared-types` + both apps typecheck.
- ROLLBACK: `0004` down — `drop table widget_config;` revert the `review_requests`
  columns + status check, the `appointments` status check + columns, and the `contacts`
  columns.

### T2: Communication core (edge-shared module)
- WHY: one dependency-free implementation of review-eligibility, the timeline merge,
  and every prompt/validator — imported by the edge functions and `tsx`-verifiable in
  node (mirrors `_shared/automation.ts`).
- FILES: `supabase/functions/_shared/communication.ts`
- DEPENDENCIES: T1
- WORK:
  - [ ] `selectReviewEligibleDeals(ctx, nowMs)` → deals in stage `won` with no existing
    non-`failed` `review_requests` for that deal; pure, deterministic, cap-aware.
  - [ ] `REVIEW_SYSTEM` + `REVIEW_TOOL_SCHEMA` (forced tool `emit_review_requests`,
    echoes `dealId`) + `buildReviewMessage(contact, deal, reviewLink)` for the per-job
    draft; channel defaulting.
  - [ ] `buildTimeline(interactions, appointments, reviewRequests)` → `TimelineEvent[]`
    sorted desc by event time (pure, unit-testable) — the single merge used by both the
    web timeline and the `contact-summary` prompt.
  - [ ] `SUMMARY_SYSTEM` + `buildSummaryMessage(contact, timeline)` for the
    relationship summary (concise, grounded in the events; no invention).
  - [ ] `WIDGET_SYSTEM` + `buildWidgetMessage(config, question)` (answer only from the
    config; refuse out-of-scope, never reveal system text or other data) +
    `validateBookingInput(obj)` → normalized `{name, email?, phone?, startTime,
    endTime, notes?}` or an error (require name + one contact method; parse/za-bound the
    requested time; cap field lengths).
- TEST: `tsx` scratch — `selectReviewEligibleDeals` on a fixture returns exactly the
  won-with-no-request deals; `buildTimeline` merges + sorts three source arrays
  correctly; `validateBookingInput` accepts a good payload and rejects missing-contact
  / bad-time / overlong; every prompt builder returns a string without throwing.
- ROLLBACK: delete `_shared/communication.ts`.

### T3: `review-request-draft` edge function (scan → draft, never sends)
- WHY: produce reviewable drafts for completed jobs without sending anything.
- FILES: `supabase/functions/review-request-draft/index.ts`
- DEPENDENCIES: T2, T1
- WORK:
  - [ ] Verify JWT (RLS-scoped client); accept `{ dealId? }` (single won deal) or scan
    all eligible when omitted.
  - [ ] `selectReviewEligibleDeals`; cap at `MAX_REVIEW_DRAFTS = 10` and report if
    capped; resolve `reviewLink` from the caller's `widget_config` (null-safe).
  - [ ] One Claude call (`emit_review_requests`, echoing `dealId`); insert one
    `review_requests` row per job (`status='draft'`, `channel`, `body`,
    `job_id = deal.id`, `contact_id`). Return `{ drafts: ReviewDraft[], scanned,
    capped }`.
- TEST: seed a `won` deal → invoke → returns ≥1 draft + a `review_requests` row
  `status='draft'` (verify via `execute_sql`); a won deal that already has a
  `review_requests` row is **not** re-drafted; **no** `interactions` row is created by
  drafting.
- ROLLBACK: delete the function (no destructive writes — only draft rows).

### T4: `review-request-send` edge function (never silent)
- WHY: the single guarded send path; enforces the hard rule for reviews.
- FILES: `supabase/functions/review-request-send/index.ts`
- DEPENDENCIES: T3
- WORK:
  - [ ] Verify JWT; accept **only** `{ reviewId }` (also read `review_id`). Missing /
    non-UUID → **HTTP 400** `'A valid reviewId from a prior review_request_draft is
    required.'`
  - [ ] Load the caller's row (RLS) → 404 if not found; require `status in (draft,
    approved)` → 409 otherwise; atomically claim `update({status:'sending'}).in(
    'status',['draft','approved'])` → 409 if already claimed (double-send guard).
  - [ ] Log an `interactions` row (`type = channel`, `content = body`, `ai_summary =
    'Review request sent'`); set the row `sent` + `sent_at`; on error `failed` +
    `review_notes`. Return `{ reviewId, contactId, interactionId, channel }`.
- TEST: send a valid draft → an `interactions` row created + row `sent` (verify via
  `execute_sql`); re-send → 409; bogus/foreign id → 404; empty body → 400; confirm
  **no send path exists without a `reviewId`**.
- ROLLBACK: delete the function.

### T5: `widget-public` edge function (public, token-scoped: FAQ + booking)
- WHY: the public entry point for the booking/FAQ widget — the only unauthenticated,
  service-role surface; must be scoped hermetically to the token's owner.
- FILES: `supabase/functions/widget-public/index.ts`; ensure
  `supabase/config.toml` has `[functions.widget-public]\nverify_jwt = false`
- DEPENDENCIES: T2, T1; decisions #6, #7
- WORK:
  - [ ] **No JWT.** Build a **service-role** client (`SUPABASE_SERVICE_ROLE_KEY`,
    auto-injected). Accept `{ token, mode: 'ask'|'book', question?, booking? }`.
  - [ ] Resolve `widget_config` by `public_token` → 404 if none or `is_enabled=false`.
    `owner = config.user_id`.
  - [ ] `mode:'ask'` → Claude via `buildWidgetMessage(config, question)`; return
    `{ answer }`. **No CRM read or write.** Never echo other rows or system text.
  - [ ] `mode:'book'` → `validateBookingInput`; find-or-create `contacts` scoped
    `user_id = owner` (dedupe by email), `source='widget'`; insert `appointments`
    (`user_id = owner`, `contact_id`, `start_time`/`end_time`, `status='requested'`,
    `notes`, `source='widget'`). Return `{ status:'requested', appointmentId }`.
    **Every insert hard-codes `user_id = owner`; any client-supplied `user_id` is
    ignored. Status is never `scheduled`.**
  - [ ] Permissive CORS for embedding (`Access-Control-Allow-Origin`); cap input sizes;
    log-and-generic-error on Anthropic/DB failure (never leak internals).
- TEST: with a valid token, `ask` returns an answer grounded in the config FAQ;
  `book` creates a `contacts(source='widget')` + `appointments(status='requested')`
  scoped to the owner (verify via `execute_sql`); unknown/disabled token → 404; a
  `book` payload carrying a **spoofed `user_id`** still writes under the token owner;
  `ask` never returns CRM rows.
- ROLLBACK: delete the function + remove the `config.toml` entry. Writes are additive
  (`requested` appointments) and owner-deletable.

### T6: MCP tools — review_request_draft + review_request_send
- WHY: expose the same guarded flow to MCP clients; enforce the hard rule at the tool
  layer. (The booking widget stays web-only — it is outside the locked tool list.)
- FILES: `apps/mcp-server/src/tools/reviews.ts`,
  `apps/mcp-server/src/data/reviews.ts`, `apps/mcp-server/src/server.ts`
- DEPENDENCIES: T3, T4
- WORK:
  - [ ] `review_request_draft { dealId? }` → `functions.invoke('review-request-draft')`
    (readOnly — drafts only); returns review ids + bodies.
  - [ ] `review_request_send { reviewId }` → `functions.invoke('review-request-send')`
    (write, `destructiveHint: true`); description: *"Required — an approved
    review_request_draft id. Nothing sends without it."* Unwrap edge JSON errors as in
    Phase 3/4.
  - [ ] Register `registerReviewTools(server)` in `server.ts` (7th group → 16 tools).
- TEST: `tsx` harness — draft(won deal) → `reviewId`; send(`reviewId`) → an interaction
  is logged (verify via `execute_sql`); send with missing/bad id → clean `fail(...)`
  (not a crash); `apps/mcp-server` typechecks.
- ROLLBACK: unregister `registerReviewTools`; delete the two files.

### T7: Web — unified AI-summarized timeline on contact detail
- WHY: the phase's most-visible surface and its signature AI moment; the contact detail
  page renders no timeline today.
- FILES: `apps/web/src/lib/api/interactions.ts`, `apps/web/src/lib/api/communication.ts`,
  `apps/web/src/hooks/useTimeline.ts`, `apps/web/src/lib/queryKeys.ts` (add
  `timeline`/`interactions` keys), `apps/web/src/components/comms/{ContactTimeline,
  TimelineEventRow,RelationshipSummary}.tsx`, `apps/web/src/routes/ContactDetail.tsx`
  (wire in); **and** `supabase/functions/contact-summary/index.ts` (folded in — small,
  tightly coupled)
- DEPENDENCIES: T1, T2
- WORK:
  - [ ] Reads (RLS): interactions + appointments + `review_requests` for a contact;
    merge with `buildTimeline` in the data layer; expose `useTimeline(contactId)`.
  - [ ] `contact-summary` edge fn: JWT; load the contact + its timeline sources;
    `buildSummaryMessage`; one Claude call; `update contacts set ai_summary,
    summary_updated_at`; return `{ summary, updatedAt }`.
  - [ ] `RelationshipSummary` panel (the one `.u-marker` signature moment) reads the
    cached `ai_summary`, with a **"Regenerate"** button → `contact-summary`;
    auto-generate when null. `ContactTimeline` renders the merged stream in a
    `.field-grid`/`.ticket` layout, `TimelineEventRow` per kind (icon, `type`/status
    badge via the `StageBadge` pattern, `occurred_at`). Derive all UI from locked
    tokens. Wire both into `ContactDetail.tsx` below the existing sections.
- TEST: a contact with interactions + an appointment renders a single sorted timeline;
  clicking Regenerate produces a summary that persists across reload (cached on the
  contact); a contact with no events shows a quiet empty state; responsive + visible
  focus + reduced-motion respected.
- ROLLBACK: revert `ContactDetail.tsx`; delete the new web files + the `contact-summary`
  function.

### T8: Web — review-request review queue (never-silent gate)
- WHY: the review-then-approve UI — the visible half of the hard rule; adds the
  Communication module.
- FILES: `apps/web/src/routes/Communication.tsx` (new route + `NAV` entry in
  `AppShell.tsx`), `apps/web/src/components/comms/{ReviewQueue,ReviewDraftCard}.tsx`,
  `apps/web/src/lib/api/reviews.ts` (`draftReviews(dealId?)`, `sendReview(reviewId)`),
  hooks as needed
- DEPENDENCIES: T3, T4, T7
- WORK:
  - [ ] Add the Communication route + nav item. **"Find jobs to request reviews"** →
    `review-request-draft`; render each draft with `ReviewDraftCard` (contact, deal
    title, channel, editable-optional body, why-flagged) — mirror `DraftCard`.
  - [ ] Per draft: **"Approve & send"** (explicit) → `review-request-send(reviewId)` →
    sent state; **"Dismiss"** discards. On send, invalidate the contact's
    timeline/interactions query (matches the mutation convention) so the review lands on
    the timeline.
- TEST: the scan lists a won deal's draft; Approve & send logs an interaction
  (`ai_summary='Review request sent'`), marks it sent, and it appears on that contact's
  timeline; Dismiss sends nothing; there is no bulk "send all without review".
- ROLLBACK: remove the route + nav entry + components + `api/reviews.ts`.

### T9: Web — booking/FAQ widget (public page + Settings config)
- WHY: the third deliverable — the owner configures the widget; a public visitor uses
  it. Two surfaces, one feature.
- FILES: `apps/web/src/routes/Widget.tsx` (**public** route `/widget/:token`, added
  outside `<ProtectedRoute>` in `App.tsx`), `apps/web/src/components/widget/{WidgetChat,
  BookingForm}.tsx`, `apps/web/src/lib/api/widget.ts` (public: `askWidget(token,
  question)`, `bookWidget(token, booking)` via `functions.invoke('widget-public')`),
  `apps/web/src/lib/api/widgetConfig.ts` + `apps/web/src/hooks/useWidgetConfig.ts`
  (authed CRUD of `widget_config`), config UI added to `apps/web/src/routes/Settings.tsx`
- DEPENDENCIES: T5, T1
- WORK:
  - [ ] Public `/widget/:token` page (no auth, no AppShell): a compact FAQ chat →
    `askWidget`, and a `BookingForm` (name, email/phone, requested time, note) →
    `bookWidget` → a "request received — we'll confirm" state. Derive styling from the
    locked tokens; it must stand alone without the app shell.
  - [ ] Settings: an authenticated form editing `widget_config` (`business_name`,
    `services`, `hours`, `faq`, `review_link`, `is_enabled`), showing the read-only
    **public widget URL** (`/widget/<public_token>`) with copy-to-clipboard. Persist +
    reload.
- TEST: Settings saves the config and it reloads persisted; visiting `/widget/<token>`
  (valid, enabled) answers an FAQ grounded in the configured text and submits a booking
  → confirmation; the resulting `status='requested'` appointment is visible to the owner
  (on the contact timeline / via REST); a disabled/unknown token shows a friendly
  unavailable state.
- ROLLBACK: remove the public route + widget components + `api/widget.ts` +
  `api/widgetConfig.ts` + the Settings config block.

### T10: E2E — timeline + review request + widget + never-silent guard (Playwright)
- WHY: prove all three features at runtime, and that a review can't be sent without an
  approved draft.
- FILES: `apps/web/e2e/communication.spec.ts` (+ a seed/fixture helper for a won deal,
  interactions, and a `widget_config` row via REST, reusing the spec `login`/`resetData`
  helpers)
- DEPENDENCIES: T7, T8, T9
- WORK:
  - [ ] Log in (seeded `e2e-fieldbase@mailinator.com`); reset. Seed a contact with
    interactions + an appointment → open the contact → assert the merged timeline
    renders and a relationship summary generates.
  - [ ] **Guard 1:** on Communication before any scan, `getByRole('button',{name:/
    approve & send/i})` has count 0. **Guard 2:** inside `page.evaluate`, read the
    supabase auth token from `localStorage` and `fetch('${url}/functions/v1/
    review-request-send',{method:'POST',body:JSON.stringify({})})` → expect status
    **400** (exact analog of the P4 `followup-send` guard).
  - [ ] Seed a `won` deal → run the scan → assert a review draft renders → Approve &
    send → assert an `interactions` row (`ai_summary='Review request sent'`) appears on
    the contact timeline.
  - [ ] Widget: seed a `widget_config` (known token) via REST → navigate to
    `/widget/<token>` → ask an FAQ (assert a non-empty grounded answer) → submit a
    booking → assert a `status='requested'` appointment row exists for the owner (via
    REST).
- TEST: `cd apps/web && npm run e2e -- communication.spec.ts` passes headless — report
  the actual run output.
- ROLLBACK: remove the spec + fixture helper.

## Critical path
T1 → T2 → T3 → T4 (the review spine). T1 → T2 → T5 (widget backend). Then the web
tracks — T7 (timeline, incl. `contact-summary`), T8 (review queue, needs T3/T4/T7),
T9 (widget UI, needs T5) — and T6 (MCP, needs T3/T4) run in parallel; T10 last.

## Parallelizable
- After T2: the review chain (T3 → T4), the widget backend (T5), and the timeline
  reads/`contact-summary` (T7) are independent.
- After T4: the MCP tools (T6) and the review-queue UI (T8) are independent tracks.
- T9 (widget UI) only needs T5; it can proceed alongside T6/T7/T8.

## Assumptions & risks
- ASSUMPTION: `ANTHROPIC_API_KEY` remains set as a function secret; `SUPABASE_SERVICE_
  ROLE_KEY` is auto-injected into edge functions. Detect: draft/summary/widget 500/503,
  or `widget-public` 401/403 on the service client. Mitigation: clear "AI unavailable"
  / "widget unavailable" errors; never leak internals.
- RISK (**highest — the security boundary**): `widget-public` runs unauthenticated with
  the service-role key (RLS bypassed). A scoping bug could read or write another user's
  data. Mitigation: the function resolves exactly one `widget_config` by token, derives
  `owner` from it, and **hard-codes `user_id = owner` on every insert while ignoring any
  client-supplied id**; the `ask` path performs **zero** CRM reads/writes; bookings are
  only ever `status='requested'`; the T5 test asserts a spoofed `user_id` cannot escape
  the owner and that `ask` returns no CRM rows. Deploy is `--no-verify-jwt` **only** for
  this one function; all others keep JWT verification. Consider a `security-review` on
  the T5 diff before deploy.
- RISK: the review-eligibility predicate over-/under-selects (e.g. re-requesting a
  completed job). Mitigation: `selectReviewEligibleDeals` is a pure, `tsx`-verified
  function keyed on `stage='won'` + no existing non-`failed` `review_requests` for the
  deal; drafting is capped and reported.
- RISK: double-send race on a review. Mitigation: the atomic `draft/approved → sending`
  claim (identical to `followup-send`); re-send rejected 409.
- RISK: Claude drafts an off-tone review ask, or the widget answers off-topic / leaks.
  Mitigation: nothing sends without human review (body shown, optionally editable); the
  widget is grounded only in `widget_config` with a refuse-out-of-scope system prompt
  and no CRM access.
- RISK: `database.types.ts` is stale (missing `followup_drafts`); adding typed access to
  `review_requests`/`widget_config` could mis-type. Mitigation: T1 regenerates the types
  before any typed client touches the new columns.
- RISK: a public route (`/widget/:token`) accidentally sits behind `ProtectedRoute` (or
  loads the app shell). Mitigation: it is declared in the public block of `App.tsx`
  alongside `/login` and `/design-tokens`; T10 exercises it unauthenticated.

## Out of scope (Phase 5)
Real SMS/email/telephony (review sends stay simulated as interactions); scheduled/
background sends; the widget auto-confirming appointments or writing deals; a rich
calendar/availability engine (bookings are free-form requested times the owner
confirms); real review-platform (Google/Facebook) integration or verifying a review was
left; a message-template system; analytics / NL query bar (Phase 6); multi-tenant widget
theming, captcha/anti-abuse hardening, and deploy (Phase 7).
