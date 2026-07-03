# Plan: FieldBase Phase 1 — Core CRM

Date: 2026-07-03
Depends on: Phase 0 (complete). Scope from roadmap item 1: **contacts CRUD +
pipeline kanban**.

## Goal
A logged-in user can manage contacts (list, search, create, edit, view, delete)
and work a deal pipeline as a kanban board (deals grouped by stage, drag to move
stage, create/edit deals) — all persisted to Supabase under RLS, styled with the
locked design tokens, and proven end-to-end with a real browser test.

## Already in place (Phase 0)
- Supabase schema: `contacts`, `deals` (+5 more), RLS owner policies,
  `updated_at` triggers, FK/owner indexes.
- Auth (login/signup, protected routes), app shell with `Contacts` and
  `Pipeline` placeholder routes, design tokens + motif, `shared-types`
  (`ContactSchema`).

## Open decisions — confirm before building (first option = my recommendation)
1. **Server state:** TanStack Query (caching, loading/error states, optimistic
   mutations) — vs plain `useState`/`useEffect` hooks.
2. **Drag-and-drop:** `dnd-kit` (accessible, keyboard support) — vs
   `@hello-pangea/dnd`.
3. **Sample data:** in-app "Load sample data" action in Settings (uses the
   auth session, RLS-safe, demoable) — vs a Node/SQL seed script.
4. **Contact detail:** dedicated route `/contacts/:id` (deep-linkable) — vs a
   slide-over drawer.
5. **E2E:** add Playwright (backfills the Phase 0 UI TESTs too). Needs one
   pre-confirmed seed user — email confirmation is ON, so the test confirms the
   user via SQL or a saved storage-state.
6. **DB types location:** `apps/web/src/lib/database.types.ts` now; promote to
   `shared-types` when the MCP server needs them (Phase 2).

---

## Tasks

### Task 1: Typed Supabase data-access layer
- WHY: every CRM screen needs typed, RLS-scoped reads/writes; hand-typed rows
  drift from the schema.
- FILES: `apps/web/src/lib/database.types.ts` (generated), `apps/web/src/lib/api/contacts.ts`, `apps/web/src/lib/api/deals.ts`
- DEPENDENCIES: Phase 0
- WORK:
  - [ ] Generate DB types from the `fieldbase` project; commit them
  - [ ] Type the Supabase client with `Database` generics
  - [ ] Contacts + deals query/mutation helpers (list/get/create/update/delete,
    move-stage); rely on RLS + `user_id` default for ownership
- TEST: a throwaway call reads contacts for the logged-in user and typechecks;
  `npm run typecheck -w @fieldbase/web` clean
- ROLLBACK: delete the api/ + types files (nothing consumes them yet)

### Task 2: Server-state infrastructure (TanStack Query)
- WHY: consistent caching, loading/error states, and optimistic updates for a
  snappy CRUD + kanban feel.
- FILES: `apps/web/src/lib/queryClient.ts`, `apps/web/src/main.tsx`, `apps/web/src/hooks/useContacts.ts`, `apps/web/src/hooks/useDeals.ts`
- DEPENDENCIES: Task 1
- WORK:
  - [ ] Install `@tanstack/react-query`; wrap app in `QueryClientProvider`
  - [ ] Query-key conventions; base `useContacts`/`useDeals` read hooks
  - [ ] Mutation hooks with cache invalidation
- TEST: a temporary probe component renders a live contact count from
  `useContacts` without errors; build clean
- ROLLBACK: remove provider + hooks

### Task 3: Sample-data loader
- WHY: the demo needs realistic data; also exercises writes under RLS.
- FILES: `apps/web/src/lib/sampleData.ts`, `apps/web/src/routes/Settings.tsx`
- DEPENDENCIES: Task 1
- WORK:
  - [ ] ~20 fake service-SMB contacts + deals across all stages (fake data only)
  - [ ] Settings "Load sample data" + "Clear my data" actions (current user only)
- TEST: click Load → contacts and deals exist for the user (verify via a
  `select count(*)`); Clear → back to zero
- ROLLBACK: remove the action + file

### Task 4: Contacts list
- WHY: the primary CRM surface.
- FILES: `apps/web/src/routes/Contacts.tsx` (replace placeholder), `apps/web/src/components/contacts/ContactsTable.tsx`
- DEPENDENCIES: Task 2 (+ Task 3 for visible data)
- WORK:
  - [ ] Table: name, company, phone, email, tags
  - [ ] Search/filter by name/company/email; loading, empty, and error states
  - [ ] "New contact" entry point; row → detail
- TEST: seeded contacts render; typing in search filters the list; empty state
  shows when no matches
- ROLLBACK: restore the placeholder page

### Task 5: Create / edit contact
- WHY: the C and U of contacts CRUD.
- FILES: `apps/web/src/components/contacts/ContactForm.tsx`, `apps/web/src/hooks/useContactMutations.ts`
- DEPENDENCIES: Task 4
- WORK:
  - [ ] Drawer/modal form; validate with a zod schema derived from `shared-types`
  - [ ] Create + edit; optimistic update + invalidate; inline field errors
- TEST: creating a contact adds a row scoped to the user; editing persists after
  reload; invalid input (bad email) is blocked with a message
- ROLLBACK: remove the form + hook; list stays read-only

### Task 6: Contact detail + delete
- WHY: the R and D of CRUD; detail is where the AI timeline lands later.
- FILES: `apps/web/src/routes/ContactDetail.tsx` (route `/contacts/:id`), `apps/web/src/components/ConfirmDialog.tsx`
- DEPENDENCIES: Task 4, Task 5
- WORK:
  - [ ] Detail view: contact fields + that contact's deals
  - [ ] Delete behind a confirm dialog (destructive → explicit confirm)
- TEST: detail shows the right contact + its deals; delete (after confirming)
  removes it and returns to the list; cancel keeps it
- ROLLBACK: remove the route + dialog

### Task 7: Pipeline board (read-only kanban)
- WHY: the second core surface — see deals by stage at a glance.
- FILES: `apps/web/src/routes/Pipeline.tsx` (replace placeholder), `apps/web/src/components/pipeline/{Board,Column,DealCard}.tsx`
- DEPENDENCIES: Task 2 (+ Task 3 for data)
- WORK:
  - [ ] Columns for each stage (lead → qualified → proposal → negotiation → won
    → lost); deal cards grouped by stage
  - [ ] Per-column count + value total; loading/empty states
- TEST: seeded deals appear in the correct columns; column totals match a
  `sum(value)` query
- ROLLBACK: restore the placeholder page

### Task 8: Deal create/edit + drag-to-move-stage
- WHY: moving deals across stages is the signature pipeline interaction (mirrors
  the future `crm_move_deal_stage` MCP tool).
- FILES: pipeline components, `apps/web/src/components/pipeline/DealForm.tsx`, `apps/web/src/hooks/useDealMutations.ts`
- DEPENDENCIES: Task 7 (+ Task 6 to link deals to contacts)
- WORK:
  - [ ] Install `dnd-kit`; drag a card between columns → persist new stage
    (optimistic, rollback on error)
  - [ ] Create/edit deal (title, contact, value, probability, stage)
- TEST: drag a card to another column → reload keeps the new stage; create/edit
  deal persists; keyboard drag works
- ROLLBACK: disable dnd (static board), remove deal form

### Task 9: End-to-end smoke (Playwright)
- WHY: prove the CRUD + kanban flows work at runtime — the verification gap left
  open in Phase 0.
- FILES: `apps/web/playwright.config.ts`, `apps/web/e2e/crm.spec.ts`, seed/auth helper
- DEPENDENCIES: Tasks 4–8
- WORK:
  - [ ] Install Playwright + a browser; pre-confirm a seed user (SQL or saved
    storage state) since email confirmation is ON
  - [ ] Spec: unauthenticated `/` redirects to `/login`; log in; create a
    contact and see it listed; create a deal; drag it to another stage and
    assert persistence; nav routes + active state highlight
- TEST: `npx playwright test` passes headless — report the actual run
- ROLLBACK: remove `e2e/` + config

---

## Critical path
1 → 2 → 4 → 5 → 6, and 2 → 7 → 8; then 9 last.

## Parallelizable
Task 3 (sample data) right after Task 1. Pipeline (7 → 8) can run alongside
contacts (4 → 6) once Tasks 1–2 land.

## Assumptions & risks
- ASSUMPTION: email confirmation stays ON. Detect: seed user can't log in in
  the E2E. Mitigation: confirm via SQL in the test setup, or toggle it off.
- ASSUMPTION: current MCP connection keeps access to `fieldbase`. Detect:
  `get_project` permission error. Mitigation: reconnect the connector.
- RISK: drag-and-drop + optimistic stage moves can desync from the server.
  Mitigation: invalidate on settle; rollback on mutation error.

## Out of scope (Phase 1)
AI summaries / NL query, interactions-timeline content, migration wizard,
automations, the MCP CRUD tools (Phase 2), review requests, and appointments UI.
