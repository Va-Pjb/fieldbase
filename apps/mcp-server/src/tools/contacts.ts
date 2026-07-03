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

  server.registerTool(
    'crm_create_contact',
    {
      title: 'Create contact',
      description: 'Create a new CRM contact.',
      inputSchema: {
        name: z.string().min(1).describe('Person or business name.'),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        company: z.string().optional(),
        source: z.string().optional().describe('Lead source, e.g. referral, google, website.'),
        tags: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ name, phone, email, company, source, tags }) => {
      try {
        const created = await contacts.createContact({
          name,
          phone: phone ?? null,
          email: email ?? null,
          company: company ?? null,
          source: source ?? null,
          tags: tags ?? [],
        })
        return ok({ contact: created })
      } catch (e) {
        return fail(`Failed to create contact: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'crm_update_contact',
    {
      title: 'Update contact',
      description: 'Update fields on an existing contact. Only the fields you pass are changed.',
      inputSchema: {
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        phone: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        company: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ id, name, phone, email, company, source, tags }) => {
      try {
        const patch: contacts.ContactUpdate = {}
        if (name !== undefined) patch.name = name
        if (phone !== undefined) patch.phone = phone
        if (email !== undefined) patch.email = email
        if (company !== undefined) patch.company = company
        if (source !== undefined) patch.source = source
        if (tags !== undefined) patch.tags = tags
        if (Object.keys(patch).length === 0) return fail('No fields provided to update.')
        const updated = await contacts.updateContact(id, patch)
        return ok({ contact: updated })
      } catch (e) {
        return fail(`Failed to update contact: ${msg(e)}`)
      }
    },
  )
}
