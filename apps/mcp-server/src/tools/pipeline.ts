import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as deals from '../data/deals.js'
import { fail, msg, ok } from './result.js'

export function registerPipelineTools(server: McpServer) {
  server.registerTool(
    'crm_get_pipeline',
    {
      title: 'Get pipeline',
      description:
        'Get the deal pipeline grouped by stage, with per-stage counts and value totals plus open/won totals.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        return ok(await deals.getPipeline())
      } catch (e) {
        return fail(`Failed to get pipeline: ${msg(e)}`)
      }
    },
  )

  server.registerTool(
    'crm_move_deal_stage',
    {
      title: 'Move deal stage',
      description:
        'Move a deal to a new pipeline stage. Idempotent — moving to the stage it is already in is a no-op success.',
      inputSchema: {
        deal_id: z.string().uuid(),
        stage: z.enum(deals.DEAL_STAGES).describe('Target stage.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ deal_id, stage }) => {
      try {
        const existing = await deals.getDeal(deal_id)
        if (!existing) return fail(`No deal found with id ${deal_id}.`)
        if (existing.stage === stage) return ok({ deal: existing, changed: false })
        const updated = await deals.moveDealStage(deal_id, stage)
        return ok({ deal: updated, changed: true })
      } catch (e) {
        return fail(`Failed to move deal stage: ${msg(e)}`)
      }
    },
  )
}
