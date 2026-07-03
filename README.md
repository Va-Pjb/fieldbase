# FieldBase

AI-native CRM for service-based SMBs (trades, clinics, home-service businesses).
The hero feature is an **MCP server** any MCP client (Claude Desktop, Claude
Code, etc.) can connect to and use to query and operate the CRM directly.

> Personal portfolio project. **Not** connected to any real business — seed/fake
> data only.

## Monorepo layout

| Path | Package | What |
|---|---|---|
| `apps/web` | `@fieldbase/web` | React + Vite + TypeScript + Tailwind frontend |
| `apps/mcp-server` | `@fieldbase/mcp-server` | Node + TS MCP server (streamable HTTP) |
| `packages/shared-types` | `@fieldbase/shared-types` | Shared Zod schemas / types |
| `supabase/` | — | Postgres migrations (Supabase: Auth + RLS + DB) |

## Stack
- **Frontend:** React + Vite + TypeScript + Tailwind
- **Backend:** Supabase — Postgres + Auth + Row-Level Security + Edge Functions
- **AI:** Anthropic API, model `claude-sonnet-5`
- **MCP:** Node + TypeScript, `@modelcontextprotocol/sdk`, streamable HTTP transport

## Getting started

```bash
npm install          # install all workspaces
npm run dev:web      # start the web app (Vite dev server)
npm run dev:mcp      # start the MCP server
```

## MCP server (hero feature)

The `@fieldbase/mcp-server` exposes the CRM over streamable HTTP so any MCP
client can query and operate it — 8 `crm_*` tools (contacts CRUD, interactions,
pipeline, move-deal-stage, and a natural-language `crm_query`). It signs in as a
dedicated, RLS-scoped demo user (no service-role key). Setup, the tool list, and
client-connection instructions: **`apps/mcp-server/README.md`**.

```bash
npm run dev:mcp                                                   # start it
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --method tools/list
```

## Development

Built phase by phase. See `plans/2026-07-03-architecture-and-phase0.md` for the
architecture, data model, full MCP tool list, and per-task breakdown, and
`CLAUDE.md` for hard rules and execution policy.
