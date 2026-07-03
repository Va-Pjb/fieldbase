# FieldBase MCP server

The hero feature: a standalone MCP server that exposes FieldBase's CRM over
**streamable HTTP**, so any MCP client (Claude Desktop, Claude Code, the MCP
Inspector) can query and operate the CRM directly.

Every operation runs through a **dedicated demo user** the server signs in as at
startup — all reads/writes are RLS-scoped to that user, and **no service-role
key** is used, so the server is safe to expose. Fake/seed data only.

## Tools (8)

| Tool | Type | What it does |
|---|---|---|
| `crm_list_contacts` | readOnly | List contacts, optional `search` / `limit` |
| `crm_get_contact` | readOnly | One contact + its deals + recent interactions |
| `crm_create_contact` | write | Create a contact |
| `crm_update_contact` | write | Update a contact (only provided fields) |
| `crm_log_interaction` | write | Log a call/email/note/sms on a contact |
| `crm_get_pipeline` | readOnly | Deals grouped by stage with counts + value totals |
| `crm_move_deal_stage` | write · idempotent | Move a deal to a new stage |
| `crm_query` | readOnly | Natural-language → validated structured query (Claude; never raw SQL) |

## Setup

```bash
cp .env.example .env        # then fill it in
npm install                 # from the repo root (workspaces)
```

`.env` values:

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_ANON_KEY` | yes | Publishable/anon key (public) |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | yes | A **confirmed** user; the server signs in as this identity |
| `ANTHROPIC_API_KEY` | only for `crm_query` | The other 7 tools work without it |
| `PORT` | no | Defaults to 3000 |

## Run

```bash
npm run start -w @fieldbase/mcp-server   # or: npm run dev  (tsx watch)
# → listening on http://localhost:3000/mcp
```

## Connect a client

**MCP Inspector** (quickest check):

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp --method tools/list
npx @modelcontextprotocol/inspector --cli http://localhost:3000/mcp \
  --method tools/call --tool-name crm_query --tool-arg question="won deals over 3000"
```

**Claude Code**:

```bash
claude mcp add --transport http fieldbase http://localhost:3000/mcp
```

**Claude Desktop / other clients**: point the client at the streamable-HTTP
endpoint `http://localhost:3000/mcp`. Clients without native HTTP transport can
bridge with `npx mcp-remote http://localhost:3000/mcp`.

## Seeing the data

Everything is scoped to the demo user. To view changes an MCP client makes,
log in to the web app with the **same** `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.
Seed data via the web app (Settings → Load sample data) or straight from a
client with `crm_create_contact`.
