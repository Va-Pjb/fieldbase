import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as interactions from '../data/interactions.js'
import { fail, msg, ok } from './result.js'

export function registerInteractionTools(server: McpServer) {
  server.registerTool(
    'crm_log_interaction',
    {
      title: 'Log interaction',
      description: 'Log a call, email, note, or SMS against a contact.',
      inputSchema: {
        contact_id: z.string().uuid(),
        type: z.enum(interactions.INTERACTION_TYPES),
        content: z.string().optional().describe('What was said or done.'),
        occurred_at: z
          .string()
          .datetime()
          .optional()
          .describe('ISO 8601 timestamp; defaults to now.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ contact_id, type, content, occurred_at }) => {
      try {
        const row = await interactions.logInteraction({
          contactId: contact_id,
          type,
          content,
          occurredAt: occurred_at,
        })
        return ok({ interaction: row })
      } catch (e) {
        return fail(`Failed to log interaction: ${msg(e)}`)
      }
    },
  )
}
