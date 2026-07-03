import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Contact } from '@fieldbase/shared-types'

/**
 * Phase 0 stub data. Fake service-SMB contacts only — never real business
 * data. Replaced by live Supabase-backed queries in Phase 2.
 */
const STUB_CONTACTS: Contact[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Rivergum Dental',
    phone: '+61 7 5555 0101',
    email: 'reception@rivergumdental.example',
    company: 'Rivergum Dental',
    source: 'referral',
    tags: ['clinic', 'vip'],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Coast Electrical',
    phone: '+61 4 1234 5678',
    email: 'jobs@coastelectrical.example',
    company: 'Coast Electrical',
    source: 'google',
    tags: ['trade'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Marcus Webb',
    phone: '+61 4 0000 1111',
    email: null,
    company: null,
    source: 'website',
    tags: ['lead'],
  },
]

/**
 * Builds the FieldBase MCP server with the Phase 0 stub tool. The full 15-tool
 * surface (see the plan) is added in Phase 2; destructive tools will require a
 * prior preview/draft id and never fire standalone.
 */
export function createFieldBaseMcpServer(): McpServer {
  const server = new McpServer({
    name: 'fieldbase-mcp',
    version: '0.0.0',
  })

  server.registerTool(
    'crm_list_contacts',
    {
      title: 'List contacts',
      description:
        'List CRM contacts. Phase 0 stub: returns hardcoded sample data and ignores filters.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe('Maximum number of contacts to return.'),
      },
    },
    async ({ limit }) => {
      const contacts = STUB_CONTACTS.slice(0, limit ?? STUB_CONTACTS.length)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ stub: true, count: contacts.length, contacts }, null, 2),
          },
        ],
      }
    },
  )

  return server
}
