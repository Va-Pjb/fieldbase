# FieldBase — AI-native CRM for service SMBs

Personal portfolio project. NOT connected to Proximity Plumbing — use only
seed/fake data, never real business data.

## What this is
An AI-native CRM for service-based SMBs (trades, clinics, home-service
businesses), with an MCP server as the hero feature: any MCP client
(Claude Desktop, Claude Code, etc.) can query and operate the CRM directly.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind (`apps/web`)
- Backend: Supabase — Postgres + Auth + RLS + Edge Functions
- AI: Anthropic API, model `claude-sonnet-5`
- MCP server: Node + TypeScript, `@modelcontextprotocol/sdk`,
  streamable HTTP transport (`apps/mcp-server`)

## Hard rules
- Destructive MCP tools (`migration_execute`, `followup_send`,
  `review_request_send`) never fire standalone — each requires an id
  produced by a prior preview/draft call. No silent one-shot sends, ever.
- Design tokens get locked in Phase 0 Task 4 — don't introduce new
  colors/fonts ad hoc later; extend the token system instead.
- Build phase by phase, per `plans/2026-07-03-architecture-and-phase0.md`.
  Don't jump ahead to a later phase's features before the current phase's
  tasks are done and tested.
- No task should run longer than ~30 minutes of focused work. If one is
  ballooning, stop and split it before continuing.
- Before creating any new cloud resource (Supabase project, deployment
  target, etc.), first confirm which account/org is currently authenticated,
  and get my explicit confirmation that it's the intended one before
  proceeding. Never create cloud resources against an unverified account.

## Where to look
- Full architecture, data model, complete 15-tool MCP list, and Phase 0's
  detailed task-by-task breakdown: `plans/2026-07-03-architecture-and-phase0.md`
- Phases 1–7 are intentionally not detailed yet — write each phase's task
  breakdown right before starting it, using the same template as Phase 0
  (WHY / FILES / DEPENDENCIES / WORK / TEST / ROLLBACK).

## Start here
Read the plan file above in full, then execute Phase 0 Task 1 through
Task 6, in order (Task 4 and Task 6 can run in parallel with each other).
Confirm each task's TEST criteria passes before moving to the next.

## Execution policy
- Run all tasks in a phase continuously — don't stop to ask permission
  between tasks.
- Commit after each task.
- Stop and ask only when one of these is true:
  - a task's TEST criteria fails and can't be fixed within that task,
  - you hit a real decision the plan doesn't cover, or
  - the whole phase is complete.
- A task finishing without errors is NOT the same as it being correct.
  Verify against the task's TEST line before moving on.
