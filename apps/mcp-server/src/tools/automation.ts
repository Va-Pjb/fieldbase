import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabase } from '../lib/supabase.js'
import * as automations from '../data/automations.js'
import { fail, msg, ok } from './result.js'

// The automation + follow-up flow lives in Supabase Edge Functions (AI key
// server-side, never-silent guard in one place). These tools invoke them as the
// demo user — functions.invoke attaches the RLS session JWT.

// supabase-js wraps a non-2xx edge response in a FunctionsHttpError whose
// message is generic; the real reason is JSON in the underlying Response.
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

export function registerAutomationTools(server: McpServer) {
  server.registerTool(
    'automation_create',
    {
      title: 'Create an automation from plain English',
      description:
        'Describe an automation in plain English; the server uses AI to turn it into a validated, whitelisted rule (never free-form code) and saves it. v1 supports a missed-lead follow-up. Returns the automation id and the parsed rule.',
      inputSchema: {
        instructions: z
          .string()
          .min(1)
          .describe('e.g. "follow up with leads we haven\'t contacted in a day, by SMS".'),
        name: z.string().optional().describe('Optional custom name for the automation.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ instructions, name }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('automation-create', {
          body: { instructions, name },
        })
        if (error) return fail(`automation_create failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`automation_create failed: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'automation_list',
    {
      title: 'List automations',
      description:
        'List the automations you have created, with their trigger, action, and active state.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const rows = await automations.listAutomations()
        return ok({ count: rows.length, automations: rows })
      } catch (e) {
        return fail(`automation_list failed: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'followup_draft',
    {
      title: 'Draft follow-ups for missed leads',
      description:
        'Scan for leads that have gone cold and draft a follow-up message for each (or draft for one contactId). Creates review drafts only — nothing is sent. Returns draft ids to review, then send with followup_send.',
      inputSchema: {
        automationId: z
          .string()
          .uuid()
          .optional()
          .describe('A draft_followup automation to run; defaults to your active one.'),
        contactId: z
          .string()
          .uuid()
          .optional()
          .describe('Draft a follow-up for one specific contact instead of scanning.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ automationId, contactId }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('followup-draft', {
          body: { automationId, contactId },
        })
        if (error) return fail(`followup_draft failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`followup_draft failed: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'followup_send',
    {
      title: 'Send a drafted follow-up',
      description:
        'Send a follow-up that was drafted by followup_draft. Requires the draftId it returned — there is no way to send a message without first drafting and reviewing it. Records the outbound message on the contact timeline. A draft can only be sent once.',
      inputSchema: {
        draftId: z
          .string()
          .uuid()
          .describe('The draftId returned by followup_draft. Required — nothing sends without it.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ draftId }) => {
      try {
        const { data, error } = await getSupabase().functions.invoke('followup-send', {
          body: { draftId },
        })
        if (error) return fail(`followup_send failed: ${await invokeError(error)}`)
        return ok(data)
      } catch (e) {
        return fail(`followup_send failed: ${msg(e)}`)
      }
    },
  )
}
