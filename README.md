# FieldBase

**An AI-native CRM for service businesses — built so any MCP client can operate it directly.**

FieldBase is a customer-relationship platform for trades, clinics, and home-service companies. What makes it different isn't a chatbot bolted onto a CRM — it's that the entire system is reachable through a **Model Context Protocol (MCP) server**. An MCP client like Claude Desktop can read the pipeline, create contacts, migrate messy spreadsheets, and draft follow-ups by talking to the same backend the web app uses.

Every AI action that changes or sends anything is **never-silent**: the AI proposes, a human approves, and only then does it execute. That rule is enforced in four independent places, not just the UI.

> **Note:** This is a portfolio project built with seed data. It is not connected to any real business.

---

## Why it exists

Service SMBs run on generic CRMs or spreadsheets that don't understand field operations — every record is typed by hand, nothing reasons over the data, and the tools are disconnected from how the AI assistants people increasingly live in. FieldBase is an attempt at the opposite: a CRM where the AI layer is the primary interface, and where the underlying data model is exposed cleanly enough that an external agent can drive it end to end.

---

## What it does

**Core CRM** — Contacts and a drag-to-move deal pipeline (kanban), each scoped per user with row-level security.

**MCP server (the centerpiece)** — 16 tools over streamable HTTP that expose the full CRM surface: list/create/update contacts, log interactions, read and move the pipeline, run natural-language queries, run guarded data migrations, create automations, and draft/send follow-ups and review requests. Any MCP client can connect and operate FieldBase without touching the web UI.

**AI migration wizard** — Upload a messy CSV plus a plain-English instruction ("import these as contacts, skip archived rows"). The AI proposes a field-mapping plan, you review it, and only an explicit approval writes anything. There is no file-to-import shortcut anywhere in the system.

**AI automation layer** — Describe an automation in plain English and the AI turns it into a validated, structured rule (never arbitrary code). A missed-lead scanner drafts personalized follow-ups for cold leads — drafts only, never auto-sent.

**Communication** — A unified, AI-summarized activity timeline on each contact; a review-request queue (draft → approve → send); and a public booking/FAQ widget that answers questions and captures booking requests.

**Insights** — A natural-language query bar ("total value of won deals by stage") powered by the same validated-query engine as the MCP tool, plus an analytics dashboard with bespoke charts.

---

## The never-silent guarantee

Anything that writes irreversibly or sends a message follows the same spine:

1. A **draft/preview** step produces a stored record and returns its id.
2. The **execute/send** step accepts *only* that id — never raw input, never a one-shot path.
3. It verifies caller ownership and correct status, claims the record atomically (so it can't double-fire), performs the action, and logs it.

This is enforced at the **edge function**, the **MCP tool**, the **web UI**, and a **direct network call** — verified by end-to-end tests that assert a send is impossible without a prior approved draft.

---

## Architecture

```
┌─────────────────┐        ┌─────────────────┐
│   Web app       │        │  MCP client     │
│ (React + Vite)  │        │ (Claude, etc.)  │
└────────┬────────┘        └────────┬────────┘
         │                          │
         │                          │  streamable HTTP
         │                          ▼
         │                 ┌─────────────────┐
         │                 │   MCP server    │
         │                 │ (Node + TS,     │
         │                 │  16 tools, Zod) │
         │                 └────────┬────────┘
         │                          │
         │   both call the same     │
         │   backend & business     │
         ▼   logic                  ▼
   ┌───────────────────────────────────────┐
   │        Supabase                        │
   │  Postgres + Row-Level Security + Auth  │
   │  Edge Functions (shared core logic)    │
   └───────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Anthropic API     │
         │  (Claude — planning,│
         │   NL→rule, drafting)│
         └─────────────────────┘
```

**Key design choices**
- **Shared business logic.** Migration, automation, and communication logic each lives once in a shared module that both the edge functions and MCP tools call — no duplicated, drift-prone implementations.
- **Never raw SQL from AI.** Natural-language queries become a field-whitelisted, validated plan that a typed query builder executes. The AI never emits SQL, and the query path is read-only.
- **RLS everywhere.** The MCP server acts as a normal RLS-scoped user, not a privilege-bypassing service role. The one public surface (the booking widget) is a hermetically scoped, rate-limited service-role function that does zero CRM reads and can only ever create `requested`-status bookings for a human to confirm.
- **Bespoke UI.** Charts and layout are built from a locked design-token system rather than a chart library, for a deliberate, non-templated look.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind |
| Backend | Supabase — Postgres, Auth, Row-Level Security, Edge Functions |
| MCP server | Node, TypeScript, `@modelcontextprotocol/sdk`, Zod, streamable HTTP |
| AI | Anthropic API (Claude) |
| Testing | Playwright (end-to-end) |

Monorepo via npm workspaces: `apps/web`, `apps/mcp-server`, `packages/shared-types`.

---

## MCP tools

| Tool | Kind | Purpose |
|---|---|---|
| `crm_list_contacts` / `crm_get_contact` | read | Browse contacts |
| `crm_create_contact` / `crm_update_contact` | write | Manage contacts |
| `crm_log_interaction` | write | Record an interaction |
| `crm_get_pipeline` | read | Pipeline totals by stage |
| `crm_move_deal_stage` | write | Move a deal (idempotent) |
| `crm_query` | read | Natural-language → validated query |
| `migration_preview` | read | Propose an import plan from a CSV |
| `migration_execute` | write | Execute an import (requires a preview id) |
| `automation_create` / `automation_list` | write / read | Plain-English → validated automation rule |
| `followup_draft` / `followup_send` | read / write | Draft, then send (send requires a draft id) |
| `review_request_draft` / `review_request_send` | read / write | Draft, then send a review request (send requires a draft id) |

---

## Running locally

**Prerequisites:** Node.js, a Supabase project, and an Anthropic API key.

```bash
# Install
npm install

# Environment (not committed — see below)
# apps/web/.env.local      → Supabase URL + anon key
# apps/mcp-server/.env     → Supabase + ANTHROPIC_API_KEY
# ANTHROPIC_API_KEY also set as a Supabase Edge Function secret

# Run the web app  →  http://localhost:5173
npm run dev:web

# Run the MCP server  →  http://localhost:3000/mcp
npm run dev:mcp

# End-to-end tests
npm run e2e -w @fieldbase/web
```

**Connect an MCP client** (e.g. Claude Code):
```bash
claude mcp add --transport http fieldbase http://localhost:3000/mcp
```

Secrets live only in gitignored `.env` files and are never committed.

---

## Project status

Built in phases, each committed and covered by end-to-end tests:

- Scaffolding — monorepo, schema, auth, design system, MCP skeleton
- Core CRM — contacts, pipeline
- MCP server — full tool surface
- AI migration wizard
- AI automation layer
- Communication — timeline, review requests, booking widget
- Insights — NL query bar, analytics dashboard

---

## Author

Built by **Workwithpj** as a portfolio project exploring MCP-native application design.
