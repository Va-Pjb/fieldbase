import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as contacts from '../data/contacts.js'
import * as deals from '../data/deals.js'
import * as interactions from '../data/interactions.js'
import { fail, msg, ok } from './result.js'

export function registerContactTools(server: McpServer) {
  server.registerTool(
    'crm_list_contacts',
    {
      title: 'List contacts',
      description:
        'List CRM contacts, optionally filtered by a search term matching name, company, or email.',
      inputSchema: {
        search: z
          .string()
          .optional()
          .describe('Case-insensitive filter across name, company, and email.'),
        limit: z.number().int().positive().max(200).optional().describe('Max rows to return.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ search, limit }) => {
      try {
        const rows = await contacts.listContacts({ search, limit })
        return ok({ count: rows.length, contacts: rows })
      } catch (e) {
        return fail(`Failed to list contacts: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'crm_get_contact',
    {
      title: 'Get contact',
      description: 'Get a single contact by id, with its recent interactions and deals.',
      inputSchema: { id: z.string().uuid().describe('Contact id (uuid).') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        const contact = await contacts.getContact(id)
        if (!contact) return fail(`No contact found with id ${id}.`)
        const [contactDeals, recent] = await Promise.all([
          deals.listDealsByContact(id),
          interactions.listInteractionsByContact(id, 10),
        ])
        return ok({ contact, deals: contactDeals, interactions: recent })
      } catch (e) {
        return fail(`Failed to get contact: ${msg(e)}`)
      }
    },
  )
}
