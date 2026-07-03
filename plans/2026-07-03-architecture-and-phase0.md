# Plan: FieldBase — AI-Native CRM for Service SMBs
Date: 2026-07-03
Working name only — rename freely for the portfolio.

Source spec: Personal portfolio project. AI-native CRM for service-based SMBs
(trades, clinics, home-service businesses). MCP server is the hero feature —
any MCP client can query and operate the CRM directly. Includes an AI
migration wizard (plan → preview → execute, never silent) and two GHL-inspired
automation "recipes" reimagined AI-natively (missed-lead auto-follow-up,
plain-English automation builder) — without cloning GHL's full breadth
(no funnels, telephony, social scheduling, membership hosting, or white-label
multi-tenant billing).

## Goal
A working, demoable, visually distinctive CRM where a prospective client sees:
real contact/pipeline management, an AI-driven migration wizard, AI-native
automations, and a live MCP server any MCP client can connect to and operate.

## Approach
Monorepo: React/Vite frontend, Supabase for auth + Postgres + RLS, a standalone
TypeScript MCP server (streamable HTTP) exposing the same operations the UI
uses, and Claude (`claude-sonnet-5`) doing the reasoning work — migration
planning, natural-language → automation-rule translation, follow-up drafting,
natural-language → query. Build phase by phase; each phase ships and is
demoable before the next starts.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind — fast to build, pairs with a
  deliberate, non-templated design system (see frontend-design principles)
- Backend: Supabase — Postgres + Auth + Row-Level Security + Edge Functions
- AI: Anthropic API, model `claude-sonnet-5`
- MCP Server: Node + TypeScript, `@modelcontextprotocol/sdk`, Zod schemas,
  streamable HTTP transport (remote-reachable, per MCP best practices)
- Hosting (later phase): frontend on Vercel, Supabase managed, MCP server as
  its own small Node service

## Data model (Postgres)
- `contacts`: id, name, phone, email, company, source, tags text[],
  created_at, updated_at
- `deals`: id, contact_id fk, title, stage, value, probability, created_at
- `interactions`: id, contact_id fk, type (call/email/note/sms), content,
  ai_summary, occurred_at
- `automations`: id, name, trigger_type, trigger_config jsonb, action_type,
  action_config jsonb, natural_language_source text, is_active bool
- `migration_jobs`: id, status, source_filename, mapping_plan jsonb,
  review_notes jsonb, executed_at
- `review_requests`: id, contact_id fk, job_id, status, sent_at
- `appointments`: id, contact_id fk, start_time, end_time, status
- Auth via Supabase `auth.users`; every table RLS-scoped to its owning user

## MCP tool list (domain-prefixed, per MCP naming conventions)
| Tool | Type | Notes |
|---|---|---|
| crm_list_contacts | readOnly | paginated, filterable |
| crm_get_contact | readOnly | |
| crm_create_contact | write | |
| crm_update_contact | write | |
| crm_log_interaction | write | |
| crm_query | readOnly | natural language → structured results |
| crm_get_pipeline | readOnly | |
| crm_move_deal_stage | write, idempotent | |
| migration_preview | readOnly | file + plain-English instructions → plan |
| migration_execute | write, destructive | requires a prior preview id |
| automation_create | write | plain-English → structured rule |
| automation_list | readOnly | |
| followup_draft | readOnly | generates draft only, never sends |
| followup_send | write, destructive | requires an approved draft id |
| review_request_send | write, destructive | |

Rule: destructive tools never fire standalone — each requires an id produced
by a prior preview/draft call. No silent one-shot sends, ever.

## UI modules
Dashboard · Contacts (list + detail with unified AI-summarized timeline) ·
Pipeline (kanban) · Automations (list + NL builder) · Migration (import
wizard) · Settings

## Phase roadmap (each phase is its own ≤10-task plan)
0. Scaffolding — repo, schema, auth, design tokens, app shell, MCP skeleton
1. Core CRM — contacts CRUD, pipeline kanban
2. MCP server buildout — remaining CRM tools, verified in MCP Inspector
3. AI Migration Wizard — preview/execute flow + UI
4. AI Automation layer — plain-English builder + missed-lead follow-up
5. Communication — unified timeline, review requests, booking widget
6. Insights — NL query bar, analytics dashboard
7. Design polish + deploy + case-study capture (screenshots/demo clip)

Only Phase 0 is detailed below. Later phases get their own detailed task list
right before they start — detailing them now would be speculative (YAGNI):
earlier phases may change what later ones need.

## Phase 0 tasks

### Task 1: Initialize monorepo structure
- WHY: frontend, MCP server, and shared types need clean separation before
  any feature work starts
- FILES: new repo — `apps/web`, `apps/mcp-server`, `packages/shared-types`,
  root `package.json` (workspaces), `.gitignore`, `README.md`
- DEPENDENCIES: none
- WORK:
  - [ ] Set up npm workspaces at root
  - [ ] Scaffold Vite + React + TS in `apps/web`
  - [ ] Scaffold Node + TS in `apps/mcp-server`
  - [ ] Create `packages/shared-types` for shared Zod schemas
- TEST: `npm install` succeeds at root; both apps boot with a placeholder
  page/log
- ROLLBACK: delete repo — nothing external created yet

### Task 2: Provision Supabase schema
- WHY: every feature depends on the data model existing
- FILES: new `supabase/migrations/0001_init.sql`
- DEPENDENCIES: Task 1
- WORK:
  - [ ] Create all 7 tables above
  - [ ] Enable RLS on each
  - [ ] Write "owner can CRUD own rows" policies
- TEST: migration runs clean; tables + RLS confirmed in Supabase dashboard
- ROLLBACK: `supabase migration down`

### Task 3: Wire up Supabase Auth
- WHY: every screen needs a logged-in user before data can be scoped
  correctly
- FILES: `apps/web/src/lib/supabaseClient.ts`, `apps/web/src/auth/*`
- DEPENDENCIES: Task 2
- WORK:
  - [ ] Add Supabase JS client
  - [ ] Build login/signup screen
  - [ ] Build protected-route wrapper
- TEST: can sign up, log in, log out; unauthenticated user redirected away
  from protected routes
- ROLLBACK: leave routes public temporarily, remove wrapper

### Task 4: Lock design system tokens
- WHY: decide the visual identity once, early, so nothing drifts later
  (per frontend-design principle)
- FILES: `apps/web/tailwind.config.ts`, `apps/web/src/styles/tokens.css`
- DEPENDENCIES: Task 1
- WORK:
  - [ ] Define 4–6 named hex colors
  - [ ] Define type scale (display / body / mono)
  - [ ] Define one signature visual motif
- TEST: a `/design-tokens` preview route renders every color/type style
  correctly
- ROLLBACK: revert to Tailwind defaults

### Task 5: Build app shell
- WHY: every module needs a consistent frame before it's built
- FILES: `apps/web/src/components/AppShell.tsx`, `apps/web/src/routes/*`
- DEPENDENCIES: Task 3, Task 4
- WORK:
  - [ ] Sidebar nav (Dashboard, Contacts, Pipeline, Automations, Migration,
    Settings)
  - [ ] React Router setup
  - [ ] Empty placeholder page per module
- TEST: every sidebar item routes to its placeholder; active state
  highlights correctly
- ROLLBACK: none needed — purely additive

### Task 6: Scaffold MCP server skeleton
- WHY: prove the end-to-end MCP connection works before adding 14 more tools
- FILES: `apps/mcp-server/src/index.ts`, `apps/mcp-server/src/server.ts`
- DEPENDENCIES: Task 1
- WORK:
  - [ ] Initialize `@modelcontextprotocol/sdk` server, streamable HTTP
    transport
  - [ ] Register one stub tool: `crm_list_contacts` (hardcoded response)
- TEST: `npx @modelcontextprotocol/inspector` connects and lists/calls the
  stub tool successfully
- ROLLBACK: none needed — isolated new service

## Critical path
Task 1 → Task 2 → Task 3 → Task 5

## Parallelizable
Task 4 (design tokens) and Task 6 (MCP skeleton) can both run right after
Task 1, independently of Task 2/3 and of each other.

## Assumptions & risks
- ASSUMPTION: Supabase free tier is sufficient for a demo
  - If broken: rate-limit errors during heavy testing
  - Detect via: failed requests in dev console
  - Mitigation: low risk for demo-level traffic; upgrade tier if needed
- ASSUMPTION: streamable HTTP MCP server connects cleanly to real MCP
  clients (Claude Desktop/Code) without extra auth infra for a demo
  - If broken: client can't connect or list tools
  - Detect via: MCP Inspector test in Task 6
  - Mitigation: document a local stdio fallback for the demo video if
    hosted HTTP proves unreliable
- ASSUMPTION: all data is seeded/fake, never real Proximity data
  - If broken: confidentiality issue
  - Detect via: already confirmed in this conversation
  - Mitigation: none needed — already agreed

## Out of scope (v1)
Funnel/website builder, live SMS/voice telephony, social media scheduling,
membership/course hosting, white-label multi-tenant + billing, payments,
multi-tenant auth beyond a single-user demo.
