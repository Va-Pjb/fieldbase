import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../lib/supabase.js'
import { fail, msg, ok } from './result.js'

// The migration flow lives in two Supabase Edge Functions (preview + execute)
// so the AI key stays server-side and the never-silent guard is enforced in one
// place. These tools invoke those functions as the demo user — functions.invoke
// attaches the signed-in session's JWT, so the edge function runs RLS-scoped.

// supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
// `message` is generic; the real reason is JSON in the underlying Response.
async function invokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = (await ctx.json()) as { error?: string }
      if (body && typeof body.error === 'string') return body.error
    } catch {
      // fall through to the generic message
    }
  }
  return msg(error)
}

export function registerMigrationTools(server: McpServer) {
  server.registerTool(
    'migration_preview',
    {
      title: 'Preview a contact import',
      description:
        'Preview importing contacts from CSV text. The server uses AI to propose a column-mapping plan and stages a migration job; it returns a jobId, the plan, and a sample of transformed rows. No contacts are written yet — review the plan, then call migration_execute with the returned jobId to import.',
      inputSchema: {
        csv: z.string().min(1).describe('The raw CSV text (header row plus data rows).'),
        instructions: z
          .string()
          .optional()
          .describe('Plain-English guidance, e.g. "map Mobile to phone; ignore the Notes column".'),
        filename: z
          .string()
          .optional()
          .describe('Original filename, stored on the job for reference.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ csv, instructions, filename }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('migration-preview', {
          body: { csv, instructions, filename },
        })
        if (error) return fail(`migration_preview failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`migration_preview failed: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'migration_execute',
    {
      title: 'Execute a previewed contact import',
      description:
        'Import the contacts from a previously previewed migration job. Requires a jobId produced by a prior migration_preview call — there is no path to import directly from a file, and a job can only be executed once. Writes contacts to the CRM and marks the job completed.',
      inputSchema: {
        jobId: z
          .string()
          .uuid()
          .describe('The jobId returned by migration_preview. Required — imports never run without one.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ jobId }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('migration-execute', {
          body: { jobId },
        })
        if (error) return fail(`migration_execute failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`migration_execute failed: ${msg(e)}`)
      }
    },
  )
}
